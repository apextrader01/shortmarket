const { generalClient } = require('../services/redisClient');
const jwt = require('jsonwebtoken');

function getMinuteBucket(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

// In-Memory Telemetry Buffer (Batched every 10 seconds to eliminate CPU/Redis churn)
let pendingApiStats = {};
let pendingUserStats = {};
let pendingMbStats = {};
let isFlushing = false;

async function flushTelemetry() {
    if (isFlushing || !generalClient || !generalClient.isReady) return;
    isFlushing = true;

    const apiSnapshot = pendingApiStats;
    const userSnapshot = pendingUserStats;
    const mbSnapshot = pendingMbStats;

    pendingApiStats = {};
    pendingUserStats = {};
    pendingMbStats = {};

    try {
        const p = generalClient.multi();
        let opsCount = 0;

        for (const [routeKey, stats] of Object.entries(apiSnapshot)) {
            p.hIncrBy(`telemetry:api:${routeKey}`, 'count', stats.count);
            p.hIncrBy(`telemetry:api:${routeKey}`, 'time_ms', stats.timeMs);
            if (stats.bytes > 0) p.hIncrBy(`telemetry:api:${routeKey}`, 'bytes', stats.bytes);
            p.sAdd('telemetry:routes', routeKey);
            opsCount++;
        }

        for (const [userId, stats] of Object.entries(userSnapshot)) {
            p.hIncrBy(`telemetry:user:${userId}`, 'api_calls', stats.api_calls);
            p.hIncrBy(`telemetry:user:${userId}`, 'api_time_ms', stats.api_time_ms);
            if (stats.api_bytes > 0) p.hIncrBy(`telemetry:user:${userId}`, 'api_bytes', stats.api_bytes);
            p.sAdd('telemetry:users', String(userId));
            opsCount++;
        }

        for (const [mbKey, stats] of Object.entries(mbSnapshot)) {
            if (stats.count) p.hIncrBy(mbKey, 'count', stats.count);
            if (stats.time_ms) p.hIncrBy(mbKey, 'time_ms', stats.time_ms);
            if (stats.bytes) p.hIncrBy(mbKey, 'bytes', stats.bytes);
            if (stats.api_calls) p.hIncrBy(mbKey, 'api_calls', stats.api_calls);
            if (stats.api_time_ms) p.hIncrBy(mbKey, 'api_time_ms', stats.api_time_ms);
            if (stats.api_bytes) p.hIncrBy(mbKey, 'api_bytes', stats.api_bytes);
            p.expire(mbKey, 86400);
            
            const mbParts = mbKey.split(':');
            if (mbParts.length >= 3 && mbParts[2]) {
                p.sAdd(`telemetry:mb_keys:${mbParts[2]}`, mbKey);
                p.expire(`telemetry:mb_keys:${mbParts[2]}`, 86400);
            }
            opsCount++;
        }

        if (opsCount > 0) {
            await p.exec();
        }
    } catch (err) {
        console.error("TELEMETRY FLUSH ERROR:", err.message);
    } finally {
        isFlushing = false;
    }
}

// Flush telemetry every 10 seconds to keep Redis writes at near zero
setInterval(flushTelemetry, 10000).unref();

function recordTelemetry(req, res, next) {
    if (!generalClient || !generalClient.isReady) return next();
    
    // Ignore static assets & bot scanner probes
    const pathLower = req.path.toLowerCase();
    if (
        req.path.startsWith('/assets') || 
        req.path === '/favicon.ico' || 
        pathLower.startsWith('/.') || 
        pathLower.includes('.env') ||
        pathLower.includes('.yml') ||
        pathLower.includes('.yaml') ||
        pathLower.includes('.bak') ||
        pathLower.includes('.php') ||
        pathLower.includes('credentials') ||
        pathLower.includes('terraform') ||
        pathLower.includes('actuator') ||
        pathLower.includes('/etc/') ||
        pathLower.includes('/proc/')
    ) {
        return next();
    }

    const startTime = process.hrtime();

    res.on('finish', () => {
        try {
            const diff = process.hrtime(startTime);
            const timeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
            
            let routePath = req.baseUrl + req.path;
            routePath = routePath.replace(/\/\d+/g, '/:id');
            const routeKey = `${req.method} ${routePath}`;
            
            // Fast user ID lookup: skip heavy cryptographic verify, use req.user or jwt.decode
            let userId = 'anonymous';
            if (req.user && req.user.id) {
                userId = req.user.id;
            } else {
                const token = (req.cookies && req.cookies.token) || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
                if (token) {
                    try {
                        const decoded = jwt.decode(token);
                        if (decoded && decoded.id) userId = decoded.id;
                    } catch(e) {}
                }
            }

            let responseBodySize = 0;
            const contentLength = res.get('Content-Length');
            if (contentLength) {
                responseBodySize = parseInt(contentLength, 10);
            }

            // Buffer in memory (nanosecond execution, zero Redis roundtrips)
            if (!pendingApiStats[routeKey]) pendingApiStats[routeKey] = { count: 0, timeMs: 0, bytes: 0 };
            pendingApiStats[routeKey].count += 1;
            pendingApiStats[routeKey].timeMs += timeMs;
            pendingApiStats[routeKey].bytes += responseBodySize;

            const currentBucket = getMinuteBucket();
            const mbApiKey = `telemetry:mb:${currentBucket}:api:${routeKey}`;
            if (!pendingMbStats[mbApiKey]) pendingMbStats[mbApiKey] = { count: 0, time_ms: 0, bytes: 0 };
            pendingMbStats[mbApiKey].count += 1;
            pendingMbStats[mbApiKey].time_ms += timeMs;
            pendingMbStats[mbApiKey].bytes += responseBodySize;

            if (userId !== 'anonymous') {
                if (!pendingUserStats[userId]) pendingUserStats[userId] = { api_calls: 0, api_time_ms: 0, api_bytes: 0 };
                pendingUserStats[userId].api_calls += 1;
                pendingUserStats[userId].api_time_ms += timeMs;
                pendingUserStats[userId].api_bytes += responseBodySize;

                const mbUserKey = `telemetry:mb:${currentBucket}:user:${userId}`;
                if (!pendingMbStats[mbUserKey]) pendingMbStats[mbUserKey] = { api_calls: 0, api_time_ms: 0, api_bytes: 0 };
                pendingMbStats[mbUserKey].api_calls = (pendingMbStats[mbUserKey].api_calls || 0) + 1;
                pendingMbStats[mbUserKey].api_time_ms = (pendingMbStats[mbUserKey].api_time_ms || 0) + timeMs;
                pendingMbStats[mbUserKey].api_bytes = (pendingMbStats[mbUserKey].api_bytes || 0) + responseBodySize;
            }
        } catch (err) {
            console.error("TELEMETRY ERROR:", err);
        }
    });

    next();
}

module.exports = recordTelemetry;

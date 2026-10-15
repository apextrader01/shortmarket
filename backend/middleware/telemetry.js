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

// Scale Guard: Cap in-memory active users to 500 to keep Node.js RAM <= 25 MB permanently
const MAX_CACHED_USERS = 500;
const userApiCallBuffers = new Map();
const userActivityBuffers = new Map();

// Pending Redis Batches (flushed every 10 seconds via multi() to eliminate DB churn)
let pendingUserApiLogs = {};
let pendingUserActivityLogs = {};

function recordUserApiCallInMemory(userId, entry) {
    if (!userId || userId === 'anonymous') return;
    const key = String(userId);
    let list = userApiCallBuffers.get(key);
    if (!list) {
        if (userApiCallBuffers.size >= MAX_CACHED_USERS) {
            const oldestKey = userApiCallBuffers.keys().next().value;
            userApiCallBuffers.delete(oldestKey);
        }
        list = [];
        userApiCallBuffers.set(key, list);
    } else {
        userApiCallBuffers.delete(key);
        userApiCallBuffers.set(key, list);
    }
    const parsedEntry = typeof entry === 'string' ? JSON.parse(entry) : entry;
    list.unshift(parsedEntry);
    if (list.length > 100) list.pop();

    // Queue for 10-second batched Redis pipeline
    if (!pendingUserApiLogs[key]) pendingUserApiLogs[key] = [];
    pendingUserApiLogs[key].push(JSON.stringify(parsedEntry));
    if (pendingUserApiLogs[key].length > 100) pendingUserApiLogs[key].shift();
}

function recordUserActivityInMemory(userId, entry) {
    if (!userId || userId === 'anonymous') return;
    const key = String(userId);
    let list = userActivityBuffers.get(key);
    if (!list) {
        if (userActivityBuffers.size >= MAX_CACHED_USERS) {
            const oldestKey = userActivityBuffers.keys().next().value;
            userActivityBuffers.delete(oldestKey);
        }
        list = [];
        userActivityBuffers.set(key, list);
    } else {
        userActivityBuffers.delete(key);
        userActivityBuffers.set(key, list);
    }
    const parsedEntry = typeof entry === 'string' ? JSON.parse(entry) : entry;
    list.unshift(parsedEntry);
    if (list.length > 100) list.pop();

    // Queue for 10-second batched Redis pipeline
    if (!pendingUserActivityLogs[key]) pendingUserActivityLogs[key] = [];
    pendingUserActivityLogs[key].push(JSON.stringify(parsedEntry));
    if (pendingUserActivityLogs[key].length > 100) pendingUserActivityLogs[key].shift();
}

function getUserApiLogs(userId) {
    return userApiCallBuffers.get(String(userId)) || [];
}

function getUserActivityLogs(userId) {
    return userActivityBuffers.get(String(userId)) || [];
}

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
            p.expire(`telemetry:api:${routeKey}`, 30 * 86400);
            opsCount++;
        }

        for (const [userId, stats] of Object.entries(userSnapshot)) {
            p.hIncrBy(`telemetry:user:${userId}`, 'api_calls', stats.api_calls);
            p.hIncrBy(`telemetry:user:${userId}`, 'api_time_ms', stats.api_time_ms);
            if (stats.api_bytes > 0) p.hIncrBy(`telemetry:user:${userId}`, 'api_bytes', stats.api_bytes);
            p.sAdd('telemetry:users', String(userId));
            p.expire(`telemetry:user:${userId}`, 30 * 86400);
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

        const userApiLogsSnapshot = pendingUserApiLogs;
        const userActLogsSnapshot = pendingUserActivityLogs;
        pendingUserApiLogs = {};
        pendingUserActivityLogs = {};

        for (const [uId, logs] of Object.entries(userApiLogsSnapshot)) {
            if (logs.length > 0) {
                p.lPush(`telemetry:user_api_calls:${uId}`, ...logs);
                p.lTrim(`telemetry:user_api_calls:${uId}`, 0, 99);
                p.expire(`telemetry:user_api_calls:${uId}`, 7 * 86400);
                opsCount++;
            }
        }

        for (const [uId, logs] of Object.entries(userActLogsSnapshot)) {
            if (logs.length > 0) {
                p.lPush(`telemetry:user_activity_logs:${uId}`, ...logs);
                p.lTrim(`telemetry:user_activity_logs:${uId}`, 0, 99);
                p.expire(`telemetry:user_activity_logs:${uId}`, 7 * 86400);
                opsCount++;
            }
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

            if (userId && userId !== 'anonymous' && userId !== 'undefined' && userId !== 'null') {
                if (!pendingUserStats[userId]) pendingUserStats[userId] = { api_calls: 0, api_time_ms: 0, api_bytes: 0 };
                pendingUserStats[userId].api_calls += 1;
                pendingUserStats[userId].api_time_ms += timeMs;
                pendingUserStats[userId].api_bytes += responseBodySize;

                const mbUserKey = `telemetry:mb:${currentBucket}:user:${userId}`;
                if (!pendingMbStats[mbUserKey]) pendingMbStats[mbUserKey] = { api_calls: 0, api_time_ms: 0, api_bytes: 0 };
                pendingMbStats[mbUserKey].api_calls = (pendingMbStats[mbUserKey].api_calls || 0) + 1;
                pendingMbStats[mbUserKey].api_time_ms = (pendingMbStats[mbUserKey].api_time_ms || 0) + timeMs;
                pendingMbStats[mbUserKey].api_bytes = (pendingMbStats[mbUserKey].api_bytes || 0) + responseBodySize;

                // Per-user granular API audit log entry
                const clientIp = (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '').slice(0, 45);
                const apiEntry = {
                    method: req.method,
                    path: routePath,
                    fullUrl: (req.originalUrl || req.url || '').slice(0, 150),
                    status: res.statusCode,
                    timeMs: timeMs,
                    bytes: responseBodySize,
                    timestamp: Date.now(),
                    ip: clientIp
                };

                recordUserApiCallInMemory(userId, apiEntry);
            }
        } catch (err) {
            console.error("TELEMETRY ERROR:", err);
        }
    });

    next();
}

recordTelemetry.flushTelemetry = flushTelemetry;
recordTelemetry.recordTelemetry = recordTelemetry;
recordTelemetry.recordUserActivityInMemory = recordUserActivityInMemory;
recordTelemetry.recordUserApiCallInMemory = recordUserApiCallInMemory;
recordTelemetry.getUserApiLogs = getUserApiLogs;
recordTelemetry.getUserActivityLogs = getUserActivityLogs;
module.exports = recordTelemetry;


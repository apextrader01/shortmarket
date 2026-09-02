const { generalClient } = require('../services/redisClient');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_shortmarket_key_2026';

function getMinuteBucket(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

async function recordTelemetry(req, res, next) {
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

    res.on('finish', async () => {
        try {
            const diff = process.hrtime(startTime);
            const timeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
            
            let routePath = req.baseUrl + req.path;
            routePath = routePath.replace(/\/\d+/g, '/:id');
            const routeKey = `${req.method} ${routePath}`;
            
            let userId = 'anonymous';
            if (req.user && req.user.id) {
                userId = req.user.id;
            } else {
                const token = (req.cookies && req.cookies.token) || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
                if (token) {
                    try {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        if (decoded && decoded.id) userId = decoded.id;
                    } catch(e) {}
                }
            }

            let responseBodySize = 0;
            const contentLength = res.get('Content-Length');
            if (contentLength) {
                responseBodySize = parseInt(contentLength, 10);
            }

            const currentBucket = getMinuteBucket();
            const p = generalClient.multi();

            // 1. All-time cumulative stats
            p.hIncrBy(`telemetry:api:${routeKey}`, 'count', 1);
            p.hIncrBy(`telemetry:api:${routeKey}`, 'time_ms', timeMs);
            if (responseBodySize > 0) p.hIncrBy(`telemetry:api:${routeKey}`, 'bytes', responseBodySize);

            // 2. Minute-bucket stats (24 hour TTL)
            const mbApiKey = `telemetry:mb:${currentBucket}:api:${routeKey}`;
            p.hIncrBy(mbApiKey, 'count', 1);
            p.hIncrBy(mbApiKey, 'time_ms', timeMs);
            if (responseBodySize > 0) p.hIncrBy(mbApiKey, 'bytes', responseBodySize);
            p.expire(mbApiKey, 86400);

            if (userId !== 'anonymous') {
                // User all-time
                p.hIncrBy(`telemetry:user:${userId}`, 'api_calls', 1);
                p.hIncrBy(`telemetry:user:${userId}`, 'api_time_ms', timeMs);
                if (responseBodySize > 0) p.hIncrBy(`telemetry:user:${userId}`, 'api_bytes', responseBodySize);

                // User minute-bucket (24 hour TTL)
                const mbUserKey = `telemetry:mb:${currentBucket}:user:${userId}`;
                p.hIncrBy(mbUserKey, 'api_calls', 1);
                p.hIncrBy(mbUserKey, 'api_time_ms', timeMs);
                if (responseBodySize > 0) p.hIncrBy(mbUserKey, 'api_bytes', responseBodySize);
                p.expire(mbUserKey, 86400);
            }

            await p.exec();
        } catch (err) {
            console.error("TELEMETRY ERROR:", err);
        }
    });

    next();
}

module.exports = recordTelemetry;

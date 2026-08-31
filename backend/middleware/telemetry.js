const { generalClient } = require('../services/redisClient');

async function recordTelemetry(req, res, next) {
    if (!generalClient || !generalClient.isReady) return next();
    
    // Ignore static assets if any
    if (req.path.startsWith('/assets') || req.path === '/favicon.ico') return next();

    const startTime = process.hrtime();
    let responseBodySize = 0;

    // Hook into res.end, res.send, res.json
    const originalWrite = res.write;
    const originalEnd = res.end;
    let chunks = [];

    res.write = function (chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        originalWrite.apply(res, arguments);
    };

    res.end = function (chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        responseBodySize = Buffer.concat(chunks).length;
        originalEnd.apply(res, arguments);
    };

    res.on('finish', async () => {
        try {
            const diff = process.hrtime(startTime);
            const timeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
            
            // Normalize path (remove dynamic IDs if possible)
            let routePath = req.baseUrl + req.path;
            // Simple normalization: replace numeric IDs with :id
            routePath = routePath.replace(/\/\d+/g, '/:id');
            const routeKey = `${req.method} ${routePath}`;
            
            const userId = (req.user && req.user.id) ? req.user.id : 'anonymous';

            // Log API metrics
            const p = generalClient.pipeline();
            p.hIncrBy(`telemetry:api:${routeKey}`, 'count', 1);
            p.hIncrBy(`telemetry:api:${routeKey}`, 'time_ms', timeMs);
            p.hIncrBy(`telemetry:api:${routeKey}`, 'bytes', responseBodySize);

            // Log User metrics
            if (userId !== 'anonymous') {
                p.hIncrBy(`telemetry:user:${userId}`, 'api_calls', 1);
                p.hIncrBy(`telemetry:user:${userId}`, 'api_bytes', responseBodySize);
                p.hIncrBy(`telemetry:user:${userId}`, 'api_time_ms', timeMs);
            }
            await p.exec();
        } catch (err) {
            // Silently fail to not break the app
        }
    });

    next();
}

module.exports = recordTelemetry;

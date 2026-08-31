const { generalClient } = require('../services/redisClient');

async function recordTelemetry(req, res, next) {
    if (!generalClient || !generalClient.isReady) return next();
    
    // Ignore static assets
    if (req.path.startsWith('/assets') || req.path === '/favicon.ico') return next();

    const startTime = process.hrtime();

    res.on('finish', async () => {
        try {
            const diff = process.hrtime(startTime);
            const timeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
            
            let routePath = req.baseUrl + req.path;
            routePath = routePath.replace(/\/\d+/g, '/:id');
            const routeKey = `${req.method} ${routePath}`;
            
            const userId = (req.user && req.user.id) ? req.user.id : 'anonymous';

            // Try to get content length if available
            let responseBodySize = 0;
            const contentLength = res.get('Content-Length');
            if (contentLength) {
                responseBodySize = parseInt(contentLength, 10);
            }

            const p = generalClient.pipeline();
            p.hIncrBy(`telemetry:api:${routeKey}`, 'count', 1);
            p.hIncrBy(`telemetry:api:${routeKey}`, 'time_ms', timeMs);
            if (responseBodySize > 0) p.hIncrBy(`telemetry:api:${routeKey}`, 'bytes', responseBodySize);

            if (userId !== 'anonymous') {
                p.hIncrBy(`telemetry:user:${userId}`, 'api_calls', 1);
                p.hIncrBy(`telemetry:user:${userId}`, 'api_time_ms', timeMs);
                if (responseBodySize > 0) p.hIncrBy(`telemetry:user:${userId}`, 'api_bytes', responseBodySize);
            }
            await p.exec();
        } catch (err) {
            // Silently fail
        }
    });

    next();
}

module.exports = recordTelemetry;

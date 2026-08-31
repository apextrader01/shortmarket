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
            
            
            let userId = 'anonymous';
            if (req.user && req.user.id) {
                userId = req.user.id;
            } else {
                // Try to manually decode token if present so we can track users even on routes where authenticateToken isn't applied globally
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_shortmarket_key_2026';
                const token = (req.cookies && req.cookies.token) || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
                if (token) {
                    try {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        if (decoded && decoded.id) userId = decoded.id;
                    } catch(e) {}
                }
            }


            // Try to get content length if available
            let responseBodySize = 0;
            const contentLength = res.get('Content-Length');
            if (contentLength) {
                responseBodySize = parseInt(contentLength, 10);
            }

            const p = generalClient.multi();
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
            console.error("TELEMETRY ERROR:", err);
        }
    });

    next();
}

module.exports = recordTelemetry;

const fs = require('fs');
const file = 'backend/server.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Inject middleware
const middlewareInjectTarget = `app.use(express.json({ limit: '10kb' }));`; // Exists in standard express setup, let's just find app.use(compression())
const middlewareTarget = `app.use(compression()); // Compress all API responses to fix frontend loading lag`;
const middlewareReplacement = `app.use(compression()); // Compress all API responses to fix frontend loading lag

const recordTelemetry = require('./middleware/telemetry');
app.use(recordTelemetry);
`;
content = content.replace(middlewareTarget, middlewareReplacement);

// 2. Inject WebSocket tracking
const wsTarget = `console.log('Client connected:', socket.id);`;
const wsReplacement = `console.log('Client connected:', socket.id);
    const connectTime = Date.now();
    const userId = socket.user ? socket.user.id : null;
    socket.on('disconnect', async () => {
        if (userId) {
            try {
                const { generalClient } = require('./services/redisClient');
                if (generalClient && generalClient.isReady) {
                    const minutes = Math.max(1, Math.round((Date.now() - connectTime) / 60000));
                    await generalClient.hIncrBy(\`telemetry:user:\${userId}\`, 'ws_minutes', minutes);
                }
            } catch (e) {}
        }
    });`;
content = content.replace(wsTarget, wsReplacement);

// 3. Inject Admin Telemetry Route
const routeTarget = `app.post('/api/admin/master_square_off'`;
const routeReplacement = `app.get('/api/admin/telemetry', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { generalClient } = require('./services/redisClient');
        if (!generalClient || !generalClient.isReady) return res.json({ api: [], users: [] });

        const apiKeys = await generalClient.keys('telemetry:api:*');
        const userKeys = await generalClient.keys('telemetry:user:*');

        const apiStats = [];
        for (const k of apiKeys) {
            const data = await generalClient.hGetAll(k);
            apiStats.push({
                route: k.replace('telemetry:api:', ''),
                count: parseInt(data.count || 0),
                totalTime: parseInt(data.time_ms || 0),
                totalBytes: parseInt(data.bytes || 0)
            });
        }

        const userStats = [];
        for (const k of userKeys) {
            const userId = k.replace('telemetry:user:', '');
            const data = await generalClient.hGetAll(k);
            const dbUser = await db('users').where({ id: userId }).first();
            userStats.push({
                userId,
                username: dbUser ? dbUser.username : 'Unknown',
                apiCalls: parseInt(data.api_calls || 0),
                apiBytes: parseInt(data.api_bytes || 0),
                wsMinutes: parseInt(data.ws_minutes || 0)
            });
        }
        res.json({ api: apiStats, users: userStats });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch telemetry' });
    }
});

app.post('/api/admin/master_square_off'`;
content = content.replace(routeTarget, routeReplacement);

fs.writeFileSync(file, content);

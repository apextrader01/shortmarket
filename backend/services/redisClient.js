const { createClient } = require('redis');

// Initialize 3 clients:
// 1. generalClient: For normal GET/SET (chart caching, price caching)
// 2. pubClient: For Socket.io adapter and broadcasting price ticks
// 3. subClient: For receiving pub/sub events from other cluster nodes
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const createRedisClient = (name = 'redis') => {
    const client = createClient({
        url: redisUrl,
        disableOfflineQueue: true, // Don't queue commands when Redis is offline
        socket: {
            reconnectStrategy: (retries) => {
                // Retry with backoff: 1s, 2s, 4s ... up to 10s max
                const delay = Math.min(1000 * Math.pow(2, retries), 10000);
                console.log(`[${name}] Reconnecting in ${delay}ms (attempt ${retries + 1})...`);
                return delay;
            },
            connectTimeout: 10000,
            keepAlive: 5000,
        }
    });

    // CRITICAL: Attach error handler BEFORE connect().
    // Without this, Redis reconnection errors throw UnhandledRejection
    // which terminates the Node.js process (Node.js 15+ behavior).
    client.on('error', (err) => {
        // Log but don't throw — keeps the process alive during Redis outages
        console.error(`[${name}] Redis error:`, err.message);
    });

    client.on('reconnecting', () => console.log(`[${name}] Redis reconnecting...`));
    client.on('ready', () => console.log(`[${name}] Redis ready.`));

    client.connect().catch(err => console.error(`[${name}] Initial connect error:`, err.message));
    return client;
};

const generalClient = createRedisClient('general');
const pubClient    = createRedisClient('pub');
const subClient    = createRedisClient('sub');

module.exports = {
    generalClient,
    pubClient,
    subClient
};

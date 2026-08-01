const { createClient } = require('redis');

// Initialize 3 clients:
// 1. generalClient: For normal GET/SET (chart caching, price caching)
// 2. pubClient: For Socket.io adapter and broadcasting price ticks
// 3. subClient: For Socket.io adapter and listening for price ticks

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const createRedisClient = () => {
    const client = createClient({ url: redisUrl });
    
    client.on('error', (err) => console.error('Redis Client Error', err));
    
    client.connect().catch(err => console.error('Redis Connect Error', err));
    return client;
};

const generalClient = createRedisClient();
const pubClient = createRedisClient();
const subClient = createRedisClient();

module.exports = {
    generalClient,
    pubClient,
    subClient
};

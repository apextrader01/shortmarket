const { createClient } = require('redis');
require('dotenv').config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

pubClient.on('error', (err) => console.log('❌ Redis Pub Client Error', err.message));
subClient.on('error', (err) => console.log('❌ Redis Sub Client Error', err.message));

let isConnected = false;

async function initRedis() {
    if (isConnected) return;
    try {
        await pubClient.connect();
        await subClient.connect();
        isConnected = true;
        console.log('✅ Connected to Redis (Pub/Sub for Scaling)');
    } catch (e) {
        console.error('⚠️ Failed to connect to Redis. Ensure REDIS_URL is correct.', e.message);
    }
}

// Ensure connection is attempted
initRedis();

module.exports = {
    pubClient,
    subClient,
    initRedis
};

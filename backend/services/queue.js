const { Queue, Worker, QueueEvents } = require('bullmq');
const { pubClient } = require('./redis'); 

const connection = {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
};

// Create the Order Queue
const orderQueue = new Queue('OrderQueue', { connection });
const queueEvents = new QueueEvents('OrderQueue', { connection });

// Define the Worker that processes orders
const orderWorker = new Worker('OrderQueue', async (job) => {
    const { userId, reqBody, priceCache } = job.data;
    
    try {
        // We will move the logic from server.js into a separate file if needed, 
        // or we just handle it directly. But wait, server.js handles a LOT of logic inline.
    } catch (err) {
        throw new Error(err.message);
    }
}, { connection, concurrency: 5 }); // Process up to 5 orders concurrently to protect Postgres

module.exports = {
    orderQueue,
    orderWorker,
    queueEvents
};

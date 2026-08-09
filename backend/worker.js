const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const logger = require('./services/logger');

// Override global console methods for Winston integration
console.log = (...args) => logger.info(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
console.error = (...args) => logger.error(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));

console.log('👷 Worker process started. Ready for background tasks.');

// TODO: In Phase 2, after migrating priceCache and triggerEngine to Redis, 
// we will migrate initCronJobs() from server.js to this worker process.
// For now, this process serves as a placeholder to safely test PM2 fork mode.

// Keep process alive
setInterval(() => {
    // console.log('[Worker] Heartbeat...');
}, 60000);

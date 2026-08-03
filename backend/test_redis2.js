const { subClient } = require('./services/redisClient');
console.log('Got subClient');
try {
    subClient.subscribe('test_channel', () => {
        console.log('Subscribed');
    }).then(() => console.log('Promise resolved')).catch(e => console.log('Promise rejected', e.message));
    console.log('Subscribe called successfully');
} catch (e) {
    console.log('Sync throw:', e.message);
}
setTimeout(() => process.exit(0), 2000);

const redis = require('redis');
const client = redis.createClient();
client.connect().then(async () => {
    try {
        const p = client.multi();
        p.hIncrBy('test_key', 'count', 1);
        await p.exec();
        console.log("SUCCESS");
    } catch (e) {
        console.error("MULTI ERROR:", e.message);
    }
    
    process.exit(0);
});

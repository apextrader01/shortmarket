const redis = require('redis');
const client = redis.createClient();
client.connect().then(async () => {
    try {
        const p = client.pipeline();
        console.log("PIPELINE EXISTS");
    } catch (e) {
        console.error("PIPELINE ERROR:", e.message);
    }
    
    try {
        const m = client.multi();
        console.log("MULTI EXISTS");
    } catch (e) {
        console.error("MULTI ERROR:", e.message);
    }
    
    process.exit(0);
});

const redis = require('redis');
const client = redis.createClient();
console.log("hGetAll exists:", typeof client.hGetAll);
console.log("keys exists:", typeof client.keys);

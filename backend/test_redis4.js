const redis = require('redis');
const client = redis.createClient();
console.log("hIncrBy exists:", typeof client.hIncrBy);
console.log("multi hIncrBy exists:", typeof client.multi().hIncrBy);

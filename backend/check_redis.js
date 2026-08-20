const redis = require('redis');

async function test() {
    const client = redis.createClient();
    await client.connect();
    const ltp1 = await client.hGet('fyers_prices', 'NSE:NIFTY2681824150PE');
    const ltp2 = await client.hGet('fyers_prices', 'NSE:NIFTY2681824150CE');
    const ltp3 = await client.hGet('fyers_prices', 'NSE:NIFTY2681823950CE');
    console.log("24150PE:", ltp1);
    console.log("24150CE:", ltp2);
    console.log("23950CE:", ltp3);
    process.exit(0);
}
test();

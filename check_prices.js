const fs = require('fs');
const prices = JSON.parse(fs.readFileSync('backend/database/live_prices.json', 'utf8') || '{}');
console.log("24150PE:", prices['NSE:NIFTY2681824150PE']);
console.log("24150CE:", prices['NSE:NIFTY2681824150CE']);
console.log("23950CE:", prices['NSE:NIFTY2681823950CE']);

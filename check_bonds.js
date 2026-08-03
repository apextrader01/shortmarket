const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/h4har/Documents/shortmarket/backend/database/stocks.json', 'utf8'));
const keys = Object.keys(data);
console.log(JSON.stringify(data[keys[50]], null, 2));

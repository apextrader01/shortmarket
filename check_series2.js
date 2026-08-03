const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/h4har/Documents/shortmarket/backend/database/stocks.json', 'utf8'));
const samples = [];
for (const key of Object.keys(data)) {
    if (!data[key]) continue;
    const symbol = data[key].symbol;
    if (symbol && !symbol.includes('-') && !symbol.includes('BSE')) {
        samples.push(symbol + ' (' + data[key].name + ')');
        if (samples.length >= 200) break;
    }
}
console.log(samples.slice(50, 100).join('\n'));

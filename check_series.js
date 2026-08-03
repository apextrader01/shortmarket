const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/h4har/Documents/shortmarket/backend/database/stocks.json', 'utf8'));
const seriesCount = {};
for (const key of Object.keys(data)) {
    if (!data[key]) continue;
    const symbol = data[key].symbol;
    if (symbol) {
        const parts = symbol.split('-');
        if (parts.length > 1) {
            const series = parts[parts.length - 1];
            seriesCount[series] = (seriesCount[series] || 0) + 1;
        }
    }
}
const sorted = Object.entries(seriesCount).sort((a,b) => b[1] - a[1]);
console.log(sorted.map(x => x[0] + ': ' + x[1]).join('\n'));

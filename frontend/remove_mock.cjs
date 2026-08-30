const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');
content = content.replace('const priceInterval = setInterval(() => { useStore.getState().fetchBatchPrices(["NSE:NIFTY50-INDEX"]);', 'const priceInterval = setInterval(() => {');
fs.writeFileSync('src/App.jsx', content);

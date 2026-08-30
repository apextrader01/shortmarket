const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');
content = content.replace('const priceInterval = setInterval(() => {', 'const priceInterval = setInterval(() => { useStore.getState().fetchBatchPrices(["NSE:NIFTY50-INDEX"]);');
fs.writeFileSync('src/App.jsx', content);

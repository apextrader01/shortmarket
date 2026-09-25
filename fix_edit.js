const fs = require('fs');
let ed = fs.readFileSync('frontend/src/components/EditOrderModal.jsx', 'utf8');

ed = ed.replace(/prices: state\.prices,?\s*/g, '');
ed = ed.replace(/, prices /g, ' ');
ed = ed.replace(/prices,/g, '');

ed = ed.replace(/const isUp = symbol \? prices\[symbol\]\?\.pct >= 0 : true;/, 'const priceData = useStore(state => state.prices[symbol] || {});\n  const isUp = priceData.pct >= 0;');
ed = ed.replace(/const livePrice = symbol \? prices\[symbol\]\?\.ltp \|\| 0 : 0;/, 'const livePrice = priceData.ltp || 0;');

fs.writeFileSync('frontend/src/components/EditOrderModal.jsx', ed);
console.log('Fixed EditOrderModal');

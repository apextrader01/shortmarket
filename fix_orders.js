const fs = require('fs');

// 1. OrderModal.jsx
let om = fs.readFileSync('frontend/src/components/OrderModal.jsx', 'utf8');
om = om.replace(/prices: state\.prices,?\s*/g, '');
om = om.replace(/, prices /g, ' ');
om = om.replace(/prices,/g, '');
om = om.replace(/const livePrice = symbol \? prices\[symbol\]\?\.ltp \|\| 0 : 0;/, 'const priceData = useStore(state => state.prices[orderModal?.symbol] || {});\n  const livePrice = priceData.ltp || 0;');
om = om.replace(/const isUp = symbol \? prices\[symbol\]\?\.pct >= 0 : true;/, 'const isUp = priceData.pct >= 0;');
fs.writeFileSync('frontend/src/components/OrderModal.jsx', om);

// 2. OrderPad.jsx
let op = fs.readFileSync('frontend/src/components/OrderPad.jsx', 'utf8');
op = op.replace(/prices: state\.prices,?\s*/g, '');
op = op.replace(/, prices /g, ' ');
op = op.replace(/prices,/g, '');
op = op.replace(/const ltp = prices\[selectedSymbol\]\?\.ltp \|\| 0;/, 'const priceData = useStore(state => state.prices[selectedSymbol] || {});\n  const ltp = priceData.ltp || 0;');
fs.writeFileSync('frontend/src/components/OrderPad.jsx', op);

// 3. MarketDepthModal.jsx
let md = fs.readFileSync('frontend/src/components/MarketDepthModal.jsx', 'utf8');
md = md.replace(/prices: state\.prices,?\s*/g, '');
md = md.replace(/, prices /g, ' ');
md = md.replace(/prices,/g, '');
md = md.replace(/const basicData = prices\[symbol\] \|\| \{\};/, 'const basicData = useStore(state => state.prices[marketDepthModal?.symbol] || {});');
fs.writeFileSync('frontend/src/components/MarketDepthModal.jsx', md);

console.log("Fixed all 3 Order Forms.");

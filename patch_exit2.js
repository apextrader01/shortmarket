const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/PositionsView.jsx', 'utf8');

code = code.replace(/parseInt\(agg\.closed_quantity\)/g, "parseFloat(agg.closed_quantity)");
code = code.replace(/parseInt\(pos\.closed_quantity\)/g, "parseFloat(pos.closed_quantity)");

fs.writeFileSync('frontend/src/components/PositionsView.jsx', code);
console.log('Fixed parseInt to parseFloat in PositionsView aggregations');

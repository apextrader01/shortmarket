const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/PositionsView.jsx', 'utf8');

code = code.replace(/const inputVal = parseInt\(partialExitQty\);/, "const inputVal = parseFloat(partialExitQty);");
code = code.replace(/step="1"/, 'step="any"');

fs.writeFileSync('frontend/src/components/PositionsView.jsx', code);
console.log('Fixed parseInt to parseFloat');

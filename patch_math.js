const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

code = code.replace(
    /const holdingQty = holding \? holding\.quantity : 0;/g,
    "const holdingQty = holding ? Number(holding.quantity) : 0;"
);

code = code.replace(
    /const posQty = existingPos && existingPos\.quantity > 0 \? existingPos\.quantity : 0;/g,
    "const posQty = existingPos && Number(existingPos.quantity) > 0 ? Number(existingPos.quantity) : 0;"
);

code = code.replace(
    /const totalAvailable = holdingQty \+ posQty \- pendingSellQty;/g,
    "const totalAvailable = parseFloat((holdingQty + posQty - pendingSellQty).toFixed(4));"
);

fs.writeFileSync('backend/server.js', code);
console.log('Fixed math string concatenation and floating point issues');

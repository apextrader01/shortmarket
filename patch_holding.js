const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/MutualFundDetailsModal.jsx', 'utf8');

code = code.replace(
    'const holdingInvested = userHolding ? userHolding.invested : 0;',
    'const holdingInvested = userHolding ? parseFloat(userHolding.average_price || 0) * Number(userHolding.quantity || 0) : 0;'
);

fs.writeFileSync('frontend/src/components/MutualFundDetailsModal.jsx', code, 'utf8');
console.log('Patched MutualFundDetailsModal holdingInvested');

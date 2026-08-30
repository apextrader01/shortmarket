const fs = require('fs');

const path = 'frontend/src/components/MutualFundDetailsModal.jsx';
let code = fs.readFileSync(path, 'utf8');

// Replace {userHolding.quantity.toFixed(2)} with {Number(userHolding.quantity || 0).toFixed(4)}
code = code.replace(
    "{userHolding.quantity.toFixed(2)} Units", 
    "{Number(userHolding.quantity || 0).toFixed(4)} Units"
);

// We should also check if qtyToSell is being used or validated where it might fail
// In actionMode === 'REDEEM'
code = code.replace(
    "let qtyToSell = userHolding.quantity;",
    "let qtyToSell = Number(userHolding.quantity || 0);"
);

code = code.replace(
    "if (qtyToSell > userHolding.quantity)",
    "if (qtyToSell > Number(userHolding.quantity || 0))"
);

fs.writeFileSync(path, code, 'utf8');
console.log("Done");

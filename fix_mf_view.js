const fs = require('fs');

const path = 'frontend/src/components/MutualFundsView.jsx';
let code = fs.readFileSync(path, 'utf8');

// Replace {h.quantity.toFixed(4)} with {Number(h.quantity || 0).toFixed(4)}
code = code.replace(
    /\{h\.quantity\.toFixed\(4\)\}/g,
    "{Number(h.quantity || 0).toFixed(4)}"
);

// Replace {(h.quantity * h.average_price).toFixed(2)} with {(Number(h.quantity || 0) * Number(h.average_price || 0)).toFixed(2)}
code = code.replace(
    /\{\(h\.quantity \* h\.average_price\)\.toFixed\(2\)\}/g,
    "{(Number(h.quantity || 0) * Number(h.average_price || 0)).toFixed(2)}"
);

fs.writeFileSync(path, code, 'utf8');
console.log("Done");

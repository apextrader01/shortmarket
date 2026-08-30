const fs = require('fs');

const path = 'frontend/src/components/MutualFundsView.jsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
    /\{h\.average_price\.toFixed\(2\)\}/g,
    "{Number(h.average_price || 0).toFixed(2)}"
);

fs.writeFileSync(path, code, 'utf8');
console.log("Done");

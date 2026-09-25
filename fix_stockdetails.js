const fs = require('fs');

const path = 'frontend/src/components/StockDetails.jsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
    '<div style={{ flex: 1, overflowY: \'auto\', padding: \'16px\', minWidth: 0, overflowX: \'hidden\' }}>',
    '<div style={{ padding: \'16px\', minWidth: 0, overflowX: \'hidden\' }}>'
);

fs.writeFileSync(path, code, 'utf8');
console.log("Done");

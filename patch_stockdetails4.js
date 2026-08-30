const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/StockDetails.jsx', 'utf8');

code = code.replace(
    '<div style={{ marginTop: \'24px\' }}>',
    '<div style={{ display: \'flex\', flexDirection: \'column\', height: \'100%\', minHeight: 0 }}>'
);

code = code.replace(
    '<div style={{ display: \'flex\', borderBottom: \'1px solid rgba(255,255,255,0.1)\', overflowX: \'auto\', paddingBottom: \'4px\' }}>',
    '<div style={{ display: \'flex\', borderBottom: \'1px solid rgba(255,255,255,0.1)\', overflowX: \'auto\', paddingBottom: \'4px\', flexShrink: 0 }}>'
);

fs.writeFileSync('frontend/src/components/StockDetails.jsx', code, 'utf8');
console.log('StockDetails patched again');

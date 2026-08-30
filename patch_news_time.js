const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/StockDetails.jsx', 'utf8');

code = code.replace(
    /\{new Date\(item\.providerPublishTime \* 1000\)\.toLocaleDateString\(\)\}/g,
    '{new Date(item.providerPublishTime * 1000).toLocaleString(undefined, { day: \'numeric\', month: \'short\', year: \'numeric\', hour: \'2-digit\', minute: \'2-digit\' })}'
);

fs.writeFileSync('frontend/src/components/StockDetails.jsx', code, 'utf8');
console.log('Patched StockDetails.jsx for time');

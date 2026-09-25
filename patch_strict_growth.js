const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

code = code.replace(
    'allMutualFunds = rawData.filter(f => activeCodes.has(String(f.schemeCode)));',
    'allMutualFunds = rawData.filter(f => activeCodes.has(String(f.schemeCode)) && f.schemeName.toLowerCase().includes(\'growth\'));'
);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched strict Growth filter');

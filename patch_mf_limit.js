const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

code = code.replace(
    '// Return ALL matches with basic info (no API calls needed = instant)\n        const results = matches.map(fund => {',
    '// Return TOP 100 matches to prevent overwhelming the frontend\n        const results = matches.slice(0, 100).map(fund => {'
);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched Mutual Funds search limit');

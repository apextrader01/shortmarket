const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const regex = /\/\/\s*Return ALL matches with basic info[^\n]*\n\s*const results = matches\.map\(fund => \{/g;
code = code.replace(regex, `// Return TOP 100 matches to prevent overwhelming the frontend
        const results = matches.slice(0, 100).map(fund => {`);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched Mutual Funds search limit using regex');

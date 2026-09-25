const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

code = code.replace(
  "const isDerivative = !symbol.endsWith('-EQ') && !symbol.endsWith('-INDEX');",
  "const isDerivative = symbol.includes('CE') || symbol.includes('PE') || symbol.includes('FUT');"
);

fs.writeFileSync('backend/server.js', code);
console.log("Fixed isDerivative check in backend/server.js");

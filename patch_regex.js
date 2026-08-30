const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

code = code.replace(
  /symbol\.includes\('CE'\)\s*\|\|\s*symbol\.includes\('PE'\)\s*\|\|\s*symbol\.includes\('FUT'\)/g,
  "/(?:CE|PE|FUT)(?:\\s+(?:NSE|BSE))?$/i.test(symbol)"
);

code = code.replace(
  /item\.symbol\.includes\('CE'\)\s*\|\|\s*item\.symbol\.includes\('PE'\)\s*\|\|\s*item\.symbol\.includes\('FUT'\)/g,
  "/(?:CE|PE|FUT)(?:\\s+(?:NSE|BSE))?$/i.test(item.symbol)"
);

fs.writeFileSync('backend/server.js', code);
console.log("Replaced with regex testing for derivatives");

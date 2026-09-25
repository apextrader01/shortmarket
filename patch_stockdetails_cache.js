const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/StockDetails.jsx', 'utf8');

code = code.replace(
  "fetch(`${API}/api/stocks/${encodeURIComponent(symbol)}/details`)",
  "fetch(`${API}/api/stocks/${encodeURIComponent(symbol)}/details`, { cache: 'no-store' })"
);

fs.writeFileSync('frontend/src/components/StockDetails.jsx', code);
console.log("Added cache: no-store to frontend");

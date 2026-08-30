const fs = require('fs');
let code = fs.readFileSync('backend/services/fyers.js', 'utf8');

code = code.replace(/300000\); \/\/ Poll every 5 minutes/g, "43200000); // Poll every 12 hours (Mutual Funds update NAV daily)");

fs.writeFileSync('backend/services/fyers.js', code);
console.log('Fixed fyers.js MF interval');

const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// Replace imports
content = content.replace(/require\('\.\/services\/angelOne'\)/g, "require('./services/fyers')");

// We need to keep STOCK_MASTER loading in server.js now because fyers.js doesn't have it.
// I will patch server.js manually.
fs.writeFileSync('server.js', content);

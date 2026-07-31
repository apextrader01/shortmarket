const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// Replace angelOne imports for STOCK_MASTER etc with instruments.js
content = content.replace(/const \{ STOCK_MASTER \} = require\('\.\/services\/angelOne'\);/g, "const { STOCK_MASTER } = require('./services/instruments');");
content = content.replace(/const \{ STOCK_MASTER, globalNfoOptions, globalNfoFutures, globalBseSpots \} = require\('\.\/services\/angelOne'\);/g, "const { STOCK_MASTER, globalNfoOptions, globalNfoFutures, globalBseSpots } = require('./services/instruments');");

// Replace the rest of angelOne imports with fyers.js
content = content.replace(/require\('\.\/services\/angelOne'\)/g, "require('./services/fyers')");

// angelOne specific variables in server.js that need renaming
content = content.replace(/loginAngelOne/g, 'initFyers');
content = content.replace(/verifyAngelOneLogin/g, 'verifyFyersAuth');
content = content.replace(/\/api\/admin\/angel-one-login/g, '/api/fyers/auth-url');
content = content.replace(/\/api\/admin\/angel-one-verify/g, '/api/fyers/verify');
content = content.replace(/getDebugState/g, 'getFyersAuthURL'); // Replace unused debug with auth URL

fs.writeFileSync('server.js', content);

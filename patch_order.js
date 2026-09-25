const fs = require('fs');
let code = fs.readFileSync('backend/services/orderExecutor.js', 'utf8');

code = code.replace(/\}, 2000\); \/\/ Check every 2 seconds/g, "}, 60000); // Check every 60 seconds (Fallback only, MARKET orders now instantly execute)");

fs.writeFileSync('backend/services/orderExecutor.js', code);
console.log('Fixed orderExecutor.js interval');

const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

code = code.replace(/\.slice\(0, 10\)/g, ".slice(0, 50)");

fs.writeFileSync('backend/server.js', code);
console.log('Increased batch limit to 50 in backend');

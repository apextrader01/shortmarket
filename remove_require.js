const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

code = code.replace(/const \{ useStore \} = require\('\.\/store'\);\r?\n\s*/g, '');

fs.writeFileSync('frontend/src/App.jsx', code);
console.log("Removed require statements.");

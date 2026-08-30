const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');
content = content.replace('if (!user) {', 'if (false) {');
fs.writeFileSync('src/App.jsx', content);

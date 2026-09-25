const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');
content = content.replace('if (false) {', 'if (false) {');
content = content.replace('const userInterval', 'let mockUser = user || { username: "test", balance: 5000 };\nconst userInterval');
content = content.replace(/user\.username/g, 'mockUser.username');
content = content.replace(/user\.balance/g, 'mockUser.balance');
content = content.replace(/user\.role/g, 'mockUser.role');
fs.writeFileSync('src/App.jsx', content);

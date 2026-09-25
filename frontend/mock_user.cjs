const fs = require('fs');
let content = fs.readFileSync('src/store.js', 'utf8');
content = content.replace('user: null,', 'user: { id: 1, username: "tester", balance: 5000, is_onboarded: true },');
fs.writeFileSync('src/store.js', content);

const fs = require('fs');
const file = 'backend/services/fyers.js';
let content = fs.readFileSync(file, 'utf8');

// Find the setInterval loop for broadcast and change 250 to 1000
content = content.replace('}, 250); // 250ms (4 updates per sec) is the sweet spot to prevent frontend React lag', '}, 1000); // 1000ms (1 update per sec) to drastically save Egress Bandwidth costs for 100k users');

fs.writeFileSync(file, content);

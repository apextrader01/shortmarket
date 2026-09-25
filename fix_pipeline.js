const fs = require('fs');
const file = 'backend/middleware/telemetry.js';
let content = fs.readFileSync(file, 'utf8');

const target = `const p = generalClient.pipeline();`;
const replacement = `const p = generalClient.multi();`;
content = content.replace(target, replacement);

fs.writeFileSync(file, content);

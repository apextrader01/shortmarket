const fs = require('fs');
const file = 'backend/server.js';
let content = fs.readFileSync(file, 'utf8');

const target = `if (!caller || caller.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });`;
const replacement = `if (!caller || !caller.is_admin) return res.status(403).json({ error: 'Unauthorized' });`;
content = content.replace(target, replacement);

fs.writeFileSync(file, content);

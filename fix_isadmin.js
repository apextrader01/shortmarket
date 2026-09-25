const fs = require('fs');
const file = 'backend/server.js';
let content = fs.readFileSync(file, 'utf8');

const target = `app.get('/api/admin/telemetry', authenticateToken, isAdmin, async (req, res) => {`;
const replacement = `app.get('/api/admin/telemetry', authenticateToken, async (req, res) => {
    try {
        const caller = await db('users').where({ id: req.user.id }).first();
        if (!caller || caller.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
`;
content = content.replace(target, replacement);

fs.writeFileSync(file, content);

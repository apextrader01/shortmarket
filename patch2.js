const fs = require('fs');
const file = 'backend/server.js';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
app.post('/api/admin/users/:id/toggle_ban', authenticateToken, async (req, res) => {
  try {
    const db = require('./database/db');
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const targetUserId = req.params.id;
    const targetUser = await db('users').where({ id: targetUserId }).first();
    
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.is_admin) return res.status(403).json({ error: 'Cannot ban another admin' });

    const newStatus = !targetUser.is_banned;
    await db('users').where({ id: targetUserId }).update({ is_banned: newStatus });
    
    res.json({ success: true, message: 'User status updated', is_banned: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const db = require('./database/db');
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const users = await db('users').select('id', 'username', 'balance', 'created_at', 'client_id', 'is_banned').orderBy('created_at', 'desc');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
`;

content = content.replace(/app\.get\('\/api\/admin\/users', authenticateToken, async \(req, res\) => \{[\s\S]*?\}\);/, replacement.trim());
fs.writeFileSync(file, content);

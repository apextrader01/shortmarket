const fs = require('fs');
const file = 'backend/server.js';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
app.post('/api/admin/master_square_off', authenticateToken, async (req, res) => {
  try {
    const caller = await db('users').where({ id: req.user.id }).first();
    if (!caller.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const { runMasterSquareOff } = require('./services/autoSquareOff');
    // Run it asynchronously in the background so it doesn't block the request if there are thousands of positions
    runMasterSquareOff().catch(e => console.error("Master square off failed:", e));
    
    res.json({ success: true, message: 'Master Square-Off initiated in the background' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users'`;

content = content.replace("app.get('/api/admin/users'", replacement);
fs.writeFileSync(file, content);

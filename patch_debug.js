const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const route = `
app.get('/api/debug-db', async (req, res) => {
    try {
        const columns = await db('users').columnInfo();
        res.json(columns);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
`;

if (!code.includes('/api/debug-db')) {
    code = code.replace("app.get('/api/user'", route + "\napp.get('/api/user'");
    fs.writeFileSync('backend/server.js', code, 'utf8');
}
console.log("Debug route added");

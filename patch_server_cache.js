const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

code = code.replace(
  "app.get('/api/stocks/:symbol/details', async (req, res) => {",
  "app.get('/api/stocks/:symbol/details', async (req, res) => {\n  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');"
);

fs.writeFileSync('backend/server.js', code);
console.log("Added Cache-Control to backend");

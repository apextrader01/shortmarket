const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

code = code.replace(/app\.use\(express\.json\(\)\);/, "app.use(express.json({ limit: '10mb' }));\napp.use(express.urlencoded({ limit: '10mb', extended: true }));");

fs.writeFileSync('backend/server.js', code);
console.log("Updated Express JSON limits.");

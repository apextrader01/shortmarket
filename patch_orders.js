const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const regex = /const orders = await db\('orders'\)\.where\(\{ user_id: req\.user\.id \}\)\.orderBy\('created_at', 'desc'\);/g;
const replacement = "const orders = await db('orders').where({ user_id: req.user.id }).orderBy('created_at', 'desc').limit(150);";

code = code.replace(regex, replacement);

fs.writeFileSync('backend/server.js', code);
console.log('Successfully added .limit(150) to /api/orders');

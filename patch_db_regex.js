const fs = require('fs');
let code = fs.readFileSync('backend/database/db.js', 'utf8');

const regex = /pool:\s*\{\s*min:\s*2,\s*max:\s*10\s*\}/m;

const newCode = `pool: { 
    min: 2, 
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 10,
    idleTimeoutMillis: 30000,
    createTimeoutMillis: 3000,
    acquireTimeoutMillis: 30000,
    propagateCreateError: false
  }`;

if (regex.test(code)) {
    code = code.replace(regex, newCode);
    fs.writeFileSync('backend/database/db.js', code);
    console.log('Successfully patched db.js using regex');
} else {
    console.log('Regex did not match!');
}

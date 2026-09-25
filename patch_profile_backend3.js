const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

code = code.replace(
    /\/\/\s*Insert profile data\s*await db\('user_profiles'\)\.insert\(\{/,
    "// Delete existing to avoid conflicts\n    await db('user_profiles').where({ user_id: req.user.id }).del();\n\n    // Insert profile data\n    await db('user_profiles').insert({"
);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Patched backend saveProfile using regex');

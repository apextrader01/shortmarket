const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

const regex = /if \(isMaster\) \{\s*console\.log\([^)]+\);/m;
const match = code.match(regex);

if (match) {
    const replacement = match[0] + `\n
      // Daily Garbage Collector: Wipe dead positions from yesterday
      db('positions').where({ quantity: 0 }).delete()
        .then(count => console.log(\`[DB MAINTENANCE] Cleared \${count} dead positions (qty=0) on startup.\`))
        .catch(err => console.error('Failed to run position garbage collector:', err));\n`;
    
    code = code.replace(regex, replacement);
    fs.writeFileSync('backend/server.js', code);
    console.log('Successfully injected DB Garbage Collector');
} else {
    console.log('Could not find injection point');
}

const fs = require('fs');
let code = fs.readFileSync('backend/database/db.js', 'utf8');

const oldConfig = `const dbConfig = {
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost:5432/dummy',
  pool: { min: 2, max: 10 }
};`;

const newConfig = `const dbConfig = {
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost:5432/dummy',
  pool: { 
    min: 2, 
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 10,
    idleTimeoutMillis: 30000,      // Reaper: Closes ghost connections that sit idle for 30s
    createTimeoutMillis: 3000,     // Fails fast if the DB is struggling, rather than hanging
    acquireTimeoutMillis: 30000,   // Wait up to 30s for a free connection before rejecting
    propagateCreateError: false    // Prevents Node.js from crashing entirely on connection failure
  }
};`;

code = code.replace(oldConfig, newConfig);
fs.writeFileSync('backend/database/db.js', code);
console.log('Patched db.js with advanced connection pool settings');

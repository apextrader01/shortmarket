const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Locate .env
const possiblePaths = [
  path.resolve(__dirname, '../.env'),
  '/opt/shortmarket-staging/backend/.env',
  path.resolve(__dirname, '../../.env')
];

let envPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    envPath = p;
    break;
  }
}

if (!envPath) {
  console.error('❌ Could not locate backend/.env file!');
  process.exit(1);
}

console.log(`📁 Found .env at: ${envPath}`);
require('dotenv').config({ path: envPath });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL is not set in ' + envPath);
  process.exit(1);
}

// 2. Parse DATABASE_URL
let u;
try {
  u = new URL(dbUrl.trim().replace(/^["']|["']$/g, ''));
} catch (e) {
  console.error('❌ Failed to parse DATABASE_URL: ' + e.message);
  process.exit(1);
}

const dbUser = decodeURIComponent(u.username);
const dbPass = decodeURIComponent(u.password);
const dbName = u.pathname.replace(/^\//, '');

console.log(`👤 Database User:     ${dbUser}`);
console.log(`🗄️  Database Name:     ${dbName}`);
console.log(`🔑 Database Password: ${'*'.repeat(Math.min(dbPass.length, 12))}`);

// 3. Execute SQL via sudo -u postgres psql
console.log('\n⚙️  Applying user credentials and permissions to PostgreSQL...');

const sqlCommands = `
DO \\$\\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${dbUser}') THEN
      CREATE USER "${dbUser}" WITH PASSWORD '${dbPass}';
   ELSE
      ALTER USER "${dbUser}" WITH PASSWORD '${dbPass}';
   END IF;
END
\\$\\$;

SELECT 'CREATE DATABASE "${dbName}" OWNER "${dbUser}"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${dbName}')\\gexec

GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}";
ALTER DATABASE "${dbName}" OWNER TO "${dbUser}";
`;

try {
  execSync('sudo -u postgres psql', {
    input: sqlCommands,
    stdio: ['pipe', 'inherit', 'inherit']
  });
  console.log('\n✅ PostgreSQL credentials synchronized successfully!');
} catch (err) {
  console.error('\n❌ Failed to execute psql commands: ' + err.message);
  console.log('\nYou can manually set the password in PostgreSQL by running:');
  console.log(`sudo -u postgres psql -c "ALTER USER \\"${dbUser}\\" WITH PASSWORD '${dbPass}';"`);
  process.exit(1);
}

// 4. Verify connection using knex
console.log('\n🧪 Testing connection using Knex...');
const knex = require('knex');
const db = knex({
  client: 'pg',
  connection: dbUrl,
  pool: { min: 1, max: 2, acquireTimeoutMillis: 5000 }
});

db.raw('SELECT current_user, current_database();')
  .then(res => {
    const row = res.rows ? res.rows[0] : res[0];
    console.log(`🎉 Connection VERIFIED! Connected as: ${JSON.stringify(row)}`);
    return db.destroy();
  })
  .then(() => {
    console.log('\n🚀 Now you can safely run:');
    console.log('   node backend/scripts/migrate_columns.js');
    console.log('   pm2 restart all');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection verification test failed: ' + err.message);
    db.destroy();
    process.exit(1);
  });

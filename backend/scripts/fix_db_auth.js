const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('🔧 PostgreSQL Credentials & Database Self-Healing');
console.log('====================================================\n');

// 1. Locate .env
const possiblePaths = [
  path.resolve(__dirname, '../.env'),
  '/opt/shortmarket-staging/backend/.env',
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env')
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

console.log(`📁 Using .env file: ${envPath}`);
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
console.log(`🔑 Database Password: ${'*'.repeat(Math.min(dbPass.length, 16))}\n`);

function runPsql(sql, desc) {
  try {
    console.log(`⏳ ${desc}...`);
    execSync(`sudo -u postgres psql -c "${sql.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    console.log(`   ✔ Success`);
    return true;
  } catch (err) {
    console.warn(`   ⚠️ Notice: ${err.message}`);
    return false;
  }
}

// 3. Make sure PostgreSQL service is running
try {
  execSync('sudo systemctl start postgresql', { stdio: 'ignore' });
} catch (e) {}

// 4. Create or Alter User
const alterOk = runPsql(`ALTER USER "${dbUser}" WITH PASSWORD '${dbPass}';`, `Setting password for user "${dbUser}"`);
if (!alterOk) {
  runPsql(`CREATE USER "${dbUser}" WITH PASSWORD '${dbPass}';`, `Creating user "${dbUser}" with password`);
}

// 5. Create Database if not exists
try {
  const checkDb = execSync(`sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${dbName}';"`, { encoding: 'utf8' }).trim();
  if (checkDb !== '1') {
    runPsql(`CREATE DATABASE "${dbName}" OWNER "${dbUser}";`, `Creating database "${dbName}"`);
  } else {
    console.log(`🗄️  Database "${dbName}" already exists.`);
  }
} catch (e) {
  runPsql(`CREATE DATABASE "${dbName}" OWNER "${dbUser}";`, `Attempting to create database "${dbName}"`);
}

// 6. Grant Permissions
runPsql(`GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}";`, `Granting privileges on "${dbName}" to "${dbUser}"`);
runPsql(`ALTER DATABASE "${dbName}" OWNER TO "${dbUser}";`, `Setting owner of "${dbName}" to "${dbUser}"`);

// 7. Test connection with knex
console.log('\n🧪 Testing connection using Knex...');
const knex = require('knex');
const testDb = knex({
  client: 'pg',
  connection: dbUrl,
  pool: { min: 1, max: 2, acquireTimeoutMillis: 5000, propagateCreateError: true }
});

testDb.raw('SELECT current_user, current_database(), version();')
  .then(res => {
    const row = res.rows ? res.rows[0] : res[0];
    console.log('\n====================================================');
    console.log(`🎉 CONNECTION VERIFIED!`);
    console.log(`   Connected user: ${row.current_user}`);
    console.log(`   Database:       ${row.current_database}`);
    console.log('====================================================\n');
    return testDb.destroy();
  })
  .then(() => {
    console.log('🚀 Next Steps:');
    console.log('   1. node backend/scripts/migrate_columns.js');
    console.log('   2. pm2 restart all\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Connection test failed: ' + err.message);
    testDb.destroy();
    process.exit(1);
  });

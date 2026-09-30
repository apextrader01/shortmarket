const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n======================================================================');
console.log('🔬 TEST SUITE: STORAGE, DISK & MEMORY OPTIMIZATIONS (10L USERS SCALE)');
console.log('======================================================================\n');

let passCount = 0;
let totalCount = 0;

function test(name, fn) {
    totalCount++;
    try {
        fn();
        console.log(`  ✔ [PASS] ${name}`);
        passCount++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    }
}

// Module 1: File Clutter & Obsolete Storage Elimination
console.log('▶ MODULE 1: Local Disk Clutter Elimination');

test('options.json.bak (15.58 MB) is completely deleted', () => {
    const bakFile = path.join(__dirname, 'database', 'options.json.bak');
    assert.strictEqual(fs.existsSync(bakFile), false, 'options.json.bak should not exist on disk');
});

test('root stocks.json (3.67 MB duplicate) is deleted', () => {
    const rootStocks = path.join(__dirname, '..', 'stocks.json');
    assert.strictEqual(fs.existsSync(rootStocks), false, 'root stocks.json should not exist');
});

test('canonical backend/database/stocks.json is intact and valid', () => {
    const canonicalStocks = path.join(__dirname, 'database', 'stocks.json');
    assert.strictEqual(fs.existsSync(canonicalStocks), true, 'backend/database/stocks.json must exist');
    const data = JSON.parse(fs.readFileSync(canonicalStocks, 'utf8'));
    assert.ok(Array.isArray(data) && data.length > 100, 'Canonical stocks list must be a non-empty array');
});

test('backend/logs does not contain ancient stale logs (> 7 days)', () => {
    const logsDir = path.join(__dirname, 'logs');
    if (fs.existsSync(logsDir)) {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const files = fs.readdirSync(logsDir);
        for (const file of files) {
            if (file.endsWith('.log') || file.endsWith('.gz')) {
                const stat = fs.statSync(path.join(logsDir, file));
                assert.ok(stat.mtimeMs >= sevenDaysAgo, `Found ancient log file that should have been purged: ${file}`);
            }
        }
    }
});

// Module 2: Watchlist Memory Cursor Batching & Scaling
console.log('\n▶ MODULE 2: Watchlist Cleanup Memory Streaming / Cursor Pagination');

test('cronJobs.js implements cursor pagination batching (batchSize = 500)', () => {
    const cronContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');
    assert.ok(cronContent.includes('const batchSize = 500;'), 'Must define batchSize of 500');
    assert.ok(cronContent.includes("where('id', '>', lastUserId)"), 'Must use indexed cursor pagination on user id');
    assert.ok(!cronContent.includes("const users = await db('users').whereNotNull('watchlists');"), 'Must not load all users into memory at once');
});

test('cronJobs.js cleans expired reset_otp and login_email_otp', () => {
    const cronContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');
    assert.ok(cronContent.includes('reset_otp_expires'), 'Must clean up expired reset OTPs');
    assert.ok(cronContent.includes('login_email_otp_expires'), 'Must clean up expired login email OTPs');
});

test('cronJobs.js has automated 7-day log purge logic', () => {
    const cronContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');
    assert.ok(cronContent.includes('sevenDaysAgo') && cronContent.includes('purgedLogCount'), 'Must include automated log purge logic');
});

// Module 3: Database Indexing & Autovacuum Tuning for PostgreSQL
console.log('\n▶ MODULE 3: Database Indexing & Autovacuum Tuning');

test('db.js configures autovacuum scale factor for orders, positions, and ledger', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.05'), 'orders must have autovacuum scale factor 0.05');
    assert.ok(dbContent.includes('ALTER TABLE positions SET (autovacuum_vacuum_scale_factor = 0.05'), 'positions must have autovacuum scale factor 0.05');
    assert.ok(dbContent.includes('ALTER TABLE ledger SET (autovacuum_vacuum_scale_factor = 0.05'), 'ledger must have autovacuum scale factor 0.05');
});

test('db.js has composite indexes on orders_archive to accelerate historical reporting', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('idx_orders_archive_created'), 'Must index orders_archive on created_at');
    assert.ok(dbContent.includes('idx_orders_archive_symbol'), 'Must index orders_archive on symbol');
    assert.ok(dbContent.includes('idx_orders_archive_user_id'), 'Must index orders_archive on user_id');
});

// Module 4: Order Lifecycle & Archival Engine
console.log('\n▶ MODULE 4: Order Lifecycle & Archival Engine');

test('runOrderLifecycleArchive archives orders in 1000-row batches', () => {
    const cronContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');
    assert.ok(cronContent.includes('runOrderLifecycleArchive'), 'Must define runOrderLifecycleArchive');
    assert.ok(cronContent.includes('const batchSize = 1000;'), 'Must archive in batches of 1000');
    assert.ok(cronContent.includes("status: 'EXECUTED'"), 'Must archive executed orders');
    assert.ok(cronContent.includes("del()"), 'Must delete archived and cancelled orders from active table');
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalCount} | PASSED: ${passCount} | FAILED: ${totalCount - passCount}`);
console.log('======================================================================');

if (passCount === totalCount) {
    console.log('🎉 ALL STORAGE, DISK & MEMORY OPTIMIZATION CHECKS PASSED PERFECTLY!\n');
    process.exit(0);
} else {
    console.error('❌ SOME CHECKS FAILED!\n');
    process.exit(1);
}

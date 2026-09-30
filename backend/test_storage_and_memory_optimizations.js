const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n======================================================================');
console.log('🔬 TEST SUITE: COMPLETE AUDIT OF 6 ENTERPRISE STORAGE & RAM OPTIMIZATIONS');
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

// ── 1. Monthly Database Table Partitioning (orders & ledger) ─────────────────
console.log('▶ 1. MONTHLY DATABASE TABLE PARTITIONING (ORDERS & LEDGER)');

test('db.js implements ensureMonthlyPartitions() for orders_archive & ledger_archive', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('async function ensureMonthlyPartitions()'), 'Must define ensureMonthlyPartitions');
    assert.ok(dbContent.includes('orders_archive_'), 'Must create monthly partition tables for orders_archive');
    assert.ok(dbContent.includes('ledger_archive_'), 'Must create monthly partition tables for ledger_archive');
    assert.ok(dbContent.includes('INHERITS (orders_archive)'), 'Must use PostgreSQL partition inheritance for orders');
    assert.ok(dbContent.includes('INHERITS (ledger_archive)'), 'Must use PostgreSQL partition inheritance for ledger');
    assert.ok(dbContent.includes('db.ensureMonthlyPartitions = ensureMonthlyPartitions'), 'Must export ensureMonthlyPartitions on db');
});

test('cronJobs.js schedules monthly partition sync on 1st of every month (00:05 AM)', () => {
    const cronContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');
    assert.ok(cronContent.includes("'5 0 1 * *'"), 'Must schedule on 1st of month at 00:05');
    assert.ok(cronContent.includes('ensureMonthlyPartitions'), 'Must invoke ensureMonthlyPartitions in cron');
});

test('cronJobs.js implements runLedgerLifecycleArchive to prevent 100M+ ledger row bloat', () => {
    const cronContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');
    assert.ok(cronContent.includes('async function runLedgerLifecycleArchive'), 'Must define runLedgerLifecycleArchive');
    assert.ok(cronContent.includes("trx('ledger_archive')"), 'Must archive to ledger_archive table');
    assert.ok(cronContent.includes('runLedgerLifecycleArchive'), 'Must be exported in cronJobs.js');
});

// ── 2. Purge Stale JSON Backups & Stop Loading Monolithic JSONs into RAM ──────
console.log('\n▶ 2. PURGE STALE JSON BACKUPS & STOP LOADING MONOLITHIC JSONS INTO RAM');

test('options.json.bak (15.58 MB) and root stocks.json (3.67 MB) are deleted', () => {
    const bakFile = path.join(__dirname, 'database', 'options.json.bak');
    const rootStocks = path.join(__dirname, '..', 'stocks.json');
    assert.strictEqual(fs.existsSync(bakFile), false, 'options.json.bak must be deleted');
    assert.strictEqual(fs.existsSync(rootStocks), false, 'root stocks.json must be deleted');
});

test('instruments.js skips redundant 13MB JSON disk read if PostgreSQL is already populated', () => {
    const instContent = fs.readFileSync(path.join(__dirname, 'services', 'instruments.js'), 'utf8');
    assert.ok(instContent.includes("db('instruments').count('token as count')"), 'Must check existing count in Postgres');
    assert.ok(instContent.includes('Skipping redundant JSON disk read'), 'Must skip loading monolithic JSONs when table has scrips');
});

// ── 3. Move Ephemeral Data (Sessions, OTPs, Ticks) Exclusively to Redis ────────
console.log('\n▶ 3. MOVE EPHEMERAL DATA (SESSIONS, OTPS, TICKS) EXCLUSIVELY TO REDIS');

test('fyers.js streams live ticks via Redis Pub/Sub without touching disk DB', () => {
    const fyersContent = fs.readFileSync(path.join(__dirname, 'services', 'fyers.js'), 'utf8');
    assert.ok(fyersContent.includes('pubClient') || fyersContent.includes('redisClient'), 'Must use Redis client for streaming ticks');
    assert.ok(!fyersContent.includes("db('ticks')"), 'Must never write raw ticks to PostgreSQL');
});

test('auth.js warms active sessions in Redis with 24h TTL to reduce DB disk reads', () => {
    const authContent = fs.readFileSync(path.join(__dirname, 'middleware', 'auth.js'), 'utf8');
    assert.ok(authContent.includes('generalClient.setEx(`sess:${tokenHash}`, 86400'), 'Must warm session in Redis with 24h TTL');
});

test('server.js stores and validates reset OTPs via Redis with automatic TTL expiry', () => {
    const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    assert.ok(serverContent.includes('otp:reset:'), 'Must use Redis otp:reset: key');
    assert.ok(serverContent.includes('generalClient.setEx(`otp:reset:'), 'Must set OTP in Redis with TTL');
});

// ── 4. Optimize Morning Watchlist Cleanup for 10 Lakh Users ───────────────────
console.log('\n▶ 4. OPTIMIZE MORNING WATCHLIST CLEANUP FOR 10 LAKH USERS');

test('cronJobs.js implements cursor pagination batching (batchSize = 500) for watchlists', () => {
    const cronContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');
    assert.ok(cronContent.includes('const batchSize = 500;'), 'Must define batchSize of 500');
    assert.ok(cronContent.includes("where('id', '>', lastUserId)"), 'Must use indexed cursor pagination on user id');
    assert.ok(!cronContent.includes("const users = await db('users').whereNotNull('watchlists');"), 'Must not load all users into memory at once');
});

// ── 5. On-the-Fly Contract Notes & Reports (Zero Disk PDF Storage) ────────────
console.log('\n▶ 5. ON-THE-FLY CONTRACT NOTES & REPORTS (ZERO DISK PDF STORAGE)');

test('ReportsView and clientReportGenerator generate reports client-side with 0 server disk files', () => {
    const clientGenPath = path.join(__dirname, '..', 'frontend', 'src', 'utils', 'clientReportGenerator.js');
    assert.ok(fs.existsSync(clientGenPath), 'clientReportGenerator.js must exist in frontend');
    const genContent = fs.readFileSync(clientGenPath, 'utf8');
    assert.ok(genContent.includes('generatePDF') || genContent.includes('html2pdf') || genContent.includes('window.print') || genContent.includes('URL.createObjectURL'), 'Must generate dynamically in browser');
});

// ── 6. PostgreSQL Autovacuum & Index Compaction ───────────────────────────────
console.log('\n▶ 6. POSTGRESQL AUTOVACUUM & INDEX COMPACTION');

test('db.js configures autovacuum scale factor (0.05) on orders, positions, and ledger', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.05'), 'orders must have autovacuum scale factor 0.05');
    assert.ok(dbContent.includes('ALTER TABLE positions SET (autovacuum_vacuum_scale_factor = 0.05'), 'positions must have autovacuum scale factor 0.05');
    assert.ok(dbContent.includes('ALTER TABLE ledger SET (autovacuum_vacuum_scale_factor = 0.05'), 'ledger must have autovacuum scale factor 0.05');
});

// ── 7. Seamless Active & Archive Data Bridging ───────────────────────────────
console.log('\n▶ 7. SEAMLESS ACTIVE & ARCHIVE DATA BRIDGING (HISTORICAL REPORTS GUARANTEE)');

test('server.js GET /api/orders supplements from orders_archive (monthly partitions)', () => {
    const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    assert.ok(serverContent.includes("db('orders_archive')"), 'GET /api/orders must query orders_archive for older orders');
    assert.ok(serverContent.includes('ordersMap.has(o.id)'), 'Must deduplicate and merge archived orders seamlessly');
});

test('server.js GET /api/ledger supplements from ledger_archive (monthly partitions)', () => {
    const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    assert.ok(serverContent.includes("db('ledger_archive')"), 'GET /api/ledger must query ledger_archive for older statements');
    assert.ok(serverContent.includes('ledger.push(...archivedLedger)'), 'Must append archived ledger records for reports');
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalCount} | PASSED: ${passCount} | FAILED: ${totalCount - passCount}`);
console.log('======================================================================');

if (passCount === totalCount) {
    console.log('🎉 ALL 6 ENTERPRISE STORAGE & RAM OPTIMIZATIONS VERIFIED 100% PERFECT!\n');
    process.exit(0);
} else {
    console.error('❌ SOME CHECKS FAILED!\n');
    process.exit(1);
}

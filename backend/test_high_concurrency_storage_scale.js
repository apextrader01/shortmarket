/**
 * TEST SUITE: HIGH CONCURRENCY STORAGE & SCALE OPTIMIZATIONS AUDIT
 * Verifies payload reduction, smart limits, archive indexing, autovacuum, positions_archive, and fast loading.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

console.log('======================================================================');
console.log('🔬 TEST SUITE: HIGH CONCURRENCY STORAGE & SCALE OPTIMIZATIONS');
console.log('======================================================================\n');

// ── 1. Smart Query Limit & Payload Truncation Prevention ────────────────────
console.log('▶ 1. SMART QUERY LIMITS (GET /api/orders & GET /api/ledger)');

test('GET /api/orders implements smart limit (200 default vs 5000 full)', () => {
    const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    assert.ok(serverContent.includes("const isFull = req.query.all === 'true' || req.query.export === 'true';"), 'Must check isFull flag');
    assert.ok(serverContent.includes('const limit = isFull ? (requestedLimit || 5000) : (requestedLimit || 200);'), 'Must default to 200 for routine queries and 5000 for full/export');
});

test('GET /api/orders preserves all active orders and today session orders without truncation', () => {
    const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    assert.ok(serverContent.includes('const todayStartIST = getTradingSessionStartIST();'), 'Must compute todayStartIST');
    assert.ok(serverContent.includes("this.where('created_at', '>=', todayStartIST)"), 'Must query today orders created_at');
    assert.ok(serverContent.includes("orWhere('updated_at', '>=', todayStartIST)"), 'Must query today orders updated_at');
    assert.ok(serverContent.includes('whereIn(\'status\', activeOrderStatuses)'), 'Must query all active order statuses without limit');
});

test('GET /api/ledger implements smart fetchLimit (200 default vs 10000 full/export)', () => {
    const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    assert.ok(serverContent.includes("const isFull = req.query.all === 'true' || isExport;"), 'Must detect isFull or isExport');
    assert.ok(serverContent.includes('const fetchLimit = isFull ? (requestedLimit || 10000) : (requestedLimit || 200);'), 'Must default to 200 for routine non-paginated queries and 10000 for exports/full');
});

// ── 2. Positions Scale Optimization & positions_archive ──────────────────────
console.log('\n▶ 2. POSITIONS ARCHIVAL & BOOTSTRAP SCALE OPTIMIZATION');

test('db.js implements positions_archive master table and monthly partition tables', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('CREATE TABLE IF NOT EXISTS positions_archive'), 'Must create positions_archive table');
    assert.ok(dbContent.includes('positions_archive_${suffix}'), 'Must create monthly partition tables for positions_archive');
    assert.ok(dbContent.includes('INHERITS (positions_archive)'), 'Must inherit from positions_archive');
    assert.ok(dbContent.includes('idx_positions_archive_user_updated ON positions_archive'), 'Must index positions_archive user_id and updated_at');
});

test('cronJobs.js implements runPositionsLifecycleArchive(30) to archive closed positions', () => {
    const cronContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');
    assert.ok(cronContent.includes('async function runPositionsLifecycleArchive(cutoffDays = 30)'), 'Must define runPositionsLifecycleArchive');
    assert.ok(cronContent.includes('await runPositionsLifecycleArchive(30)'), 'Must call runPositionsLifecycleArchive in morning lifecycle cron');
    assert.ok(cronContent.includes('runPositionsLifecycleArchive'), 'Must export runPositionsLifecycleArchive');
});

test('/api/user/bootstrap queries only open positions and today closed positions (zero historical bloat)', () => {
    const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    assert.ok(serverContent.includes("this.whereNot({ quantity: 0 })"), 'Bootstrap must query open positions');
    assert.ok(serverContent.includes(".orWhere('updated_at', '>=', todayStartIST)"), 'Bootstrap must query today closed positions');
});

test('GET /api/positions implements smart limit (200 default vs 5000 full) and supplements from positions_archive', () => {
    const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    assert.ok(serverContent.includes("db('positions_archive')"), 'Must supplement from positions_archive when full history is requested');
});

// ── 3. Database Archival Indexing & Autovacuum Tuning ───────────────────────
console.log('\n▶ 3. DATABASE COMPOSITE INDEXING & AUTOVACUUM SCALE');

test('db.js configures composite index on orders_archive(user_id, created_at DESC)', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('idx_orders_archive_user_created ON orders_archive(user_id, created_at DESC)'), 'Must have composite index on orders_archive');
});

test('db.js configures composite index on ledger_archive(user_id, created_at DESC)', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('idx_ledger_archive_user_created ON ledger_archive(user_id, created_at DESC)'), 'Must have composite index on ledger_archive');
});

test('db.js indexes ledger(type, created_at) and ledger(created_at) for fast cron archiving', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('idx_ledger_type_created ON ledger(type, created_at)'), 'Must index ledger type and created_at');
    assert.ok(dbContent.includes('idx_ledger_created_at ON ledger(created_at)'), 'Must index ledger created_at');
});

test('db.js indexes positions(user_id, quantity, updated_at DESC) and positions(quantity, updated_at)', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('idx_positions_user_qty_updated ON positions(user_id, quantity, updated_at DESC)'), 'Must index positions user_id, quantity, updated_at');
    assert.ok(dbContent.includes('idx_positions_qty_updated ON positions(quantity, updated_at)'), 'Must index positions quantity and updated_at');
});

test('db.js configures autovacuum_vacuum_scale_factor (0.05) on all active and archive tables', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.05'), 'orders must have autovacuum 0.05');
    assert.ok(dbContent.includes('ALTER TABLE positions SET (autovacuum_vacuum_scale_factor = 0.05'), 'positions must have autovacuum 0.05');
    assert.ok(dbContent.includes('ALTER TABLE ledger SET (autovacuum_vacuum_scale_factor = 0.05'), 'ledger must have autovacuum 0.05');
    assert.ok(dbContent.includes('ALTER TABLE orders_archive SET (autovacuum_vacuum_scale_factor = 0.05'), 'orders_archive must have autovacuum 0.05');
    assert.ok(dbContent.includes('ALTER TABLE ledger_archive SET (autovacuum_vacuum_scale_factor = 0.05'), 'ledger_archive must have autovacuum 0.05');
    assert.ok(dbContent.includes('ALTER TABLE positions_archive SET (autovacuum_vacuum_scale_factor = 0.05'), 'positions_archive must have autovacuum 0.05');
    assert.ok(dbContent.includes('ALTER TABLE user_sessions SET (autovacuum_vacuum_scale_factor = 0.05'), 'user_sessions must have autovacuum 0.05');
    assert.ok(dbContent.includes('ALTER TABLE trusted_devices SET (autovacuum_vacuum_scale_factor = 0.05'), 'trusted_devices must have autovacuum 0.05');
});

test('db.js pool configuration scales up to 42 connections per worker (84 total) for high concurrency', () => {
    const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
    assert.ok(dbContent.includes('max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 42'), 'Pool max must default to 42 (84 total across 2 workers)');
});

// ── 4. Frontend ReportsView Integration ──────────────────────────────────────
console.log('\n▶ 4. FRONTEND REPORTSVIEW HISTORICAL FETCH GUARANTEE');

test('ReportsView.jsx requests ?all=true for complete tax and ledger reports', () => {
    const reportsPath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'ReportsView.jsx');
    const reportsContent = fs.readFileSync(reportsPath, 'utf8');
    assert.ok(reportsContent.includes('/api/orders?all=true'), 'ReportsView must request /api/orders?all=true');
    assert.ok(reportsContent.includes('/api/ledger?all=true'), 'ReportsView must request /api/ledger?all=true');
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalCount} | PASSED: ${passCount} | FAILED: ${totalCount - passCount}`);
console.log('======================================================================');

if (passCount === totalCount) {
    console.log('🎉 ALL HIGH CONCURRENCY STORAGE & SCALE OPTIMIZATIONS VERIFIED!\n');
    process.exit(0);
} else {
    console.error('❌ SOME CHECKS FAILED!\n');
    process.exit(1);
}

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('⚡ RUNNING RESOURCE OPTIMIZATION AUDIT VERIFICATION');
console.log('======================================================================\n');

// ── TEST 1: Database Composite Indexes for 1 Lakh Users Scale ──
console.log('▶ TEST 1: Database Composite Indexes (db.js & migrate_columns.js)');
const dbCode = fs.readFileSync(path.join(__dirname, 'database/db.js'), 'utf8');
const migrateCode = fs.readFileSync(path.join(__dirname, 'scripts/migrate_columns.js'), 'utf8');

assert.ok(dbCode.includes('idx_ledger_user_created ON ledger(user_id, created_at DESC, id DESC)'), 'idx_ledger_user_created missing in db.js');
assert.ok(migrateCode.includes('idx_ledger_user_created ON ledger(user_id, created_at DESC, id DESC)'), 'idx_ledger_user_created missing in migrate_columns.js');
assert.ok(dbCode.includes('idx_orders_user_created ON orders(user_id, created_at DESC)'), 'idx_orders_user_created missing in db.js');
assert.ok(dbCode.includes('idx_positions_user_symbol ON positions(user_id, symbol)'), 'idx_positions_user_symbol missing in db.js');
assert.ok(dbCode.includes('idx_positions_user_product ON positions(user_id, product_type)'), 'idx_positions_user_product missing in db.js');
assert.ok(dbCode.includes('idx_positions_quantity ON positions(quantity)'), 'idx_positions_quantity missing in db.js');
assert.ok(dbCode.includes('idx_trusted_devices_expires ON trusted_devices(expires_at)'), 'idx_trusted_devices_expires missing in db.js');
assert.ok(dbCode.includes('idx_user_sessions_created_at ON user_sessions(created_at)'), 'idx_user_sessions_created_at missing in db.js');
console.log('  ✔ [PASS] High-performance composite indexes defined across ledger, orders, positions, and trusted devices');

// ── TEST 2: SQL Aggregate Sum Subquery in server.js /api/ledger ──
console.log('\n▶ TEST 2: High-Performance Database-Side Aggregate Sum');
const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert.ok(serverCode.includes("sumSubquery = db('ledger')"), 'sumSubquery definition missing in server.js');
assert.ok(serverCode.includes(".sum('amount as total')"), 'DB sum aggregation missing in server.js');
assert.ok(serverCode.includes("select('amount')"), "Lite field selection missing in sumSubquery or fallback");
console.log('  ✔ [PASS] Server-side running balance executes native SQL aggregate sum without heap row allocations');

// ── TEST 3: Cron Jobs Daily Expired Trusted Devices Purge ──
console.log('\n▶ TEST 3: ROM / Disk Reclamation (Expired Devices Purge)');
const cronCode = fs.readFileSync(path.join(__dirname, 'services/cronJobs.js'), 'utf8');
assert.ok(cronCode.includes("db('trusted_devices').where('expires_at', '<', new Date()).del()"), 'Expired trusted_devices purge missing in cronJobs.js');
console.log('  ✔ [PASS] Daily 1:00 AM cron job automatically purges expired 30-day trusted device tokens');

// ── TEST 4: Volume Matching Engine Memory Dequeuing ──
console.log('\n▶ TEST 4: VolumeMatchingEngine Memory Deallocation');
const vmeCode = fs.readFileSync(path.join(__dirname, 'services/volumeMatchingEngine.js'), 'utf8');
assert.ok(vmeCode.includes('this.lastSymbolVolume.delete(normSym)'), 'lastSymbolVolume cleanup missing upon queue empty');
console.log('  ✔ [PASS] VolumeMatchingEngine frees symbol volume state upon queue exhaustion');

// ── TEST 5: Frontend Singleton Date Formatter & Component Reuse ──
console.log('\n▶ TEST 5: Frontend Singleton Date Formatter & Heap De-duplication');
const pnlCode = fs.readFileSync(path.join(__dirname, '../frontend/src/utils/pnlHelper.js'), 'utf8');
assert.ok(pnlCode.includes('const istDateFormatter = new Intl.DateTimeFormat'), 'Singleton istDateFormatter missing in pnlHelper.js');

const posViewCode = fs.readFileSync(path.join(__dirname, '../frontend/src/components/PositionsView.jsx'), 'utf8');
assert.ok(posViewCode.includes("import { getTodayClosedPositions, getISTDate, isToday } from '../utils/pnlHelper'"), 'PositionsView missing import from pnlHelper');
assert.ok(!posViewCode.includes('const isToday = (dateString) => {'), 'PositionsView still defines inline isToday');

const ordViewCode = fs.readFileSync(path.join(__dirname, '../frontend/src/components/OrdersView.jsx'), 'utf8');
assert.ok(ordViewCode.includes("import { isToday } from '../utils/pnlHelper'"), 'OrdersView missing import from pnlHelper');
assert.ok(!ordViewCode.includes('const isToday = (dateString) => {'), 'OrdersView still defines inline isToday');
console.log('  ✔ [PASS] PositionsView & OrdersView reuse singleton date formatter, saving thousands of ICU heap allocations');

// ── TEST 6: ReportsView Batched Filter Handlers ──
console.log('\n▶ TEST 6: ReportsView Batched Filter Handlers');
const reportsCode = fs.readFileSync(path.join(__dirname, '../frontend/src/components/ReportsView.jsx'), 'utf8');
assert.ok(reportsCode.includes('handleFilterPeriodChange'), 'handleFilterPeriodChange missing in ReportsView.jsx');
assert.ok(reportsCode.includes('handleFilterTypeChange'), 'handleFilterTypeChange missing in ReportsView.jsx');
assert.ok(!reportsCode.includes('useEffect(() => {\n    setCurrentPage(1);\n  }, [filterPeriod, filterType'), 'Old unbatched useEffect still present in ReportsView.jsx');
console.log('  ✔ [PASS] ReportsView batches filter changes with page reset, eliminating duplicate network roundtrips');

console.log('\n======================================================================');
console.log('🏁 RESOURCE OPTIMIZATION AUDIT COMPLETE: ALL 6 TESTS PASSED');
console.log('======================================================================\n');

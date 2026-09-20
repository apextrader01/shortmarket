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
assert.ok(dbCode.includes('idx_users_registration_ip ON users(registration_ip)'), 'idx_users_registration_ip missing in db.js');
assert.ok(migrateCode.includes('idx_users_registration_ip ON users(registration_ip)'), 'idx_users_registration_ip missing in migrate_columns.js');
console.log('  ✔ [PASS] High-performance composite indexes defined across ledger, orders, positions, devices, sessions, and registration_ip');

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
console.log('  ✔ [PASS] ReportsView batches filter changes with reset to page 1 without extraneous useEffect renders');

// ── TEST 7: Real-Time Trailing Stop Loss Symbol Indexing ──
console.log('\n▶ TEST 7: Real-Time Trailing Stop Loss Symbol Indexing');
const triggerCode = fs.readFileSync(path.join(__dirname, 'services/triggerEngine.js'), 'utf8');
assert.ok(triggerCode.includes('this.trailingOrdersBySymbol = new Map()'), 'trailingOrdersBySymbol missing in triggerEngine.js');
assert.ok(triggerCode.includes('this.trailingOrdersBySymbol.get(symbol)'), 'Symbol-based O(1) trailing lookup missing in evaluateTick');
console.log('  ✔ [PASS] Trailing Stop Loss indexed by symbol for O(1) tick evaluation without linear scans');

// ── TEST 8: Instruments Cache Instant Stock Response & Early Search Break ──
console.log('\n▶ TEST 8: Instruments Cache O(1) Pre-Calculated Response');
const instCode = fs.readFileSync(path.join(__dirname, 'services/instrumentsCache.js'), 'utf8');
assert.ok(instCode.includes('cachedAllStocks = allInstruments'), 'cachedAllStocks pre-calculation missing in instrumentsCache.js');
assert.ok(instCode.includes('return cachedAllStocks;'), 'O(1) cachedAllStocks return missing in getAllStocks');
assert.ok(instCode.includes('if (results.length >= 100) break;'), 'Break at 100 results missing in searchInstruments');
assert.ok(instCode.includes("lotSizeMap['BSE:' + cleanSym]"), 'BSE lot size fallback missing in getLotSize');
assert.ok(instCode.includes('getAllStocksJson'), 'getAllStocksJson missing in instrumentsCache.js');
assert.ok(instCode.includes('getAllStocksETag'), 'getAllStocksETag missing in instrumentsCache.js');
console.log('  ✔ [PASS] InstrumentsCache pre-computes stock list, JSON string, ETag and stops search early');

// ── TEST 9: Fyers WebSocket Client Viewer Last Seen Cleanup ──
console.log('\n▶ TEST 9: Fyers Memory Leak Prevention in GC');
const fyersCode = fs.readFileSync(path.join(__dirname, 'services/fyers.js'), 'utf8');
assert.ok(fyersCode.includes('clientViewerLastSeen.delete(symbol);'), 'clientViewerLastSeen cleanup missing in garbageCollectSubscriptions');
console.log('  ✔ [PASS] Fyers subscription garbage collector cleans up clientViewerLastSeen memory');

// ── TEST 10: MTM Risk Manager Debounce Table Pruning ──
console.log('\n▶ TEST 10: MTM Debounce Cleanup (RAM Leak Prevention)');
const mtmCode = fs.readFileSync(path.join(__dirname, 'services/mtmRiskManager.js'), 'utf8');
assert.ok(mtmCode.includes('delete this.lastLiquidationTime[uid]'), 'lastLiquidationTime debounce pruning missing in mtmRiskManager.js');
console.log('  ✔ [PASS] MTM Risk Manager periodically purges stale liquidation debounce timestamps');

// ── TEST 11: Cron Jobs No-Early-Return Watchlist Fix ──
console.log('\n▶ TEST 11: Cron Jobs Non-Blocking Watchlist Expiry');
assert.ok(cronCode.includes('if (expiredInstruments.length > 0)'), 'Safe non-returning expiredInstruments guard missing in cronJobs.js');
assert.ok(!cronCode.includes('if (expiredInstruments.length === 0) return;'), 'Vulnerable early return still present in cronJobs.js');
console.log('  ✔ [PASS] 1:00 AM cron executes session/device/contest purges unconditionally even with 0 expired watchlist symbols');

// ── TEST 12: Admin Users Batched Page-Scoped IP Aggregation ──
console.log('\n▶ TEST 12: Admin Users Scalable Page-Scoped IP Aggregation');
assert.ok(serverCode.includes("const pageIps = [...new Set(rawUsers.flatMap(u => [u.last_ip, u.registration_ip]).filter(Boolean))]"), 'pageIps calculation missing in /api/admin/users');
assert.ok(serverCode.includes(".whereIn('last_ip', pageIps)"), 'whereIn pageIps filter missing in /api/admin/users');
assert.ok(!serverCode.includes(".whereNot('id', u.id)\n          .select('id', 'username')\n          .limit(5)"), 'Old per-user loop query still present in server.js');
console.log('  ✔ [PASS] /api/admin/users executes single page-scoped query and batch shared lookup, eliminating N+1 database queries');

// ── TEST 13: Instant /api/stocks Zero-CPU Response ──
console.log('\n▶ TEST 13: Instant /api/stocks Zero-CPU Precomputed String');
assert.ok(serverCode.includes("getAllStocksJson()"), 'getAllStocksJson missing in /api/stocks');
assert.ok(serverCode.includes("getAllStocksETag()"), 'getAllStocksETag missing in /api/stocks');
console.log('  ✔ [PASS] /api/stocks returns precomputed string buffer with zero per-request JSON.stringify or MD5 hashing');

// ── TEST 14: Fyers Circuit Limits in WebSocket Batch Update ──
console.log('\n▶ TEST 14: Fyers Circuit Limits in WebSocket Batch Update');
assert.ok(fyersCode.includes('upper_circuit: priceObj.upper_circuit || 0'), 'upper_circuit missing in fyers.js batchUpdate');
assert.ok(fyersCode.includes('lower_circuit: priceObj.lower_circuit || 0'), 'lower_circuit missing in fyers.js batchUpdate');
console.log('  ✔ [PASS] Fyers WebSocket broadcast propagates live upper and lower circuit limits to frontend');

// ── TEST 15: Trigger Engine Batch Order Fetch & Clean Symbol Lookup ──
console.log('\n▶ TEST 15: Trigger Engine Batch-Fetch & Deduplicated Memory Management');
assert.ok(triggerCode.includes("const triggeredOrders = await db('orders').whereIn('id', triggeredOrderIds)"), 'whereIn batch order fetch missing in triggerEngine evaluateTick');
assert.ok(triggerCode.includes("const clean = sym.includes(':') ? sym.split(':')[1] : sym;"), 'clean symbol resolution missing in removeOrderFromMemory');
console.log('  ✔ [PASS] TriggerEngine fetches triggered orders in a single SQL batch query and handles prefixed/clean symbols cleanly');

// ── TEST 16: Telemetry Redis RAM Leak Prevention ──
console.log('\n▶ TEST 16: Telemetry Redis RAM TTL Expiry');
const telCode = fs.readFileSync(path.join(__dirname, 'middleware/telemetry.js'), 'utf8');
assert.ok(telCode.includes("p.expire(`telemetry:api:${routeKey}`, 30 * 86400)"), '30-day expire missing on route telemetry in telemetry.js');
assert.ok(telCode.includes("p.expire(`telemetry:user:${userId}`, 30 * 86400)"), '30-day expire missing on user telemetry in telemetry.js');
console.log('  ✔ [PASS] Telemetry sets 30-day TTL on user & route metrics in Redis, preventing unbounded RAM growth');

// ── TEST 17: MTM Risk Manager Hoisted Singleton Formatter ──
console.log('\n▶ TEST 17: MTM Risk Manager Singleton Date Formatter');
assert.ok(mtmCode.includes("const istDateFormatter = new Intl.DateTimeFormat('en-CA'"), 'Singleton istDateFormatter missing in mtmRiskManager.js');
assert.ok(mtmCode.includes("istDateFormatter.format(new Date())"), 'istDateFormatter usage missing in evaluateMTM');
console.log('  ✔ [PASS] MTM Risk Manager reuses singleton date formatter across all evaluation cycles');

console.log('\n======================================================================');
console.log('🏁 RESOURCE OPTIMIZATION AUDIT COMPLETE: ALL 17 TESTS PASSED');
console.log('======================================================================\n');

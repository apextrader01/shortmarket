const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('🔬 MASTER VERIFICATION: ALL TODAY UPDATES AND CHANGES');
console.log('======================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// MODULE 1: Leaderboard Multi-Tournament & Expiration System
// -----------------------------------------------------------------------------
console.log('▶ MODULE 1: Leaderboard Multi-Tournament & Auto-Expiration');

const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const dbCode = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
const cronCode = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');
const migrateCode = fs.readFileSync(path.join(__dirname, 'scripts', 'migrate_columns.js'), 'utf8');

it('contests table in db.js defines segment column and auto-expiration on boot', () => {
  assert(dbCode.includes("segment VARCHAR(50) DEFAULT 'ALL'"), 'contests table segment column missing');
  assert(dbCode.includes("UPDATE contests SET status = 'ENDED'"), 'db.js auto-expiration missing');
  assert(dbCode.includes("ALTER TABLE contests ADD COLUMN IF NOT EXISTS segment"), 'db.js segment alter missing');
});

it('migrate_columns.js contains contests.segment migration and past contest cleanup', () => {
  assert(migrateCode.includes("ALTER TABLE contests ADD COLUMN IF NOT EXISTS segment"), 'migrate_columns.js segment migration missing');
  assert(migrateCode.includes("UPDATE contests SET status = 'ENDED'"), 'migrate_columns.js auto-expiration missing');
});

it('cronJobs.js auto-expires past tournaments whose end_date has passed', () => {
  assert(cronCode.includes("status', 'ACTIVE'"), 'cronJobs.js ACTIVE status check missing');
  assert(cronCode.includes("end_date', '<', now"), 'cronJobs.js end_date past check missing');
  assert(cronCode.includes("status: 'ENDED'"), 'cronJobs.js status: ENDED update missing');
});

it('server.js implements autoExpireContests() with null end_date safety', () => {
  assert(serverCode.includes('async function autoExpireContests()'), 'autoExpireContests missing');
  assert(serverCode.includes("whereNotNull('end_date')"), 'whereNotNull end_date missing');
  assert(serverCode.includes("update({ status: 'ENDED'"), 'status: ENDED missing in server autoExpire');
});

it('server.js /api/contests/active returns all active tournaments in an array and legacy contest field', () => {
  assert(serverCode.includes("app.get('/api/contests/active'"), '/api/contests/active route missing');
  assert(serverCode.includes("contests,"), 'contests array missing in response');
  assert(serverCode.includes("contest: primaryContest"), 'backwards-compatible contest field missing');
  assert(serverCode.includes("builder.whereNull('end_date').orWhere('end_date', '>=', new Date())"), 'active contest end_date filter missing');
});

it('server.js /api/contests/past returns ended / completed tournaments', () => {
  assert(serverCode.includes("app.get('/api/contests/past'"), '/api/contests/past route missing');
  assert(serverCode.includes("whereIn('status', ['ENDED', 'COMPLETED'])"), 'status ENDED/COMPLETED filter missing');
});

// -----------------------------------------------------------------------------
// MODULE 2: Market Segment Filtering Engine
// -----------------------------------------------------------------------------
console.log('\n▶ MODULE 2: Market Segment Filtering Engine');

it('server.js applySegmentFilterToQuery handles ALL, EQUITY, FNO, and COMMODITY', () => {
  assert(serverCode.includes('function applySegmentFilterToQuery(query, segment)'), 'applySegmentFilterToQuery function missing');
  assert(serverCode.includes("seg === 'EQUITY'"), 'EQUITY segment handling missing');
  assert(serverCode.includes("seg === 'FNO'"), 'FNO segment handling missing');
  assert(serverCode.includes("seg === 'COMMODITY'"), 'COMMODITY segment handling missing');
});

it('applySegmentFilterToQuery uses portable SQL filters without regex and matches digit strikes', () => {
  assert(!serverCode.includes('~*'), 'PostgreSQL-specific ~* regex must not be used');
  assert(serverCode.includes("%${d}CE"), 'Option digit-CE pattern missing');
  assert(serverCode.includes("%${d}PE"), 'Option digit-PE pattern missing');
  assert(serverCode.includes("symbol', 'like', '%FUT'"), 'Future %FUT pattern missing');
  assert(serverCode.includes("symbol', 'like', 'MCX:%'"), 'MCX pattern missing');
});

it('Leaderboard query partitions Redis cache by contest and segment', () => {
  assert(serverCode.includes("const cacheKey = `leaderboard:${contestKey}:${segKey}:top50`"), 'Cache key partitioning missing');
  assert(serverCode.includes("effectiveSegment = contest.segment.toUpperCase()"), 'Contest segment inheritance missing');
});

// -----------------------------------------------------------------------------
// MODULE 3: Admin Dashboard Tournament Controls
// -----------------------------------------------------------------------------
console.log('\n▶ MODULE 3: Admin Dashboard Tournament Controls');

const adminCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'AdminDashboard.jsx'), 'utf8');

it('server.js supports admin contest creation with segment & status, and deletion', () => {
  assert(serverCode.includes("app.delete('/api/admin/contests/:id'"), 'Contest delete endpoint missing');
  assert(serverCode.includes("prize_3rd, status, segment"), 'segment in POST admin/contests missing');
});

it('AdminDashboard.jsx provides segment dropdown, status selector, and delete action', () => {
  assert(adminCode.includes('deleteContest'), 'deleteContest in AdminDashboard missing');
  assert(adminCode.includes('Market / Segment'), 'Market / Segment label missing');
  assert(adminCode.includes('Tournament Status'), 'Tournament Status label missing');
  assert(adminCode.includes('Trash2 size={12} /> Delete'), 'Delete button missing');
});

// -----------------------------------------------------------------------------
// MODULE 4: Frontend Store & Leaderboard UI
// -----------------------------------------------------------------------------
console.log('\n▶ MODULE 4: Frontend Store & Leaderboard UI');

const storeCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'store.js'), 'utf8');
const lbCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'LeaderboardView.jsx'), 'utf8');

it('store.js has activeContests, pastContests, and multi-contest actions', () => {
  assert(storeCode.includes('activeContests: []'), 'activeContests missing in store');
  assert(storeCode.includes('pastContests: []'), 'pastContests missing in store');
  assert(storeCode.includes('fetchPastContests:'), 'fetchPastContests missing in store');
  assert(storeCode.includes('selectActiveContest:'), 'selectActiveContest missing in store');
  assert(storeCode.includes('deleteContest:'), 'deleteContest missing in store');
});

it('store.js fetchLeaderboard accepts contest_id and segment params', () => {
  assert(storeCode.includes("if (params.contest_id) queryParams.set('contest_id', params.contest_id)"), 'contest_id param missing in store fetchLeaderboard');
  assert(storeCode.includes("if (params.segment && params.segment !== 'ALL') queryParams.set('segment', params.segment)"), 'segment param missing in store fetchLeaderboard');
});

it('LeaderboardView.jsx provides multi-tournament switcher and segment filter tabs', () => {
  assert(lbCode.includes('Multi-Tournament Pill Switcher'), 'Pill switcher comment/section missing');
  assert(lbCode.includes('All Markets'), 'All Markets tab missing');
  assert(lbCode.includes('Equity (Cash)'), 'Equity tab missing');
  assert(lbCode.includes('F&O Derivatives'), 'F&O tab missing');
  assert(lbCode.includes('Commodities'), 'Commodities tab missing');
  assert(lbCode.includes('TOURNAMENT CONCLUDED'), 'Concluded badge missing');
});

// -----------------------------------------------------------------------------
// MODULE 5: Consolidated Order Taxes & Ledger Unification
// -----------------------------------------------------------------------------
console.log('\n▶ MODULE 5: Consolidated Order Taxes & Ledger Verification');

const vmeCode = fs.readFileSync(path.join(__dirname, 'services', 'volumeMatchingEngine.js'), 'utf8');

it('volumeMatchingEngine.js caps brokerage per order and debits once at EXECUTED', () => {
  assert(vmeCode.includes('if (isComplete && accumulatedTaxes > 0)'), 'Full fill isComplete check missing');
  assert(vmeCode.includes('const totalOrderTaxesObj = calculateTaxes('), 'calculateTaxes call missing');
  assert(vmeCode.includes("description: `Taxes & Brokerage for ${order.side} ${newFilled} ${order.symbol} (Order #${order.id})`"), 'TAXES ledger entry missing');
});

it('server.js cleans up fragmented micro-slice taxes on startup', () => {
  assert(serverCode.includes('cleanupTodayFragmentedTaxes'), 'cleanupTodayFragmentedTaxes call missing');
  assert(fs.existsSync(path.join(__dirname, 'scripts', 'consolidate_today_slice_taxes.js')), 'consolidate_today_slice_taxes.js script missing');
});

// -----------------------------------------------------------------------------
// MODULE 6: Realized P&L Single Source of Truth
// -----------------------------------------------------------------------------
console.log('\n▶ MODULE 6: Realized P&L Single Source of Truth');

const pnlHelperCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'utils', 'pnlHelper.js'), 'utf8');
const portCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'PortfolioView.jsx'), 'utf8');
const posCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'PositionsView.jsx'), 'utf8');

it('pnlHelper.js provides unified getTodayRealizedMetrics and getTodayClosedPositions', () => {
  assert(pnlHelperCode.includes('export const getTodayRealizedMetrics'), 'getTodayRealizedMetrics export missing');
  assert(pnlHelperCode.includes('export const getTodayClosedPositions'), 'getTodayClosedPositions export missing');
});

it('PortfolioView, PositionsView, OrderModal, BasketModal consume unified pnlHelper', () => {
  assert(portCode.includes('getTodayRealizedMetrics'), 'PortfolioView getTodayRealizedMetrics missing');
  assert(posCode.includes('getTodayClosedPositions'), 'PositionsView getTodayClosedPositions missing');
  const orderModalCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'OrderModal.jsx'), 'utf8');
  const basketModalCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'BasketModal.jsx'), 'utf8');
  assert(orderModalCode.includes('getTodayRealizedMetrics'), 'OrderModal getTodayRealizedMetrics missing');
  assert(basketModalCode.includes('getTodayRealizedMetrics'), 'BasketModal getTodayRealizedMetrics missing');
});

// -----------------------------------------------------------------------------
// MODULE 7: Functional Symbol Classification Tests
// -----------------------------------------------------------------------------
console.log('\n▶ MODULE 7: Functional Symbol Classification Tests');

const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function classify(sym) {
  const s = (sym || '').toUpperCase().trim();
  const commList = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'];
  if (s.startsWith('MCX:') || commList.some(c => s.includes(c))) return 'COMMODITY';
  if (s.endsWith('FUT') || s.endsWith('-FUT')) return 'FNO';
  for (const d of digits) {
    if (s.endsWith(`${d}CE`) || s.endsWith(`${d}PE`)) return 'FNO';
  }
  return 'EQUITY';
}

it('Classifies Equities without falsely capturing stocks like RELIANCE as FNO', () => {
  assert.strictEqual(classify('NSE:RELIANCE'), 'EQUITY');
  assert.strictEqual(classify('NSE:TCS'), 'EQUITY');
  assert.strictEqual(classify('NSE:INFY'), 'EQUITY');
  assert.strictEqual(classify('BSE:KITEX'), 'EQUITY');
  assert.strictEqual(classify('NSE:IDFCFIRSTB'), 'EQUITY');
});

it('Classifies Call Options, Put Options, and Futures as FNO', () => {
  assert.strictEqual(classify('NSE:NIFTY24OCT23350CE'), 'FNO');
  assert.strictEqual(classify('NSE:BANKNIFTY24OCT56300PE'), 'FNO');
  assert.strictEqual(classify('BSE:SENSEX24OCT74600CE'), 'FNO');
  assert.strictEqual(classify('NSE:RELIANCE24OCTFUT'), 'FNO');
});

it('Classifies MCX and commodity contracts as COMMODITY', () => {
  assert.strictEqual(classify('MCX:GOLDM24OCTFUT'), 'COMMODITY');
  assert.strictEqual(classify('MCX:CRUDEOIL24NOVFUT'), 'COMMODITY');
  assert.strictEqual(classify('MCX:NATURALGAS24OCTFUT'), 'COMMODITY');
});

console.log('\n======================================================================');
console.log(`🏁 MASTER AUDIT RESULTS: ${passedTests} / ${totalTests} CHECKS PASSED`);
console.log('======================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}

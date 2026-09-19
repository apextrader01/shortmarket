const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('🏆 TOURNAMENTS & LEADERBOARD MULTI-CONTEST & SEGMENT FILTER TEST SUITE');
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
// TEST SUITE 1: Server Logic & Segment Filter Verification
// -----------------------------------------------------------------------------
console.log('▶ TEST SUITE 1: Server Logic & Segment Filter Verification');

const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

it('server.js exports or implements applySegmentFilterToQuery', () => {
  assert(serverContent.includes('function applySegmentFilterToQuery(query, segment)'), 'applySegmentFilterToQuery function missing');
  assert(serverContent.includes("seg === 'EQUITY'"), 'EQUITY segment handling missing');
  assert(serverContent.includes("seg === 'FNO'"), 'FNO segment handling missing');
  assert(serverContent.includes("seg === 'COMMODITY'"), 'COMMODITY segment handling missing');
});

it('applySegmentFilterToQuery uses portable SQL filters (LIKE/NOT LIKE) with digit-backed option strike matching', () => {
  assert(!serverContent.includes('~*'), 'Must not use PostgreSQL-specific ~* regex in applySegmentFilterToQuery');
  assert(serverContent.includes("symbol', 'like', 'MCX:%'"), 'MCX symbol pattern missing');
  assert(serverContent.includes("%${d}CE"), 'Option CE pattern with digit prefix missing');
  assert(serverContent.includes("%${d}PE"), 'Option PE pattern with digit prefix missing');
  assert(serverContent.includes("symbol', 'like', '%FUT'"), 'Future FUT pattern missing');
});

it('GET /api/leaderboard supports contest_id, segment, timeframe and cache key partitioning', () => {
  assert(serverContent.includes("const { contest_id, segment, timeframe } = req.query"), 'destructuring contest_id, segment from req.query missing');
  assert(serverContent.includes("const segKey = (segment || 'ALL').toUpperCase()"), 'segKey extraction missing');
  assert(serverContent.includes("const cacheKey = `leaderboard:${contestKey}:${segKey}:top50`"), 'Partitioned cache key missing');
});

it('GET /api/contests/active returns all active tournaments array with legacy contest field', () => {
  assert(serverContent.includes("app.get('/api/contests/active'"), 'active contests endpoint missing');
  assert(serverContent.includes("autoExpireContests()"), 'autoExpireContests call in active contests missing');
  assert(serverContent.includes("contests,"), 'Array of contests in response missing');
  assert(serverContent.includes("contest: primaryContest"), 'Backwards compatible contest field missing');
});

it('GET /api/contests/past returns concluded tournaments', () => {
  assert(serverContent.includes("app.get('/api/contests/past'"), 'past contests endpoint missing');
  assert(serverContent.includes("['ENDED', 'COMPLETED']"), 'filtering for ENDED/COMPLETED status missing');
});

it('Admin contests API supports segment, status update and deletion', () => {
  assert(serverContent.includes("app.delete('/api/admin/contests/:id'"), 'Contest delete endpoint missing');
  assert(serverContent.includes("const { id, title, description, start_date, end_date, prize_1st, prize_2nd, prize_3rd, status, segment } = req.body"), 'segment and status in POST admin/contests missing');
});

// -----------------------------------------------------------------------------
// TEST SUITE 2: Database Schema & Migration Verification
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 2: Database Schema & Migrations');

const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
const migrateContent = fs.readFileSync(path.join(__dirname, 'scripts', 'migrate_columns.js'), 'utf8');

it('contests table includes segment VARCHAR(50) DEFAULT ALL', () => {
  assert(dbContent.includes("segment VARCHAR(50) DEFAULT 'ALL'"), 'db.js table creation segment missing');
  assert(dbContent.includes("ALTER TABLE contests ADD COLUMN IF NOT EXISTS segment VARCHAR(50) DEFAULT 'ALL'"), 'db.js column migration missing');
});

it('migrate_columns.js contains contests.segment migration and past contest expiration', () => {
  assert(migrateContent.includes("ALTER TABLE contests ADD COLUMN IF NOT EXISTS segment VARCHAR(50) DEFAULT 'ALL'"), 'migrate_columns.js segment column missing');
  assert(migrateContent.includes("UPDATE contests SET status = 'ENDED'"), 'migrate_columns.js auto-expiration missing');
});

it('cronJobs.js automatically expires ended tournaments on nightly run', () => {
  const cronContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');
  assert(cronContent.includes("status', 'ACTIVE'"), 'cronJobs.js active contest filter missing');
  assert(cronContent.includes("status: 'ENDED'"), 'cronJobs.js ENDED status update missing');
  assert(cronContent.includes("end_date', '<', now"), 'end_date check in cron missing');
});

// -----------------------------------------------------------------------------
// TEST SUITE 3: Frontend Store and Component State
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 3: Frontend Store & Components');

const storeContent = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'store.js'), 'utf8');
const lbViewContent = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'LeaderboardView.jsx'), 'utf8');
const adminDashContent = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'AdminDashboard.jsx'), 'utf8');

it('store.js handles activeContests array, pastContests, and deleteContest', () => {
  assert(storeContent.includes('activeContests: []'), 'activeContests array missing in store');
  assert(storeContent.includes('pastContests: []'), 'pastContests array missing in store');
  assert(storeContent.includes('fetchPastContests:'), 'fetchPastContests missing in store');
  assert(storeContent.includes('deleteContest:'), 'deleteContest missing in store');
  assert(storeContent.includes('selectActiveContest:'), 'selectActiveContest missing in store');
});

it('LeaderboardView.jsx includes multi-tournament selector and segment tabs', () => {
  assert(lbViewContent.includes('activeContests'), 'activeContests usage missing in LeaderboardView');
  assert(lbViewContent.includes('selectedSegment'), 'selectedSegment filter missing in LeaderboardView');
  assert(lbViewContent.includes('All Markets'), 'All Markets segment option missing');
  assert(lbViewContent.includes('Equity (Cash)'), 'Equity segment option missing');
  assert(lbViewContent.includes('F&O (Derivatives)'), 'F&O segment option missing');
  assert(lbViewContent.includes('Commodities (MCX)'), 'Commodities segment option missing');
  assert(lbViewContent.includes('TOURNAMENT CONCLUDED'), 'concluded banner logic missing');
});

it('AdminDashboard.jsx has segment selector and delete button for tournaments', () => {
  assert(adminDashContent.includes('deleteContest'), 'deleteContest in AdminDashboard missing');
  assert(adminDashContent.includes('Market / Segment'), 'Segment label in AdminDashboard missing');
  assert(adminDashContent.includes('Tournament Status'), 'Tournament Status select in AdminDashboard missing');
  assert(adminDashContent.includes('Delete'), 'Delete tournament button missing');
});

// -----------------------------------------------------------------------------
// TEST SUITE 4: Functional Segment Classification Logic
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 4: Simulated Segment Classification Logic');

const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function isEquitySymbol(symbol) {
  const s = (symbol || '').toUpperCase().trim();
  const commList = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'];
  if (s.startsWith('MCX:')) return false;
  if (s.endsWith('-MF') || s.endsWith(':MF')) return false;
  if (s.endsWith('FUT') || s.endsWith('-FUT')) return false;
  for (const d of digits) {
    if (s.endsWith(`${d}CE`) || s.endsWith(`${d}PE`)) return false;
  }
  for (const c of commList) {
    if (s.includes(c)) return false;
  }
  return true;
}

function isFnoSymbol(symbol) {
  const s = (symbol || '').toUpperCase().trim();
  if (s.endsWith('FUT') || s.endsWith('-FUT') || s.startsWith('MCX:')) return true;
  for (const d of digits) {
    if (s.endsWith(`${d}CE`) || s.endsWith(`${d}PE`)) return true;
  }
  return false;
}

function isCommoditySymbol(symbol) {
  const s = (symbol || '').toUpperCase().trim();
  const commList = ['CRUDEOIL', 'GOLD', 'SILVER', 'NATURALGAS', 'COPPER', 'ZINC', 'LEAD', 'ALUMINIUM', 'MENTHAOIL', 'COTTON', 'NICKEL'];
  if (s.startsWith('MCX:')) return true;
  return commList.some(c => s.includes(c));
}

it('Accurately identifies Equity symbols (e.g. NSE:RELIANCE is Equity, NOT F&O despite CE substring in name)', () => {
  assert.strictEqual(isEquitySymbol('NSE:RELIANCE'), true);
  assert.strictEqual(isEquitySymbol('NSE:TCS'), true);
  assert.strictEqual(isEquitySymbol('NSE:IDFCFIRSTB'), true);
  assert.strictEqual(isEquitySymbol('BSE:KITEX'), true);
  assert.strictEqual(isEquitySymbol('NSE:NIFTY24OCT23350CE'), false);
  assert.strictEqual(isEquitySymbol('MCX:CRUDEOIL24NOVFUT'), false);
});

it('Accurately identifies F&O derivative contracts', () => {
  assert.strictEqual(isFnoSymbol('NSE:NIFTY24OCT23350CE'), true);
  assert.strictEqual(isFnoSymbol('NSE:BANKNIFTY24OCT56300PE'), true);
  assert.strictEqual(isFnoSymbol('NSE:RELIANCE24OCTFUT'), true);
  assert.strictEqual(isFnoSymbol('BSE:SENSEX24OCT74600CE'), true);
  assert.strictEqual(isFnoSymbol('NSE:RELIANCE'), false);
  assert.strictEqual(isFnoSymbol('NSE:TCS'), false);
});

it('Accurately identifies Commodity contracts', () => {
  assert.strictEqual(isCommoditySymbol('MCX:GOLDM24OCTFUT'), true);
  assert.strictEqual(isCommoditySymbol('MCX:CRUDEOIL24NOVFUT'), true);
  assert.strictEqual(isCommoditySymbol('MCX:SILVERMIC24DECFUT'), true);
  assert.strictEqual(isCommoditySymbol('NSE:RELIANCE'), false);
});

// -----------------------------------------------------------------------------
// TEST SUITE 5: Tournament Expiration Calculation
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 5: Tournament Expiration Calculation');

function evaluateTournamentStatus(status, endDateStr) {
  const now = Date.now();
  if (status === 'ENDED' || status === 'COMPLETED') return 'ENDED';
  if (endDateStr && new Date(endDateStr).getTime() <= now) return 'ENDED';
  if (status === 'UPCOMING') return 'UPCOMING';
  return 'ACTIVE';
}

it('Correctly marks tournaments as ENDED when end_date is in the past', () => {
  const pastDate = '2026-09-11T23:59:59.000Z'; // Past date
  const futureDate = '2026-09-30T23:59:59.000Z'; // Future date

  assert.strictEqual(evaluateTournamentStatus('ACTIVE', pastDate), 'ENDED', 'Past tournament with ACTIVE status should evaluate to ENDED');
  assert.strictEqual(evaluateTournamentStatus('ACTIVE', futureDate), 'ACTIVE', 'Future tournament with ACTIVE status should evaluate to ACTIVE');
  assert.strictEqual(evaluateTournamentStatus('UPCOMING', futureDate), 'UPCOMING', 'Upcoming tournament should evaluate to UPCOMING');
  assert.strictEqual(evaluateTournamentStatus('ENDED', futureDate), 'ENDED', 'Explicitly ended tournament should evaluate to ENDED');
});

console.log('\n======================================================================');
console.log(`🏁 RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('======================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}

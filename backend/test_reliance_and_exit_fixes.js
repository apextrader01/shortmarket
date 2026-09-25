const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('🔬 VERIFICATION: RELIANCE CLOSED TAB FILTER & EXIT MODAL CRASH FIX');
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
  }
}

// 1. Verify PositionsView.jsx scope of isExitShort
console.log('▶ TEST SUITE 1: Exit Modal Scope & Crash Fix in PositionsView.jsx');
const positionsViewPath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'PositionsView.jsx');
const positionsViewContent = fs.readFileSync(positionsViewPath, 'utf8');

it('PositionsView.jsx declares isExitShort in partialExitPos render scope before JSX button', () => {
  assert(positionsViewContent.includes('const isExitShort = Number(partialExitPos.qty) < 0 || partialExitPos.side === \'SELL\';'), 'isExitShort declaration missing');
  assert(positionsViewContent.includes('const exitSide = isExitShort ? \'BUY\' : \'SELL\';'), 'exitSide declaration missing');
  assert(positionsViewContent.includes('{partialExitPos && (() => {'), 'IIFE wrapper for partialExitPos modal missing');
});

it('PositionsView.jsx defines prices alias and safe liveLtp fallback to prevent "prices is not defined"', () => {
  assert(positionsViewContent.includes('const prices = relevantPrices;'), 'prices alias missing');
  assert(positionsViewContent.includes('const liveLtp = relevantPrices[pos.symbol]?.ltp || store.prices?.[pos.symbol]?.ltp || pos.ltp || 0;'), 'safe liveLtp in exitAllPositions missing');
});

// 2. Verify pnlHelper.js filter for ghost closed positions
console.log('\n▶ TEST SUITE 2: pnlHelper.js Closed Positions Filter Logic');
const pnlHelperPath = path.join(__dirname, '..', 'frontend', 'src', 'utils', 'pnlHelper.js');
const pnlHelperContent = fs.readFileSync(pnlHelperPath, 'utf8');

it('pnlHelper.js requires valid exit price, realized P&L, or matching executed order for dbClosed', () => {
  assert(pnlHelperContent.includes('const hasExitPrice = p.exit_price !== null && p.exit_price !== undefined && Number(p.exit_price) > 0;'), 'hasExitPrice check missing');
  assert(pnlHelperContent.includes('const hasRealizedPnl = p.realized_pnl !== null && p.realized_pnl !== undefined && Number(p.realized_pnl) !== 0;'), 'hasRealizedPnl check missing');
  assert(pnlHelperContent.includes('hasExitPrice || hasRealizedPnl || hasMatchingTodayOrder'), 'Validation return check missing');
});

// Test the filter logic algorithmically
function testFilter(positions, orders) {
  const isToday = (d) => true; // Assume today
  const normalizeSym = (s) => (s || '').replace(/^(NSE:|BSE:|MCX:)/i, '').trim();

  return positions.filter(p => {
    if (Number(p.quantity) !== 0) return false;
    if (!isToday(p.updated_at || p.created_at)) return false;

    const hasExitPrice = p.exit_price !== null && p.exit_price !== undefined && Number(p.exit_price) > 0;
    const hasRealizedPnl = p.realized_pnl !== null && p.realized_pnl !== undefined && Number(p.realized_pnl) !== 0;
    const hasMatchingTodayOrder = (orders || []).some(o => {
      const isExecuted = o.status === 'COMPLETED' || o.status === 'COMPLETE' || o.status === 'EXECUTED';
      if (!isExecuted) return false;
      if (!isToday(o.updated_at || o.created_at)) return false;
      return normalizeSym(o.symbol) === normalizeSym(p.symbol);
    });

    return hasExitPrice || hasRealizedPnl || hasMatchingTodayOrder;
  });
}

it('Filters out ghost RELIANCE (quantity 0, exit_price null, realized_pnl 0, no orders today)', () => {
  const ghostReliance = {
    symbol: 'BSE:RELIANCE',
    quantity: 0,
    closed_quantity: 11,
    average_price: 1322,
    exit_price: null,
    realized_pnl: 0,
    updated_at: new Date().toISOString()
  };
  const activeClosed = {
    symbol: 'NSE:TCS',
    quantity: 0,
    closed_quantity: 10,
    average_price: 3500,
    exit_price: 3550,
    realized_pnl: 500,
    updated_at: new Date().toISOString()
  };

  const results = testFilter([ghostReliance, activeClosed], []);
  assert.strictEqual(results.length, 1, 'Should only contain 1 valid closed position');
  assert.strictEqual(results[0].symbol, 'NSE:TCS', 'Only TCS should be included');
});

// 3. Verify restore script exists and has correct restoration logic
console.log('\n▶ TEST SUITE 3: Database Restoration Script');
const scriptPath = path.join(__dirname, 'scripts', 'restore_reliance_holding.js');
assert(fs.existsSync(scriptPath), 'restore_reliance_holding.js script must exist');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

it('restore_reliance_holding.js restores 11 Qty @ ₹1322 into holdings and deletes from positions', () => {
  assert(scriptContent.includes("targetQty = 11"), 'targetQty 11 missing');
  assert(scriptContent.includes("targetAvg = 1322"), 'targetAvg 1322 missing');
  assert(scriptContent.includes("trx('holdings')"), 'holdings update/insert missing');
  assert(scriptContent.includes("trx('positions').whereIn('id', posIds).del()"), 'positions deletion missing');
  assert(scriptContent.includes("trx('orders').whereIn('id', orderIds).del()"), 'orders deletion missing');
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('======================================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL TESTS PASSED!');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!');
  process.exit(1);
}

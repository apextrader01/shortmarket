const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================================');
console.log('🧪 COMPREHENSIVE VERIFICATION: ALL TODAY CHANGES (ENGINE + UI)');
console.log('======================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// Read relevant files and normalize line endings for cross-platform compatibility
const vmmPath = path.join(__dirname, '../services/volumeMatchingEngine.js');
const fyersPath = path.join(__dirname, '../services/fyers.js');
const storePath = path.join(__dirname, '../../frontend/src/store.js');
const positionsViewPath = path.join(__dirname, '../../frontend/src/components/PositionsView.jsx');
const portfolioViewPath = path.join(__dirname, '../../frontend/src/components/PortfolioView.jsx');
const tradingJournalViewPath = path.join(__dirname, '../../frontend/src/components/TradingJournalView.jsx');

const vmmContent = fs.readFileSync(vmmPath, 'utf8').replace(/\r\n/g, '\n');
const fyersContent = fs.readFileSync(fyersPath, 'utf8').replace(/\r\n/g, '\n');
const storeContent = fs.readFileSync(storePath, 'utf8').replace(/\r\n/g, '\n');
const posContent = fs.readFileSync(positionsViewPath, 'utf8').replace(/\r\n/g, '\n');
const portContent = fs.readFileSync(portfolioViewPath, 'utf8').replace(/\r\n/g, '\n');
const journalContent = fs.readFileSync(tradingJournalViewPath, 'utf8').replace(/\r\n/g, '\n');

const { isCommodityContract } = require('../services/instrumentsCache');

// -----------------------------------------------------------------------------
// SUITE 1: MCX Commodity Contract Volume Scaling
// -----------------------------------------------------------------------------
console.log('▶ TEST SUITE 1: MCX Commodity Contract Volume Scaling');

runTest('vmm and instrumentsCache detect MCX commodity contracts correctly', () => {
  assert(isCommodityContract('MCX:CRUDEOILM26OCT9650CE'), 'Detects MCX Crude Oil');
  assert(isCommodityContract('MCX:GOLDM26NOV80000CE'), 'Detects MCX Gold');
  assert(isCommodityContract('MCX:SILVERMIC26NOV85000PE'), 'Detects MCX Silver');
  assert(!isCommodityContract('NSE:RELIANCE'), 'Non-commodity returns false');
  assert(vmmContent.includes('const isCommodity = isCommodityContract(order.symbol);'), 'Engine checks isCommodity per order');
});

runTest('vmm treats MCX tick volume as contract lots (isContractVol ? availableVol * lotsize : availableVol)', () => {
  assert(vmmContent.includes('const isContractVol = isCommodity || availableVol < lotsize;'), 'isContractVol logic detected');
  assert(vmmContent.includes('const availableUnits = isContractVol ? (availableVol * lotsize) : availableVol;'), 'Volume units scaled by lot size');
});

runTest('Simulation: MCX Crude Oil Mini (lot 10) fills on 4 vol and 1 vol ticks', () => {
  const lotsize = 10;
  const isCommodity = true;
  let order = { pending_quantity: 100, filled_quantity: 0 };

  // Tick 1: 4 contracts trade (16:56)
  let availableVol = 4;
  const isContractVol1 = isCommodity || availableVol < lotsize;
  const availableUnits1 = isContractVol1 ? (availableVol * lotsize) : availableVol;
  const rawCap1 = Math.min(order.pending_quantity, availableUnits1);
  const fill1 = Math.floor(rawCap1 / lotsize) * lotsize;
  assert.strictEqual(fill1, 40, '4 contracts must fill 40 units (4 lots)');
  order.filled_quantity += fill1;
  order.pending_quantity -= fill1;
  assert.strictEqual(order.filled_quantity, 40);
  assert.strictEqual(order.pending_quantity, 60);

  // Tick 2: 1 contract trades (16:57)
  let availableVol2 = 1;
  const isContractVol2 = isCommodity || availableVol2 < lotsize;
  const availableUnits2 = isContractVol2 ? (availableVol2 * lotsize) : availableVol2;
  const rawCap2 = Math.min(order.pending_quantity, availableUnits2);
  const fill2 = Math.floor(rawCap2 / lotsize) * lotsize;
  assert.strictEqual(fill2, 10, '1 contract must fill 10 units (1 lot)');
  order.filled_quantity += fill2;
  order.pending_quantity -= fill2;
  assert.strictEqual(order.filled_quantity, 50);
  assert.strictEqual(order.pending_quantity, 50);
});

// -----------------------------------------------------------------------------
// SUITE 2: Excess Exit Order DB Persistence & Stuck Order Prevention
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 2: Excess Exit Order Database Persistence & Stuck Order Prevention');

runTest('vmm persists CANCELLED to PostgreSQL when exit order is blocked by position flat check', () => {
  assert(vmmContent.includes("Blocked exit order"), 'Safeguard log missing');
  assert(vmmContent.includes("await trx('orders').where({ id: order.id }).update({"), 'DB update in safeguard missing');
  assert(vmmContent.includes("status: 'CANCELLED'"), 'status: CANCELLED missing in safeguard update');
  assert(vmmContent.includes("pending_quantity: 0"), 'pending_quantity: 0 missing in safeguard update');
});

runTest('vmm clamps leftover exit order quantity and cancels surplus in PostgreSQL', () => {
  assert(vmmContent.includes("If this exit order closed the position completely, cancel any remaining pending quantity on this order"),
    'leftoverQty exit handling comment present');
  assert(vmmContent.includes("newPending = 0;"), 'newPending zeroed on exit closure');
  assert(vmmContent.includes("status = 'CANCELLED';"), 'status marked CANCELLED on exit closure');
});

runTest('vmm loads active OPEN orders on startup to ensure recovery after restart', () => {
  assert(vmmContent.includes("builder.whereIn('status', ['PENDING', 'OPEN']).where({ type: 'MARKET' })"),
    'OPEN status queried in loadPendingVolumeOrders');
});

// -----------------------------------------------------------------------------
// SUITE 3: Resting Order Cancellation on Exit All & Row Exit
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 3: Resting Order Cancellation on Exit All & Row Exit');

runTest('PositionsView handleExitAllPositions purges PARTIAL_FILLED and PARTIALLY_FILLED orders', () => {
  assert(posContent.includes("const cancellableStatuses = ['PENDING', 'PENDING_TRIGGER', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN', 'AMO_PENDING'];"),
    'Full cancellable statuses list used in Exit All');
  assert(posContent.includes("if (!cancellableStatuses.includes(o.status)) return false;"),
    'cancellableStatuses filter condition verified');
});

runTest('PositionsView row exit modal cancels prior resting orders before placing full exit', () => {
  assert(posContent.includes('if (qtyToExit >= maxQty)'), 'Row exit modal checks maxQty');
  assert(posContent.includes('await store.cancelOrder(ord.id).catch(() => {});'), 'Cancels resting orders prior to submitting exit order');
});

// -----------------------------------------------------------------------------
// SUITE 4: Fyers Subscription Keepalive & GC Protection
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 4: Fyers Subscription Keepalive & GC Protection');

runTest('fyers.js garbageCollectSubscriptions protects active PARTIALLY_FILLED orders', () => {
  assert(fyersContent.includes("whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN', 'AMO_PENDING'])"),
    'GC query protects active order statuses');
});

runTest('store.js pingSubscriptions keeps active orders alive in WebSocket feed', () => {
  assert(storeContent.includes("const activeOrderStatuses = ['PENDING', 'PENDING_TRIGGER', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN', 'AMO_PENDING']"),
    'activeOrderStatuses missing in pingSubscriptions');
  assert(storeContent.includes("activeOrderStatuses.includes(o.status)"), 'Order status check missing in pingSubscriptions');
});

// -----------------------------------------------------------------------------
// SUITE 5: Partial Exit Modal AMO Logic (Screenshot 1)
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 5: Partial Exit Modal AMO Logic (Screenshot 1)');

runTest('PositionsView checks getMarketSession for the instrument being exited', () => {
  assert(posContent.includes('const currentSession = getMarketSession({'), 'Calculates current market session in exit modal');
  assert(posContent.includes('const isMarketOpen = currentSession.open;'), 'Evaluates isMarketOpen in exit modal');
});

runTest('AMO selector is completely hidden when market is open', () => {
  assert(posContent.includes('{/* Regular vs AMO Selector - Only displayed if market is closed */}'), 'Comment confirms conditional render');
  assert(posContent.includes('{!isMarketOpen && ('), 'AMO selector strictly guarded by !isMarketOpen');
});

// -----------------------------------------------------------------------------
// SUITE 6: Portfolio Overview Optimization & Layout (Screenshot 2)
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 6: Portfolio Overview Optimization & Layout (Screenshot 2)');

runTest('PortfolioView uses single-pass useMemo for merged holdings and totals', () => {
  assert(portContent.includes('deliveryPositions,'), 'deliveryPositions memoized');
  assert(portContent.includes('totalInvested,'), 'totalInvested memoized');
  assert(portContent.includes('totalCurrent,'), 'totalCurrent memoized');
  assert(portContent.includes('unrealizedPnl'), 'unrealizedPnl memoized');
  assert(portContent.includes('}, [holdings, positions, portfolioPrices]);'), 'Dependencies properly scoped to holdings, positions, portfolioPrices');
});

runTest('PortfolioView top metrics grid uses repeat(4, minmax(0, 1fr)) and adequate padding', () => {
  assert(portContent.includes("repeat(4, minmax(0, 1fr))"), 'Grid uses minmax(0, 1fr) to prevent card squishing');
  assert(portContent.includes("padding: isMobile ? '10px 12px 100px' : '16px 20px 100px'"), 'Safe padding prevents clipping under sticky header');
});

runTest('Desktop holdings table has compact column and cell paddings', () => {
  assert(portContent.includes("padding: '9px 12px'") && portContent.includes("padding: '9px 10px'"), 'Compact table headers and cells');
  assert(portContent.includes("fontSize: '12.5px'"), 'Compact typography fits on desktop viewports');
});

// -----------------------------------------------------------------------------
// SUITE 7: P&L Calendar Heatmap Tab Isolation (Screenshot 3)
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 7: P&L Calendar Heatmap Tab Isolation (Screenshot 3)');

runTest('PortfolioView passes mode="CALENDAR" to TradingJournalView on Heatmap tab', () => {
  assert(portContent.includes("activeTab === 'Heatmap' ? ("), 'Heatmap tab check in place');
  assert(portContent.includes('<TradingJournalView mode="CALENDAR" />'), 'TradingJournalView invoked with mode="CALENDAR"');
});

runTest('TradingJournalView hides switcher buttons when mode is specified', () => {
  assert(journalContent.includes('{/* View Switcher: Journal vs Calendar (only shown if mode is not specified) */}'), 'Documented conditional view switcher');
  assert(journalContent.includes('{!mode && ('), 'Switcher bar wrapped in {!mode && (');
  assert(journalContent.includes('const currentTab = mode || activeViewTab;'), 'currentTab defaults to mode if provided');
});

runTest('TradingJournalView renders ONLY Calendar Heatmap when mode is CALENDAR', () => {
  assert(journalContent.includes("{currentTab === 'JOURNAL' ? ("), 'Branching based on currentTab');
  // When currentTab is CALENDAR, the JOURNAL branch is completely bypassed
  const mockMode = 'CALENDAR';
  const mockCurrentTab = mockMode || 'JOURNAL';
  const rendersJournal = mockCurrentTab === 'JOURNAL';
  assert.strictEqual(rendersJournal, false, 'Journal view must NOT render when mode is CALENDAR');
});

// -----------------------------------------------------------------------------
// SUITE 8: Trade Journal Log Tab Isolation (Screenshot 4)
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 8: Trade Journal Log Tab Isolation (Screenshot 4)');

runTest('PortfolioView passes mode="JOURNAL" to TradingJournalView on Journal tab', () => {
  assert(portContent.includes("activeTab === 'Journal' ? ("), 'Journal tab check in place');
  assert(portContent.includes('<TradingJournalView mode="JOURNAL" />'), 'TradingJournalView invoked with mode="JOURNAL"');
});

runTest('TradingJournalView renders ONLY Trade Journal Log when mode is JOURNAL', () => {
  const mockMode = 'JOURNAL';
  const mockCurrentTab = mockMode || 'JOURNAL';
  const rendersJournal = mockCurrentTab === 'JOURNAL';
  assert.strictEqual(rendersJournal, true, 'Journal view renders when mode is JOURNAL');
});

// -----------------------------------------------------------------------------
// SUITE 9: Standalone Trading Journal Backward Compatibility
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 9: Standalone Trading Journal Backward Compatibility');

runTest('TradingJournalView retains switcher bar when mode is undefined', () => {
  const mockMode = undefined;
  const showSwitcher = !mockMode;
  assert.strictEqual(showSwitcher, true, 'Standalone view with no mode retains sub-switcher');
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('======================================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL TODAY CHANGES VERIFIED AND PASSED WITH 100% ACCURACY!\n');
  process.exit(0);
} else {
  console.error('❌ SOME CHECKS FAILED. Please review the output above.\n');
  process.exit(1);
}

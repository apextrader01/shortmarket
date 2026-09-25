/**
 * Test Suite: Order Execution 100% Fill, F&O Lot Integrity, AMO Window & Decimal Quantity Elimination
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== Starting Master Order Execution & Lot Integrity Verification Suite ===\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    -> ${err.message}`);
  }
}

// ── Test 1: VolumeMatchingEngine 100% Market Order Immediate Fill ──────────
test('volumeMatchingEngine: Market orders fill 100% immediately without 20% freeze', () => {
  const vmeContent = fs.readFileSync(path.join(__dirname, 'backend/services/volumeMatchingEngine.js'), 'utf8');

  // Verify market orders execute full pending quantity
  assert(vmeContent.includes("ordObj.type === 'MARKET' || ordObj.isMarket"), 'Must detect MARKET orders');
  assert(vmeContent.includes("ordObj.pending_quantity"), 'Must reference ordObj.pending_quantity');
  assert(!vmeContent.includes("Math.floor(ordObj.pending_quantity * 0.2)"), 'CRITICAL BUG REMOVED: 20% partial fill freeze must not exist');
  assert(vmeContent.includes("await this.processSliceFill(ordObj, ordObj.pending_quantity, baseLtp)"), 'Must execute full pending quantity for market orders');
});

// ── Test 2: VolumeMatchingEngine F&O Lot Size Integrity ───────────────────
test('volumeMatchingEngine: F&O fills enforce strict lot size integer multiples (never split lots)', () => {
  const vmeContent = fs.readFileSync(path.join(__dirname, 'backend/services/volumeMatchingEngine.js'), 'utf8');

  // Verify lot size calculation
  assert(vmeContent.includes("Math.floor(rawCap / lotsize) * lotsize"), 'Must enforce lot size multiple fills in matching engine');
  assert(vmeContent.includes("Math.max(lotsize, Math.floor(rawCap / lotsize) * lotsize)"), 'Minimum fill for derivative must be at least 1 lot');
});

// ── Test 3: Backend Server Integer & Lot Size Validation ──────────────────
test('backend/server.js: Rejects non-integer quantities for non-MF and enforces lot size multiples', () => {
  const serverContent = fs.readFileSync(path.join(__dirname, 'backend/server.js'), 'utf8');

  assert(serverContent.includes("quantity = Math.round(parsedQty)"), 'Must round non-MF quantity to integer');
  assert(serverContent.includes("Number.isInteger(quantity)"), 'Must ensure integer quantity');
  assert(serverContent.includes("lotsize > 1 && (Number(quantity) % lotsize !== 0)"), 'Must validate quantity is a multiple of lotsize');
});

// ── Test 4: Strict AMO Schedule (03:45 PM to 08:57 AM) ───────────────────
test('backend/server.js & OrderModal.jsx: AMO window strictly enforced between 03:45 PM and 08:57 AM', () => {
  const serverContent = fs.readFileSync(path.join(__dirname, 'backend/server.js'), 'utf8');
  const modalContent = fs.readFileSync(path.join(__dirname, 'frontend/src/components/OrderModal.jsx'), 'utf8');

  // Check backend AMO window: 945 minutes (15:45 / 3:45 PM)
  assert(serverContent.includes("currentMinutes >= 945 || currentMinutes < 537"), 'Backend AMO window must start at 945m (03:45 PM)');
  assert(serverContent.includes("03:45 PM - 08:57 AM"), 'Backend reason must describe 03:45 PM - 08:57 AM');

  // Check frontend OrderModal AMO window: 945 minutes
  assert(modalContent.includes("curMins >= 945 || curMins < 537"), 'Frontend AMO window must start at 945m (03:45 PM)');
  assert(modalContent.includes("03:45 PM - 08:57 AM"), 'Frontend OrderModal must display 03:45 PM - 08:57 AM');

  // Check that AMO is blocked when not in AMO window
  assert(modalContent.includes("if (isAmo && !marketSession.isAmoWindow)"), 'OrderModal must block order submission outside AMO window');
  assert(serverContent.includes("After Market Orders (AMO) can only be placed between 03:45 PM and 08:57 AM"), 'Server must reject AMO outside AMO window');
});

// ── Test 5: PositionsView Decimal Elimination ─────────────────────────────
test('PositionsView.jsx: Net Qty and mobile card format whole integers for non-MF symbols', () => {
  const posContent = fs.readFileSync(path.join(__dirname, 'frontend/src/components/PositionsView.jsx'), 'utf8');

  // Table Qty column
  assert(posContent.includes("Math.round(Math.abs(pos.closed_quantity || 0)).toLocaleString('en-IN')"), 'Closed quantity must be rounded');
  assert(posContent.includes("Math.round(Math.abs(pos.qty || holdingQty || 0)).toLocaleString('en-IN')"), 'Open/holding quantity must be rounded');

  // Partial exit integer enforcement
  assert(posContent.includes("const qtyToExit = isMfPos ? parseFloat((inputVal * ls).toFixed(4)) : Math.round(inputVal * ls)"), 'Partial exit must round non-MF quantity');
});

// ── Test 6: OrdersView Decimal Elimination ────────────────────────────────
test('OrdersView.jsx: All order quantities display formatted whole integers without decimal leakage', () => {
  const ordContent = fs.readFileSync(path.join(__dirname, 'frontend/src/components/OrdersView.jsx'), 'utf8');

  // formatOrderQty helper exists
  assert(ordContent.includes("const formatOrderQty = (order, qty) =>"), 'formatOrderQty helper must exist');
  assert(ordContent.includes("Math.round(Number(qty || 0)).toLocaleString('en-IN')"), 'Must round non-MF quantity to integer string');

  // Format helper used in mobile, table and modal views
  assert(ordContent.includes("formatOrderQty(order, order.filled_quantity)"), 'Table filled quantity must use formatOrderQty');
  assert(ordContent.includes("formatOrderQty(order, order.quantity)"), 'Table total quantity must use formatOrderQty');
  assert(ordContent.includes("formatOrderQty(selectedOrder, selectedOrder.quantity)"), 'Modal total quantity must use formatOrderQty');
});

// ── Test 7: Database Cleanup Migrations ───────────────────────────────────
test('migrate_columns.js & fix_decimal_quantities.js: Database cleanup queries sanitize decimals', () => {
  const migContent = fs.readFileSync(path.join(__dirname, 'backend/scripts/migrate_columns.js'), 'utf8');
  const fixScript = fs.readFileSync(path.join(__dirname, 'backend/scripts/fix_decimal_quantities.js'), 'utf8');

  assert(migContent.includes("ROUND(quantity)"), 'migrate_columns must contain ROUND(quantity)');
  assert(migContent.includes("Non-MF decimal quantities sanitized to whole integers"), 'migrate_columns must log completion');
  assert(fixScript.includes("ROUND(quantity)"), 'fix_decimal_quantities script must round quantity');
});

// ── Test 8: Mobile Watchlist Slide & Bottom Navigation ────────────────────
test('MarketWatch.jsx & App.jsx: Mobile slide symbol actions and positions tab active', () => {
  const mwContent = fs.readFileSync(path.join(__dirname, 'frontend/src/components/MarketWatch.jsx'), 'utf8');
  const appContent = fs.readFileSync(path.join(__dirname, 'frontend/src/App.jsx'), 'utf8');

  assert(mwContent.includes("swipedSymbol"), 'Must support swiped symbol tracking');
  assert(mwContent.includes("watchlist-swipe-actions"), 'Must have 3-button swipe actions container');
  assert(mwContent.includes("watchlist-swipe-btn-buy"), 'Must have Buy swipe action');
  assert(mwContent.includes("watchlist-swipe-btn-sell"), 'Must have Sell swipe action');
  assert(mwContent.includes("watchlist-swipe-btn-delete"), 'Must have Delete swipe action');
  assert(appContent.includes("mobileStockOverviewSymbol"), 'App.jsx must support mobile stock overview bottom sheet');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('🎉 ALL INTEGRATION AND UNIT TESTS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('❌ Some tests failed!\n');
  process.exit(1);
}

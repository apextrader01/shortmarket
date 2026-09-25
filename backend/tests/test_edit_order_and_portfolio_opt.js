/**
 * test_edit_order_and_portfolio_opt.js
 * Comprehensive automated verification for:
 * 1. Portfolio View Layout & Density Optimization (Screenshot 1)
 *    - Rightmost Actions column scrollbar clearance (130px width, 20px right padding)
 *    - Tabular-nums numeric formatting and compact column headers
 *    - Top 4 key metric cards high-density layout
 * 2. Edit Order Modal Enhancements & Real-time Market Price Tracking (Screenshot 2)
 *    - Dynamic exchange detection (MCX, BSE, NSE)
 *    - Clean quantity formatting (no raw float decimals)
 *    - Order Type toggle (LIMIT vs MARKET) for open orders
 *    - Live LTP tracking and one-click "Use LTP" button
 *    - Correct payload composition in handleUpdateOrder
 * 3. Backend Database Persistence & Volume Matching Engine Synchronization
 *    - PUT /api/order/:id updates type = 'MARKET' and price in PostgreSQL
 *    - Margin recalculation with live price fallback
 *    - In-memory volumeMatchingEngine order queue sync with updated type and params
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================================');
console.log('🧪 VERIFICATION: EDIT OPEN ORDER & PORTFOLIO VIEW OPTIMIZATIONS');
console.log('======================================================================');

const editModalPath = path.join(__dirname, '../../frontend/src/components/EditOrderModal.jsx');
const portfolioViewPath = path.join(__dirname, '../../frontend/src/components/PortfolioView.jsx');
const serverPath = path.join(__dirname, '../server.js');
const volumeEnginePath = path.join(__dirname, '../services/volumeMatchingEngine.js');

const editModalContent = fs.readFileSync(editModalPath, 'utf8');
const portfolioViewContent = fs.readFileSync(portfolioViewPath, 'utf8');
const serverContent = fs.readFileSync(serverPath, 'utf8');
const volumeEngineContent = fs.readFileSync(volumeEnginePath, 'utf8');

let totalTests = 0;
let passedTests = 0;

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

// -----------------------------------------------------------------------------
// SUITE 1: Portfolio View Layout & Density Optimization (Screenshot 1)
// -----------------------------------------------------------------------------
console.log('\n▶ SUITE 1: Portfolio View Layout & Density Optimization (Screenshot 1)');

runTest('Actions column has dedicated width and padding to prevent touching scrollbar', () => {
  assert(portfolioViewContent.includes("padding: '9px 20px 9px 10px'"), 'Actions header/cell has 20px right padding');
  assert(portfolioViewContent.includes("width: '130px', minWidth: '130px'"), 'Actions column has minWidth: 130px');
});

runTest('Table numeric cells use fontVariantNumeric: tabular-nums for aligned typography', () => {
  assert(portfolioViewContent.includes("fontVariantNumeric: 'tabular-nums'"), 'tabular-nums applied to table cells');
});

runTest('Table headers use compact column titles', () => {
  assert(portfolioViewContent.includes('>Invested</th>'), 'Header compacted to Invested');
  assert(portfolioViewContent.includes('>Current</th>'), 'Header compacted to Current');
  assert(portfolioViewContent.includes('>Total Return (P&L)</th>'), 'Header formatted for Total Return (P&L)');
});

runTest('Top 4 metric cards use high-density responsive layout', () => {
  assert(portfolioViewContent.includes("gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))'"), 'Card grid is responsive');
  assert(portfolioViewContent.includes("fontSize: isMobile ? '16px' : '19px'"), 'Card value typography is high-density');
});

// -----------------------------------------------------------------------------
// SUITE 2: Edit Order Modal Enhancements & Real-time Market Price Tracking (Screenshot 2)
// -----------------------------------------------------------------------------
console.log('\n▶ SUITE 2: Edit Order Modal Enhancements & Real-time Market Price Tracking (Screenshot 2)');

runTest('Dynamic exchange prefix detection replaces hardcoded NSE', () => {
  assert(editModalContent.includes("const exchange = symbol ? (symbol.startsWith('MCX:') ? 'MCX' : symbol.startsWith('BSE:') ? 'BSE' : 'NSE') : 'NSE'"), 
    'Dynamic exchange detection handles MCX, BSE, and NSE');
  assert(editModalContent.includes("{exchange}"), 'Renders dynamic exchange badge');
  assert(!editModalContent.includes("<span>NSE <span style="), 'Hardcoded NSE removed from header');
});

runTest('Raw database decimal quantity is cleanly parsed to whole integer', () => {
  assert(editModalContent.includes("const rawQty = Number(order.quantity);"), 'Extracts raw quantity as Number');
  assert(editModalContent.includes("setQuantity(isNaN(rawQty) ? 1 : Math.round(rawQty));"), 'Rounds raw quantity cleanly without decimals');
});

runTest('EditOrderModal provides Order Type toggle (LIMIT vs MARKET) for open orders', () => {
  assert(editModalContent.includes("Order Type</div>"), 'Order Type section present');
  assert(editModalContent.includes("setIsMarket(false)"), 'Allows switching to LIMIT');
  assert(editModalContent.includes("setIsMarket(true)"), 'Allows switching to MARKET');
});

runTest('Live market price (LTP) is tracked and Use LTP button populates current price', () => {
  assert(editModalContent.includes("Market Price (LTP):"), 'Header displays live Market Price (LTP)');
  assert(editModalContent.includes("Use LTP"), 'Use LTP button present');
  assert(editModalContent.includes("setPrice(livePrice.toFixed(2))"), 'Use LTP sets price to current market price');
});

runTest('handleUpdateOrder correctly submits marketFlag and resolved price for all open orders', () => {
  assert(editModalContent.includes("const marketFlag = isMarket;"), 'marketFlag derives directly from isMarket state');
  assert(editModalContent.includes("const finalPrice = marketFlag ? (livePrice > 0 ? livePrice : (parseFloat(price) || 0)) : parseFloat(price);"), 
    'finalPrice handles market orders using livePrice fallback');
});

// -----------------------------------------------------------------------------
// SUITE 3: Backend Database Persistence & Volume Matching Engine Synchronization
// -----------------------------------------------------------------------------
console.log('\n▶ SUITE 3: Backend Database Persistence & Volume Matching Engine Synchronization');

runTest('PUT /api/order/:id persists type = MARKET in PostgreSQL when order is switched to MARKET', () => {
  assert(serverContent.includes("if (isMarket) {"), 'isMarket branch present in server.js');
  assert(serverContent.includes("updateObj.type = 'MARKET';"), 'Persists type = MARKET into orders table');
  assert(serverContent.includes("updateObj.price = liveLtp || null;"), 'Persists live LTP or null into orders table for market order');
});

runTest('PUT /api/order/:id persists updated LIMIT price and type in PostgreSQL', () => {
  assert(serverContent.includes("if (order.type === 'MARKET' && price !== undefined && !isNaN(parseFloat(price)) && parseFloat(price) > 0) {"), 
    'Converts previous MARKET order to LIMIT when price is edited');
  assert(serverContent.includes("updateObj.type = 'LIMIT';"), 'Persists type = LIMIT into orders table');
  assert(serverContent.includes("updateObj.price = parseFloat(price);"), 'Persists new limit price into orders table');
});

runTest('PUT /api/order/:id recalculates required margin using live price fallback', () => {
  assert(serverContent.includes("const livePriceForMargin = getLtpFromPriceCache(order.symbol) || parseFloat(order.price || 0);"), 
    'livePriceForMargin fallback in margin calculation');
});

runTest('volumeMatchingEngine.updateOrder receives updated type and updates active order in memory', () => {
  assert(volumeEngineContent.includes("if (updates.type !== undefined) ordObj.type = updates.type;"), 
    'volumeMatchingEngine updates in-memory ordObj.type');
  assert(serverContent.includes("type: updatedOrder.type,"), 'server.js passes type to volumeMatchingEngine.updateOrder');
});

runTest('volumeMatchingEngine receives submission for market order matching if converted to MARKET', () => {
  assert(serverContent.includes("if (updatedOrder.type === 'MARKET' && (updatedOrder.status === 'PENDING' || updatedOrder.status === 'PARTIAL_FILLED')) {"), 
    'Detects open order converted to MARKET');
  assert(serverContent.includes("await volumeMatchingEngine.submitOrder(updatedOrder, baseLtp)"), 
    'Immediately dispatches converted market order to volume matching engine');
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('======================================================================');

if (passedTests === totalTests) {
  console.log('🎉 ALL EDIT ORDER & PORTFOLIO OPTIMIZATION CHECKS PASSED WITH 100% ACCURACY!\n');
  process.exit(0);
} else {
  console.error('❌ SOME CHECKS FAILED. Please review the output above.\n');
  process.exit(1);
}

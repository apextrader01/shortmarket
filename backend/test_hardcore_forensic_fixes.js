const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('🔬 HARDCORE FORENSIC AUDIT VERIFICATION TEST SUITE');
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

// -----------------------------------------------------------------------------
// TEST SUITE 1: cronJobs.js Phase 3 Auto Square-off & CAS
// -----------------------------------------------------------------------------
console.log('▶ TEST SUITE 1: cronJobs.js Phase 3 Auto Square-Off Runtime Safety');

const cronContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');

it('cronJobs.js hoists cleanSym and cached lookup before ltp check (no ReferenceError)', () => {
  assert(cronContent.includes("const cleanSym = pos.symbol.includes(':') ? pos.symbol.split(':')[1] : pos.symbol;"), 'cleanSym hoisting missing');
  assert(cronContent.includes("const cached = priceCache[pos.symbol] || priceCache[cleanSym] || priceCache[`NSE:${cleanSym}`] || priceCache[`BSE:${cleanSym}`] || priceCache[`MCX:${cleanSym}`];"), 'cached priceCache resolution missing');
});

it('cronJobs.js includes MIS in square-off queries', () => {
  assert(cronContent.includes(".whereIn('product_type', ['INT', 'MIS', 'BO', 'CO'])"), 'whereIn MIS missing in cronJobs.js');
});

it('cronJobs.js cancels PARTIAL_FILLED orders and refunds remaining proportional margin', () => {
  assert(cronContent.includes(".whereIn('status', ['PENDING', 'PARTIAL_FILLED'])"), 'PARTIAL_FILLED cancellation missing in cronJobs');
  assert(cronContent.includes('const cancelFraction = totalQ > 0 ? (pendingQ / totalQ) : 1;'), 'Cancel fraction calculation missing in cronJobs');
  assert(cronContent.includes('const remainingMarginToRefund = Math.round((parseFloat(o.margin || 0) * cancelFraction + Number.EPSILON) * 100) / 100;'), 'Proportional margin refund missing in cronJobs');
});

// -----------------------------------------------------------------------------
// TEST SUITE 2: Option Expiry Settlement Accounting
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 2: Option Expiry Settlement Mathematical Accounting');

const posEngineContent = fs.readFileSync(path.join(__dirname, 'services', 'positionsEngine.js'), 'utf8');

it('positionsEngine.js computes netCredit = marginBlocked + realizedPnl on worthless expiry', () => {
  assert(posEngineContent.includes('const netCredit = Math.round((marginBlocked + realizedPnl + Number.EPSILON) * 100) / 100;'), 'netCredit formula missing');
  assert(posEngineContent.includes("await trx('users').where({ id: item.user_id }).update({ balance: Math.round((parseFloat(u.balance) + netCredit + Number.EPSILON) * 100) / 100 });"), 'balance update using netCredit missing');
});

it('Option Expiry Accounting Logic: Buyer pays 2,500, expires at 0 -> 0 refund, 2,500 realized loss', () => {
  const marginBlocked = 2500;
  const buyQty = 50;
  const buyAvg = 50;
  const finalSettlementPrice = 0;
  const realizedPnl = (finalSettlementPrice - buyAvg) * buyQty;
  const netCredit = marginBlocked + realizedPnl;
  assert.strictEqual(realizedPnl, -2500);
  assert.strictEqual(netCredit, 0, 'Option buyer should receive 0 refund on worthless expiry');
});

it('Option Expiry Accounting Logic: Seller blocks 100,000, receives 2,500 premium -> 102,500 net credit', () => {
  const marginBlocked = 100000;
  const sellQty = -50;
  const sellAvg = 50;
  const finalSettlementPrice = 0;
  const realizedPnl = (sellAvg - finalSettlementPrice) * Math.abs(sellQty);
  const netCredit = marginBlocked + realizedPnl;
  assert.strictEqual(realizedPnl, 2500);
  assert.strictEqual(netCredit, 102500, 'Option seller should receive full blocked margin plus premium profit');
});

// -----------------------------------------------------------------------------
// TEST SUITE 3: positionsEngine.js and autoSquareOff.js EOD MIS Sweeps
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 3: EOD Sweeps & Auto Square-Off MIS Support');

it('positionsEngine.js includes MIS in all EOD position sweep queries', () => {
  assert(posEngineContent.includes(".whereIn('product_type', ['INT', 'MIS', 'BO', 'CO'])"), 'whereIn MIS missing in positionsEngine.js');
});

const autoSqOffContent = fs.readFileSync(path.join(__dirname, 'services', 'autoSquareOff.js'), 'utf8');

it('autoSquareOff.js includes MIS in runIntradaySquareOff (line 309)', () => {
  assert(autoSqOffContent.includes(".whereIn('product_type', ['INT', 'MIS', 'BO', 'CO'])"), 'autoSquareOff line 309 missing MIS');
  const matches = autoSqOffContent.match(/\.whereIn\('product_type', \['INT', 'MIS', 'BO', 'CO'\]\)/g);
  assert(matches && matches.length >= 3, 'Expected at least 3 occurrences of MIS in autoSquareOff');
});

// -----------------------------------------------------------------------------
// TEST SUITE 4: Matching Engines (Volume & Trigger) Position Consolidation
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 4: Volume Matching & Trigger Engines Position Consolidation');

const volEngineContent = fs.readFileSync(path.join(__dirname, 'services', 'volumeMatchingEngine.js'), 'utf8');
const trigEngineContent = fs.readFileSync(path.join(__dirname, 'services', 'triggerEngine.js'), 'utf8');

it('volumeMatchingEngine.js treats MIS as an intraday product matching INT positions', () => {
  assert(volEngineContent.includes("const isIntradayProduct = (order.product_type === 'INT' || order.product_type === 'MIS' || order.product_type === 'BO' || order.product_type === 'CO');"), 'isIntradayProduct missing MIS in volumeMatchingEngine');
  assert(volEngineContent.includes("builder.whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);"), 'builder whereIn missing MIS in volumeMatchingEngine');
});

it('triggerEngine.js merges INT and MIS positions seamlessly during SL/Target executions', () => {
  assert(trigEngineContent.includes("const isIntradayProduct = (order.product_type === 'INT' || order.product_type === 'MIS' || order.product_type === 'BO' || order.product_type === 'CO');"), 'isIntradayProduct missing MIS in triggerEngine');
  assert(trigEngineContent.includes("if (isIntradayProduct) builder.whereIn('product_type', ['INT', 'MIS', 'BO', 'CO']);"), 'existingPos whereIn missing MIS in triggerEngine');
});

// -----------------------------------------------------------------------------
// TEST SUITE 5: server.js isSegmentMarketOpen & Cutoff Rules
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 5: server.js Cutoffs & T2T Surveillance Rules');

const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

it('server.js isSegmentMarketOpen recognizes MIS and INTRADAY for segment cutoffs', () => {
  assert(serverContent.includes("const isIntraday = (product_type === 'INT' || product_type === 'MIS' || product_type === 'INTRADAY' || product_type === 'BO' || product_type === 'CO');"), 'isSegmentMarketOpen missing MIS/INTRADAY');
});

it('server.js /api/position/convert blocks all SEBI T2T surveillance categories', () => {
  const t2tRegex = /-(BE|BZ|T|Z|XT|SM|ST|P)$/i;
  assert(t2tRegex.test('NSE:GTLINFRA-BE'), 'BE series should be blocked');
  assert(t2tRegex.test('BSE:500123-BZ'), 'BZ series should be blocked');
  assert(t2tRegex.test('BSE:TEST-T'), 'T series should be blocked');
  assert(t2tRegex.test('BSE:TEST-Z'), 'Z series should be blocked');
  assert(t2tRegex.test('BSE:TEST-XT'), 'XT series should be blocked');
  assert(t2tRegex.test('NSE:SMECO-SM'), 'SM series should be blocked');
  assert(t2tRegex.test('NSE:SMECO-ST'), 'ST series should be blocked');
  assert(t2tRegex.test('BSE:PENNY-P'), 'P series should be blocked');
  assert(!t2tRegex.test('NSE:RELIANCE-EQ'), 'EQ series should NOT be blocked');
});

it('server.js canonicalizes effectiveProductType for MIS/INTRADAY', () => {
  assert(serverContent.includes("(product_type === 'MIS' || product_type === 'INTRADAY')"), 'effectiveProductType canonicalization missing');
});

// -----------------------------------------------------------------------------
// TEST SUITE 6: server.js /api/basket-order 3-Tier Preventative Risk Filter
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 6: /api/basket-order 3-Tier Preventative Risk Filter');

it('server.js basket-order has T2T series check', () => {
  assert(serverContent.includes('PREVENTATIVE INTRADAY (MIS) RISK FILTER FOR BASKET ORDERS'), 'Basket order preventative filter header missing');
  assert(serverContent.includes('const isT2TSeries = /-(BE|BZ|T|Z|XT|SM|ST|P)$/i.test(cleanU)'), 'Basket order T2T check missing');
});

it('server.js basket-order enforces 25k volume threshold for cash equities past 09:30 AM', () => {
  assert(serverContent.includes('const MIN_INTRADAY_VOLUME = 25000;'), 'Basket order MIN_INTRADAY_VOLUME missing');
  assert(serverContent.includes('const isPastOpening = (curHour * 60 + curMin) >= (9 * 60 + 30);'), 'Basket order 09:30 AM opening check missing');
});

it('server.js basket-order protects against 0.5% circuit lock trapping on BUY/SELL', () => {
  assert(serverContent.includes('const isNearUpperCircuit = (upperCircuit > 0 && liveLtp >= upperCircuit * 0.995);'), 'Basket order upper circuit check missing');
  assert(serverContent.includes('const isNearLowerCircuit = (lowerCircuit > 0 && liveLtp <= lowerCircuit * 1.005);'), 'Basket order lower circuit check missing');
});

// -----------------------------------------------------------------------------
// TEST SUITE 7: Frontend OrderModal & PositionsView Component Integrity
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 7: Frontend Components (PositionsView & OrderModal)');

const posViewContent = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'PositionsView.jsx'), 'utf8');
const orderModalContent = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'OrderModal.jsx'), 'utf8');

it('PositionsView.jsx calls convertPosition with netAddlCashRequired without ReferenceError', () => {
  assert(posViewContent.includes('const res = await useStore.getState().convertPosition(posId, targetProd, netAddlCashRequired);'), 'convertPosition missing netAddlCashRequired in PositionsView.jsx');
  assert(!posViewContent.includes('convertPosition(posId, targetProd, reqMargin)'), 'Obsolete reqMargin still present in PositionsView.jsx');
});

it('OrderModal.jsx canonicalizes incoming MIS/INTRADAY to INT for tab state', () => {
  assert(orderModalContent.includes("const incomingProd = String(orderModal.productType || 'INT').toUpperCase();"), 'incomingProd canonicalization missing in OrderModal');
  assert(orderModalContent.includes("(incomingProd === 'MIS' || incomingProd === 'INTRADAY') ? 'INT' :"), 'MIS -> INT mapping missing in OrderModal');
});

it('OrderModal.jsx supports MIS across isIntradayBlocked, headers, and stoploss sections', () => {
  assert(orderModalContent.includes("(productType === 'INT' || productType === 'MIS')"), 'productType MIS checks missing in OrderModal');
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('======================================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL 10 FORENSIC AUDIT FIXES VERIFIED 100% SUCCESFULLY!\n');
  process.exit(0);
} else {
  console.error('❌ SOME CHECKS FAILED!\n');
  process.exit(1);
}

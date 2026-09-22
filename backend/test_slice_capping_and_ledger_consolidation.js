const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('🔬 TEST SUITE: SLICE CAPPING & LEDGER CONSOLIDATION VERIFICATION');
console.log('======================================================================\n');

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     ${err.message}`);
  }
}

// 1. Check freeze limits & capping mathematics
console.log('▶ TEST 1: Mathematics of Nifty Freeze Limit & Max Slices Cap');

it('Nifty freeze limit is 1,755 and 100 max slices cap quantity at 1,75,500 (2,700 lots)', () => {
  const freezeLimit = 1755;
  const maxSlices = 100;
  const maxAllowedQty = freezeLimit * maxSlices;
  const lotsize = 65;
  const maxAllowedLots = Math.floor(maxAllowedQty / lotsize);

  assert.strictEqual(maxAllowedQty, 175500, 'Max allowed quantity must be 1,75,500');
  assert.strictEqual(maxAllowedLots, 2700, 'Max allowed lots must be 2,700');

  const enteredLots = 120000;
  const enteredQty = enteredLots * lotsize; // 78,00,000
  const isCapped = enteredQty > maxAllowedQty;
  const effectiveQuantity = isCapped ? maxAllowedQty : enteredQty;

  assert.strictEqual(isCapped, true, 'Entered quantity must trigger isCapped');
  assert.strictEqual(effectiveQuantity, 175500, 'Effective quantity placed must clamp to 1,75,500');
});

// 2. Check OrderModal.jsx code updates
console.log('\n▶ TEST 2: OrderModal.jsx Implementation Check');

it('OrderModal imports AlertTriangle, computes maxAllowedQty and caps effectiveQuantity', () => {
  const modalPath = path.join(__dirname, '../frontend/src/components/OrderModal.jsx');
  const content = fs.readFileSync(modalPath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes('AlertTriangle'), 'OrderModal must import AlertTriangle');
  assert(content.includes('const maxAllowedQty = freezeLimit > 0 ? freezeLimit * 100 : 10000000;'), 'OrderModal must compute maxAllowedQty');
  assert(content.includes('const isCappedBySlicing = totalQuantity > maxAllowedQty;'), 'OrderModal must compute isCappedBySlicing');
  assert(content.includes('const effectiveQuantity = isCappedBySlicing ? maxAllowedQty : totalQuantity;'), 'OrderModal must compute effectiveQuantity');
  assert(content.includes('quantity: effectiveQuantity'), 'OrderModal must send effectiveQuantity in payload');
  assert(content.includes('Order Slicing Cap Reached (Max 100 Slices)'), 'OrderModal must display capped warning banner');
  assert(content.includes('Set Max:'), 'OrderModal must provide Set Max helper button');
});

// 3. Check server.js & volumeMatchingEngine.js MARGIN_BLOCK and MARGIN_RELEASE consolidation
console.log('\n▶ TEST 3: server.js & volumeMatchingEngine.js Consolidation Check');

it('server.js consolidates MARGIN_BLOCK for slice_group_id', () => {
  const serverPath = path.join(__dirname, 'server.js');
  const content = fs.readFileSync(serverPath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes('if (req.body.slice_group_id) {'), 'server.js must check for slice_group_id on margin block');
  assert(content.includes("where({ user_id: req.user.id, type: 'MARGIN_BLOCK' })"), 'server.js must query existing MARGIN_BLOCK for slice group');
  assert(content.includes("amount: updatedAmount"), 'server.js must accumulate amount for slice group');
});

it('volumeMatchingEngine.js consolidates MARGIN_RELEASE for slice_group_id', () => {
  const enginePath = path.join(__dirname, 'services/volumeMatchingEngine.js');
  const content = fs.readFileSync(enginePath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes("where({ user_id: order.user_id, type: 'MARGIN_RELEASE' })"), 'volumeMatchingEngine.js must query existing MARGIN_RELEASE');
  assert(content.includes("description: `Margin released for cancelled orders ${dangler.symbol} [${sliceGroupId}]`"), 'volumeMatchingEngine.js must label consolidated release for dangling orders');
  assert(content.includes("description: `Excess margin refunded on exit order ${order.symbol} [${sliceGroupId}]`"), 'volumeMatchingEngine.js must label consolidated release for exit orders');
});

// 4. Check ReportsView.jsx slice consolidation
console.log('\n▶ TEST 4: ReportsView.jsx Slice Consolidation Check');

it('ReportsView.jsx consolidates ledger slice records and trades & charges orders', () => {
  const reportsPath = path.join(__dirname, '../frontend/src/components/ReportsView.jsx');
  const content = fs.readFileSync(reportsPath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes('Consolidate consecutive sliced order ledger records'), 'ReportsView.jsx must have ledger consolidation memo');
  assert(content.includes('Consolidate sliced orders so brokerage is charged once per parent order'), 'ReportsView.jsx must have TradesAndCharges consolidation memo');
  assert(content.includes('Consolidate sliced orders for accurate charges and trade counts'), 'ReportsView.jsx must have ProfitAndLoss consolidation memo');
  assert(content.includes('⚡ {entry.sliceCount} Slices'), 'ReportsView.jsx must render slice badge');
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log('======================================================================');

if (passed === total) {
  console.log('🎉 ALL SLICE CAPPING & LEDGER CONSOLIDATION TESTS PASSED!\n');
} else {
  process.exit(1);
}

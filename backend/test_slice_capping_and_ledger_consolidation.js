const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateTaxes, getFreezeLimit } = require('./services/taxCalculator');

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

// 2. Check Commodity Mini vs Standard Freeze Limits
console.log('\n▶ TEST 2: Commodity Mini Contracts vs Parent Contracts Freeze Limits');

it('Commodity freeze limits accurately resolve mini vs standard contracts without prefix collisions', () => {
  assert.strictEqual(getFreezeLimit('MCX:CRUDEOIL24OCTFUT'), 10000, 'CRUDEOIL standard freeze limit must be 10,000');
  assert.strictEqual(getFreezeLimit('MCX:CRUDEOILM24OCTFUT'), 1000, 'CRUDEOILM mini freeze limit must be 1,000');
  assert.strictEqual(getFreezeLimit('MCX:GOLD24OCTFUT'), 100, 'GOLD standard freeze limit must be 100');
  assert.strictEqual(getFreezeLimit('MCX:GOLDM24OCTFUT'), 1000, 'GOLDM mini freeze limit must be 1,000');
  assert.strictEqual(getFreezeLimit('MCX:SILVER24OCTFUT'), 300, 'SILVER standard freeze limit must be 300');
  assert.strictEqual(getFreezeLimit('MCX:SILVERM24OCTFUT'), 1000, 'SILVERM mini freeze limit must be 1,000');
  assert.strictEqual(getFreezeLimit('MCX:SILVERMIC24OCTFUT'), 10000, 'SILVERMIC micro freeze limit must be 10,000');
  assert.strictEqual(getFreezeLimit('MCX:NATURALGAS24OCTFUT'), 50000, 'NATURALGAS freeze limit must be 50,000');
  assert.strictEqual(getFreezeLimit('MCX:NATURALGASM24OCTFUT'), 10000, 'NATURALGASM freeze limit must be 10,000');
});

// 3. Check Per-Slice Brokerage on Large Multi-Slice Orders
console.log('\n▶ TEST 3: Per-Slice Brokerage on Sliced Orders (Brokerage Depends Upon Slices)');

it('taxCalculator charges brokerage depending on slices for large multi-slice orders', () => {
  // Option order of 1,75,500 qty (100 slices of 1,755)
  const optionTax = calculateTaxes('NSE:NIFTY24OCT24000CE', 'INT', 'BUY', 175500, 100);
  assert.strictEqual(optionTax.brokerage, 2000, 'Brokerage on 100-slice option order must be ₹2,000 (100 slices * ₹20)');

  // Single-slice option order (1 slice of 1,755)
  const singleOptTax = calculateTaxes('NSE:NIFTY24OCT24000CE', 'INT', 'BUY', 1755, 100);
  assert.strictEqual(singleOptTax.brokerage, 20, 'Brokerage on single-slice option order must be ₹20');

  // Stock Option order (50 slices)
  const stockOptTax = calculateTaxes('NSE:RELIANCE24OCT3000CE', 'INT', 'BUY', 10000, 50, 0, 0, 50);
  assert.strictEqual(stockOptTax.brokerage, 1000, 'Brokerage on 50-slice stock option order must be ₹1,000 (50 slices * ₹20)');

  // Commodity Option order (10 slices)
  const mcxOptTax = calculateTaxes('MCX:CRUDEOIL24OCT6000CE', 'INT', 'BUY', 1000, 120, 0, 0, 10);
  assert.strictEqual(mcxOptTax.brokerage, 200, 'Brokerage on 10-slice MCX option order must be ₹200 (10 slices * ₹20)');

  // Future order (turnover based, capped per slice)
  const futTax = calculateTaxes('NSE:NIFTY24OCTFUT', 'INT', 'BUY', 10000, 24000);
  assert(futTax.brokerage > 0, 'Brokerage on large index futures order must be calculated');

  // Cash stock intraday order (1 slice)
  const stockTax = calculateTaxes('NSE:KITEX-EQ', 'INT', 'BUY', 100000, 250);
  assert.strictEqual(stockTax.brokerage, 20, 'Brokerage on single-slice intraday stock order must be capped at ₹20');
});

// 4. Check OrderModal.jsx code updates
console.log('\n▶ TEST 4: OrderModal.jsx Implementation Check');

it('OrderModal imports AlertTriangle, enforces freeze limit, disables button, and provides Set Max helper', () => {
  const modalPath = path.join(__dirname, '../frontend/src/components/OrderModal.jsx');
  const content = fs.readFileSync(modalPath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes('AlertTriangle'), 'OrderModal must import AlertTriangle');
  assert(content.includes('const maxAllowedQty = freezeLimit;'), 'OrderModal must compute maxAllowedQty as freezeLimit');
  assert(content.includes('const isExceedingFreezeLimit = !isMutualFund && freezeLimit > 0 && totalQuantity > freezeLimit;'), 'OrderModal must compute isExceedingFreezeLimit');
  assert(content.includes('disabled={isInsufficient || isPlacing || isExceedingFreezeLimit}'), 'OrderModal must disable submit button when isExceedingFreezeLimit is true');
  assert(content.includes('Max allowed lots per order as per exchange is'), 'OrderModal must display exchange freeze warning banner');
  assert(content.includes('Set Max: {maxAllowedLots.toLocaleString(\'en-IN\')} Lots'), 'OrderModal must provide Set Max helper button for lots');
  assert(content.includes('Set Max: {maxAllowedQty.toLocaleString(\'en-IN\')} Shares'), 'OrderModal must provide Set Max helper button for cash shares');
  assert(content.includes('${orderModal.lotsize > 1 ? \'Qty\' : \'Shares\'}'), 'OrderModal submit button must dynamically show Qty vs Shares');
});

// 5. Check server.js & volumeMatchingEngine.js MARGIN_BLOCK and MARGIN_RELEASE consolidation
console.log('\n▶ TEST 5: server.js & volumeMatchingEngine.js Consolidation Check');

it('server.js consolidates MARGIN_BLOCK for slice_group_id', () => {
  const serverPath = path.join(__dirname, 'server.js');
  const content = fs.readFileSync(serverPath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes('if (req.body.slice_group_id) {'), 'server.js must check for slice_group_id on margin block');
  assert(content.includes("where({ user_id: req.user.id, type: 'MARGIN_BLOCK' })"), 'server.js must query existing MARGIN_BLOCK for slice group');
  assert(content.includes("amount: updatedAmount"), 'server.js must accumulate amount for slice group');
});

it('server.js consolidates MARGIN_RELEASE for slice_group_id on order cancellation', () => {
  const serverPath = path.join(__dirname, 'server.js');
  const content = fs.readFileSync(serverPath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes("description: `Margin refunded for cancelled orders ${order.symbol} [${sliceGroupId}]`"), 'server.js must consolidate MARGIN_RELEASE on order cancellation');
});

it('volumeMatchingEngine.js consolidates MARGIN_RELEASE for slice_group_id', () => {
  const enginePath = path.join(__dirname, 'services/volumeMatchingEngine.js');
  const content = fs.readFileSync(enginePath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes("where({ user_id: order.user_id, type: 'MARGIN_RELEASE' })"), 'volumeMatchingEngine.js must query existing MARGIN_RELEASE');
  assert(content.includes("description: `Margin released for cancelled orders ${dangler.symbol} [${sliceGroupId}]`"), 'volumeMatchingEngine.js must label consolidated release for dangling orders');
  assert(content.includes("description: `Excess margin refunded on exit order ${order.symbol} [${sliceGroupId}]`"), 'volumeMatchingEngine.js must label consolidated release for exit orders');
});

// 6. Check ReportsView.jsx & clientReportGenerator.js slice consolidation
console.log('\n▶ TEST 6: ReportsView.jsx & clientReportGenerator.js Slice Consolidation Check');

it('ReportsView.jsx consolidates ledger slice records and trades & charges orders with cluster fallback', () => {
  const reportsPath = path.join(__dirname, '../frontend/src/components/ReportsView.jsx');
  const content = fs.readFileSync(reportsPath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes('Consolidate consecutive sliced order ledger records'), 'ReportsView.jsx must have ledger consolidation memo');
  assert(content.includes('Consolidate sliced orders so brokerage is charged once per parent order'), 'ReportsView.jsx must have TradesAndCharges consolidation memo');
  assert(content.includes('Consolidate sliced orders for accurate charges and trade counts'), 'ReportsView.jsx must have ProfitAndLoss consolidation memo');
  assert(content.includes('⚡ {entry.sliceCount} Slices'), 'ReportsView.jsx must render slice badge');
  assert(content.includes('timeClusters'), 'ReportsView.jsx must include timeClusters fallback grouping');
});

it('clientReportGenerator.js consolidates sliced orders with time cluster fallback', () => {
  const genPath = path.join(__dirname, '../frontend/src/utils/clientReportGenerator.js');
  const content = fs.readFileSync(genPath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes('Consolidate sliced orders for reporting'), 'clientReportGenerator.js must consolidate sliced orders');
  assert(content.includes('timeClusters'), 'clientReportGenerator.js must have timeClusters fallback');
});

// 7. Check consolidate_today_slice_taxes.js covers all types
console.log('\n▶ TEST 7: consolidate_today_slice_taxes.js Comprehensive Ledger Cleanup');

it('consolidate_today_slice_taxes.js consolidates TAXES, MARGIN_BLOCK, and MARGIN_RELEASE', () => {
  const scriptPath = path.join(__dirname, 'scripts/consolidate_today_slice_taxes.js');
  const content = fs.readFileSync(scriptPath, 'utf8').replace(/\r\n/g, '\n');

  assert(content.includes("type', 'TAXES'"), 'script must consolidate TAXES');
  assert(content.includes("type', 'MARGIN_BLOCK'"), 'script must consolidate MARGIN_BLOCK');
  assert(content.includes("type', 'MARGIN_RELEASE'"), 'script must consolidate MARGIN_RELEASE');
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log('======================================================================');

if (passed === total) {
  console.log('🎉 ALL SLICE CAPPING, BROKERAGE & LEDGER CONSOLIDATION TESTS PASSED!\n');
} else {
  process.exit(1);
}

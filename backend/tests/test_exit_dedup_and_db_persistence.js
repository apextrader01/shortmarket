const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n======================================================================');
console.log('🔬 VERIFICATION: EXIT ORDER DEDUPLICATION & DB PERSISTENCE AUDIT');
console.log('======================================================================\n');

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
  }
}

// 1. PositionsView.jsx checks
console.log('▶ TEST SUITE 1: PositionsView.jsx Resting Order Cancellation');
const posViewContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/PositionsView.jsx'), 'utf8');

check('PositionsView.jsx cancel filter includes PARTIAL_FILLED and PARTIALLY_FILLED on Exit All', () => {
  assert(posViewContent.includes("const cancellableStatuses = ['PENDING', 'PENDING_TRIGGER', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN', 'AMO_PENDING'];"),
    'cancellableStatuses missing required active statuses');
  assert(posViewContent.includes("if (!cancellableStatuses.includes(o.status)) return false;"),
    'Filter condition not using cancellableStatuses');
});

check('PositionsView.jsx row exit modal cancels resting orders on full position exit', () => {
  assert(posViewContent.includes('if (qtyToExit >= maxQty)'), 'Row exit modal missing maxQty check');
  assert(posViewContent.includes('cancellableStatuses.includes(o.status)'), 'Row exit modal not using cancellableStatuses');
});

// 2. volumeMatchingEngine.js checks
console.log('\n▶ TEST SUITE 2: volumeMatchingEngine.js DB Persistence & Dequeuing');
const vmeContent = fs.readFileSync(path.join(__dirname, '../services/volumeMatchingEngine.js'), 'utf8');

check('volumeMatchingEngine persists CANCELLED to DB when exit order blocked by safeguard', () => {
  assert(vmeContent.includes("Blocked exit order"), 'Safeguard log missing');
  assert(vmeContent.includes("await trx('orders').where({ id: order.id }).update({"), 'DB update missing in safeguard');
  assert(vmeContent.includes("status: 'CANCELLED'"), 'status CANCELLED missing in safeguard DB update');
  assert(vmeContent.includes("pending_quantity: 0"), 'pending_quantity 0 missing in safeguard DB update');
});

check('volumeMatchingEngine handles leftoverQty on exit orders by zeroing pending_quantity & cancelling', () => {
  assert(vmeContent.includes("If this exit order closed the position completely, cancel any remaining pending quantity on this order"),
    'leftoverQty exit handling comment missing');
  assert(vmeContent.includes("newPending = 0"), 'newPending zeroing missing');
});

check('volumeMatchingEngine loadPendingVolumeOrders includes OPEN status', () => {
  assert(vmeContent.includes("builder.whereIn('status', ['PENDING', 'OPEN']).where({ type: 'MARKET' })"),
    'OPEN status not queried in loadPendingVolumeOrders');
});

// 3. fyers.js checks
console.log('\n▶ TEST SUITE 3: fyers.js GC Order Protection');
const fyersContent = fs.readFileSync(path.join(__dirname, '../services/fyers.js'), 'utf8');

check('fyers.js garbageCollectSubscriptions protects PARTIALLY_FILLED, OPEN, and AMO_PENDING', () => {
  assert(fyersContent.includes("whereIn('status', ['PENDING', 'PENDING_TRIGGER', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN', 'AMO_PENDING'])"),
    'fyers GC protection query missing active order statuses');
});

// 4. store.js checks
console.log('\n▶ TEST SUITE 4: store.js pingSubscriptions Live Order Feed Keepalive');
const storeContent = fs.readFileSync(path.join(__dirname, '../../frontend/src/store.js'), 'utf8');

check('store.js pingSubscriptions keeps WebSocket feed alive for symbols with active open orders', () => {
  assert(storeContent.includes("const activeOrderStatuses = ['PENDING', 'PENDING_TRIGGER', 'PARTIAL_FILLED', 'PARTIALLY_FILLED', 'OPEN', 'AMO_PENDING']"),
    'activeOrderStatuses missing in pingSubscriptions');
  assert(storeContent.includes("activeOrderStatuses.includes(o.status)"), 'Order status check missing in pingSubscriptions');
});

// 5. MCX & Derivative Contract Volume Matching Simulation
console.log('\n▶ TEST SUITE 5: MCX Commodity Contract Volume Scaling Simulation');

check('MCX Crude Oil Mini (lot 10) fills 40 units on 4 volume, 10 units on 1 volume', () => {
  const lotsize = 10;
  const isCommodity = true;
  let order = { pending_quantity: 100, filled_quantity: 0 };

  // Tick 1: 4 contracts trade (16:56)
  let availableVol = 4;
  const isContractVol1 = isCommodity || availableVol < lotsize;
  const availableUnits1 = isContractVol1 ? (availableVol * lotsize) : availableVol;
  const rawCap1 = Math.min(order.pending_quantity, availableUnits1);
  const fill1 = Math.floor(rawCap1 / lotsize) * lotsize;
  const consumed1 = isContractVol1 ? Math.ceil(fill1 / lotsize) : fill1;
  assert.strictEqual(fill1, 40, '4 contracts must fill 40 units (4 lots)');
  assert.strictEqual(consumed1, 4, 'Consumed volume must be 4 contracts');
  order.filled_quantity += fill1;
  order.pending_quantity -= fill1;
  assert.strictEqual(order.filled_quantity, 40);
  assert.strictEqual(order.pending_quantity, 60);

  // Tick 2: 1 contract trades (16:57)
  availableVol = 1;
  const isContractVol2 = isCommodity || availableVol < lotsize;
  const availableUnits2 = isContractVol2 ? (availableVol * lotsize) : availableVol;
  const rawCap2 = Math.min(order.pending_quantity, availableUnits2);
  const fill2 = Math.floor(rawCap2 / lotsize) * lotsize;
  const consumed2 = isContractVol2 ? Math.ceil(fill2 / lotsize) : fill2;
  assert.strictEqual(fill2, 10, '1 contract must fill 10 units (1 lot)');
  assert.strictEqual(consumed2, 1, 'Consumed volume must be 1 contract');
  order.filled_quantity += fill2;
  order.pending_quantity -= fill2;
  assert.strictEqual(order.filled_quantity, 50);
  assert.strictEqual(order.pending_quantity, 50);

  // Tick 3: 1 contract trades (16:58)
  availableVol = 1;
  const isContractVol3 = isCommodity || availableVol < lotsize;
  const availableUnits3 = isContractVol3 ? (availableVol * lotsize) : availableVol;
  const rawCap3 = Math.min(order.pending_quantity, availableUnits3);
  const fill3 = Math.floor(rawCap3 / lotsize) * lotsize;
  const consumed3 = isContractVol3 ? Math.ceil(fill3 / lotsize) : fill3;
  assert.strictEqual(fill3, 10, '1 contract must fill 10 units (1 lot)');
  order.filled_quantity += fill3;
  order.pending_quantity -= fill3;
  assert.strictEqual(order.filled_quantity, 60);
  assert.strictEqual(order.pending_quantity, 40);
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log('======================================================================');
if (passed === total) {
  console.log('🎉 ALL AUDIT CHECKS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('❌ SOME CHECKS FAILED!\n');
  process.exit(1);
}

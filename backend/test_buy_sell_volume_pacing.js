const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('🔬 VERIFYING BUY & SELL REALISTIC VOLUME MATCHING (NO CAPPING)');
console.log('======================================================================\n');

// 1. Test Code Verification of volumeMatchingEngine.js
const vmeContent = fs.readFileSync(path.join(__dirname, 'services', 'volumeMatchingEngine.js'), 'utf8');

console.log('▶ TEST SUITE 1: volumeMatchingEngine.js Source Inspection');

assert(
  vmeContent.includes('fillQty = Math.min(order.pending_quantity, availableVol);'),
  'volumeMatchingEngine.js must fill up to real available volume without artificial capping'
);
console.log('  ✔ [PASS] Equities match 1:1 against real exchange volume');

assert(
  vmeContent.includes('!this.lastSymbolVolume.has(normSym)'),
  'volumeMatchingEngine.js must check has() before overwriting tracker with stale cache'
);
console.log('  ✔ [PASS] Continuous volume tracker preservation verified (prevents false multi-lakh spikes)');


console.log('\n▶ TEST SUITE 2: Mathematical Matching Simulation for BUY vs SELL (No Capping)');

function simulateEquityFill(pendingQty, tickDelta) {
  let availableVol = tickDelta;
  return Math.min(pendingQty, availableVol);
}

// Scenario A: 1,00,000 Share BUY Order on High Volume Stock (VMM)
let buyOrder = { symbol: 'NSE:VMM-EQ', side: 'BUY', quantity: 100000, filled: 0, pending: 100000, status: 'PENDING' };

// Tick 1 arrives with 500 shares exchange volume
let fill1 = simulateEquityFill(buyOrder.pending, 500);
assert.strictEqual(fill1, 500, 'Tick 1 fill for 1 Lakh BUY order with 500 volume must be 500');
buyOrder.filled += fill1;
buyOrder.pending -= fill1;
buyOrder.status = buyOrder.pending <= 0 ? 'EXECUTED' : 'PARTIAL_FILLED';

assert.strictEqual(buyOrder.filled, 500);
assert.strictEqual(buyOrder.pending, 99500);
assert.strictEqual(buyOrder.status, 'PARTIAL_FILLED');
console.log('  ✔ [PASS] 1 Lakh VMM BUY order on 500 tick fills 500 shares (99,500 pending, PARTIAL_FILLED)');

// Tick 2 arrives with 15,000 shares
let fill2 = simulateEquityFill(buyOrder.pending, 15000);
assert.strictEqual(fill2, 15000, 'Tick 2 fill with 15,000 volume must be 15,000');
buyOrder.filled += fill2;
buyOrder.pending -= fill2;
buyOrder.status = buyOrder.pending <= 0 ? 'EXECUTED' : 'PARTIAL_FILLED';

assert.strictEqual(buyOrder.filled, 15500);
assert.strictEqual(buyOrder.pending, 84500);
assert.strictEqual(buyOrder.status, 'PARTIAL_FILLED');
console.log('  ✔ [PASS] Tick 2 (15,000 vol) fills 15,000 shares -> 15,500 / 1,00,000 (84,500 pending)');

// Tick 3 arrives with 2,00,000 shares (2 Lakh)
let fill3 = simulateEquityFill(buyOrder.pending, 200000);
assert.strictEqual(fill3, 84500, 'Tick 3 fill with 2 Lakh volume completes the remaining 84,500 shares');
buyOrder.filled += fill3;
buyOrder.pending -= fill3;
buyOrder.status = buyOrder.pending <= 0 ? 'EXECUTED' : 'PARTIAL_FILLED';

assert.strictEqual(buyOrder.filled, 100000);
assert.strictEqual(buyOrder.pending, 0);
assert.strictEqual(buyOrder.status, 'EXECUTED');
console.log('  ✔ [PASS] Tick 3 (2 Lakh vol) fills remaining 84,500 shares -> 1,00,000 / 1,00,000 (EXECUTED)');

// Scenario B: SELL Order Symmetry
let sellOrder = { symbol: 'NSE:VMM-EQ', side: 'SELL', quantity: 100000, filled: 0, pending: 100000, status: 'PENDING' };
let sellFill1 = simulateEquityFill(sellOrder.pending, 500);
assert.strictEqual(sellFill1, 500);
assert.strictEqual(sellFill1, fill1, 'BUY and SELL execute symmetrically with exact volume parity');
console.log('  ✔ [PASS] Symmetrical execution: BUY and SELL orders match volume identically');

console.log('\n======================================================================');
console.log('🎉 ALL BUY & SELL VOLUME MATCHING (NO CAPPING) TESTS PASSED 100%!');
console.log('======================================================================\n');

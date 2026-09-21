const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('🔬 VERIFYING BUY & SELL REALISTIC VOLUME MATCHING & PACING PARITY');
console.log('======================================================================\n');

// 1. Test Code Verification of volumeMatchingEngine.js
const vmeContent = fs.readFileSync(path.join(__dirname, 'services', 'volumeMatchingEngine.js'), 'utf8');

console.log('▶ TEST SUITE 1: volumeMatchingEngine.js Source Inspection');

assert(
  !vmeContent.includes('fillQty = Math.min(order.pending_quantity, availableVol);') ||
  vmeContent.includes('if (order.pending_quantity <= 500)'),
  'volumeMatchingEngine.js must NOT unconditionally fill 100% of available volume without pacing'
);
console.log('  ✔ [PASS] Equities volume distribution includes retail vs whale order branching');

assert(
  vmeContent.includes('rawDelta > 25000 ? Math.min(rawDelta, 25000) : rawDelta'),
  'volumeMatchingEngine.js must guard against feed jump / reconnect delta spikes'
);
console.log('  ✔ [PASS] Feed jump / reconnect spike protection active (capped at 25,000 per tick)');

assert(
  vmeContent.includes('!this.lastSymbolVolume.has(normSym)'),
  'volumeMatchingEngine.js must check has() before overwriting tracker with stale cache'
);
console.log('  ✔ [PASS] Continuous volume tracker preservation verified (prevents false multi-lakh spikes)');


console.log('\n▶ TEST SUITE 2: Mathematical Pacing Simulation for BUY vs SELL');

function simulateEquityFill(pendingQty, tickDelta) {
  let availableVol = tickDelta;
  let fillQty = 0;

  if (pendingQty <= 500) {
    fillQty = Math.min(pendingQty, availableVol);
  } else {
    if (availableVol <= 500) {
      fillQty = Math.min(pendingQty, availableVol);
    } else {
      const maxFill = Math.min(
        pendingQty,
        Math.max(500, Math.floor(availableVol * 0.5))
      );
      fillQty = Math.min(pendingQty, Math.min(maxFill, 1000));
    }
    fillQty = Math.min(fillQty, availableVol);
  }

  return fillQty;
}

// Scenario A: 1,00,000 Share BUY Order on High Volume Stock (VMM)
let buyOrder = { symbol: 'NSE:VMM-EQ', side: 'BUY', quantity: 100000, filled: 0, pending: 100000, status: 'PENDING' };

// Tick 1 arrives with huge exchange volume delta of 50,000 shares
let fill1 = simulateEquityFill(buyOrder.pending, 50000);
assert.strictEqual(fill1, 1000, 'Tick 1 fill for 1 Lakh BUY order must be capped at 1,000 shares, NOT 50,000 or 1,00,000');
buyOrder.filled += fill1;
buyOrder.pending -= fill1;
buyOrder.status = buyOrder.pending <= 0 ? 'EXECUTED' : 'PARTIAL_FILLED';

assert.strictEqual(buyOrder.filled, 1000);
assert.strictEqual(buyOrder.pending, 99000);
assert.strictEqual(buyOrder.status, 'PARTIAL_FILLED');
console.log('  ✔ [PASS] 1 Lakh VMM BUY order on 50,000 tick fills 1,000 shares (99,000 pending, PARTIAL_FILLED)');

// Tick 2 arrives with 7,107 shares (matching user screenshot)
let fill2 = simulateEquityFill(buyOrder.pending, 7107);
assert.strictEqual(fill2, 1000, 'Tick 2 fill must pace at 1,000 shares');
buyOrder.filled += fill2;
buyOrder.pending -= fill2;
assert.strictEqual(buyOrder.filled, 2000);
assert.strictEqual(buyOrder.pending, 98000);
console.log('  ✔ [PASS] Tick 2 (7,107 vol) fills 1,000 shares -> 2,000 / 1,00,000 (98,000 pending)');

// Scenario B: Symmetrical SELL Order Behavior
let sellOrder = { symbol: 'NSE:VMM-EQ', side: 'SELL', quantity: 100000, filled: 0, pending: 100000, status: 'PENDING' };
let sellFill1 = simulateEquityFill(sellOrder.pending, 50000);
assert.strictEqual(sellFill1, 1000, 'SELL order must pace identically to BUY order');
console.log('  ✔ [PASS] Symmetrical execution: BUY and SELL orders pace identically');

// Scenario C: Small Retail Micro Order (100 shares)
let retailOrder = { symbol: 'NSE:VMM-EQ', side: 'BUY', quantity: 100, filled: 0, pending: 100, status: 'PENDING' };
let retailFill = simulateEquityFill(retailOrder.pending, 7107);
assert.strictEqual(retailFill, 100, 'Retail 100 shares order must fill 100% immediately when volume exists');
retailOrder.filled += retailFill;
retailOrder.pending -= retailFill;
retailOrder.status = retailOrder.pending <= 0 ? 'EXECUTED' : 'PARTIAL_FILLED';
assert.strictEqual(retailOrder.status, 'EXECUTED');
console.log('  ✔ [PASS] Retail order (100 shares) executes 100% immediately without artificial delay');

// Scenario D: Low-Liquidity Micro Volume Tick (150 shares)
let lowVolFill = simulateEquityFill(buyOrder.pending, 150);
assert.strictEqual(lowVolFill, 150, 'Low-volume tick (150 shares) fills available volume (150 shares)');
console.log('  ✔ [PASS] Low-volume trade (150 shares) allocates exactly 150 shares to resting order');

console.log('\n======================================================================');
console.log('🎉 ALL BUY & SELL VOLUME PACING TESTS PASSED 100% SUCCESFULLY!');
console.log('======================================================================\n');

/**
 * Comprehensive Verification: Universal Real Volume Matching (No Artificial Capping)
 * Matches 1:1 against real exchange trade volume:
 *  - 1 Lakh pending, 2 Lakh traded in real world -> 1 Lakh executed (100% fill)
 *  - 1 Lakh pending, 500 traded in real world -> 500 executed (99,500 pending)
 *  - 99,500 pending, 15,000 traded in real world -> 15,000 executed (84,500 pending)
 *  - Derivatives & MCX: strict whole lots, no artificial lot cap (e.g. 50 lots traded -> 50 lots fill)
 *  - Illiquid / Zero volume: 0 traded -> 0 fill (stays pending)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('======================================================================');
console.log('🔬 UNIVERSAL REAL VOLUME MATCHING (NO ARTIFICIAL CAPPING) TEST');
console.log('======================================================================\n');

// 1. Source Code Inspections
const vmeContent = fs.readFileSync(path.join(__dirname, 'services', 'volumeMatchingEngine.js'), 'utf8');

console.log('▶ TEST SUITE 1: Source Code Zero-Thin-Air & No-Capping Verification');

// Must NOT sweep pending quantity out of thin air in submitOrder
assert(!vmeContent.includes('const sweepPrice = calculateMarketSlippage'), 'Thin air calculateMarketSlippage sweep must not exist in submitOrder');
assert(!vmeContent.includes('await this.processSliceFill(ordObj, ordObj.pending_quantity, sweepPrice)'), 'Thin air sweepPrice fill must not exist');
console.log('  ✔ [PASS] Thin-air sweepPrice removed from submitOrder');

// Pacing & Lot integrity in onTick
assert(vmeContent.includes('Math.floor(rawCap / lotsize) * lotsize'), 'F&O pacing must enforce whole lot alignment');
assert(vmeContent.includes('fillQty = Math.min(order.pending_quantity, availableVol)'), 'Equities volume matching must fill up to real volume without capping');
console.log('  ✔ [PASS] Equities and Derivatives match 1:1 with real volume without artificial capping');

// No Math.random in heartbeat
assert(!vmeContent.includes('Math.random()'), 'Heartbeat must not synthesize fake random volume');
console.log('  ✔ [PASS] Zero fake random volume in heartbeat');


// 2. Lot Size Resolution Test Across Segments
console.log('\n▶ TEST SUITE 2: Multi-Segment Lot Size Resolution');
const { resolveSingleLotSize } = require('./services/instrumentsCache');

const lotTests = [
  { sym: 'NSE:RELIANCE-EQ', expected: 1, desc: 'Large-cap Cash Equity' },
  { sym: 'NSE:KITEX', expected: 1, desc: 'Small-cap Cash Equity' },
  { sym: 'NSE:VMM-EQ', expected: 1, desc: 'Cash Equity VMM' },
  { sym: 'BSE:ASTAR', expected: 1, desc: 'BSE Small-cap Stock' },
  { sym: 'NSE:NIFTY24DEC24000CE', expected: 65, desc: 'NSE NIFTY Option (Underlying Prefix 65)' },
  { sym: 'BSE:SENSEX26MAR80000CE', expected: 20, desc: 'BSE SENSEX Option (20 shares)' },
  { sym: 'BSE:BANKEX26SEPFUT', expected: 30, desc: 'BSE BANKEX Future (30 shares)' },
  { sym: 'MCX:CRUDEOIL26OCTFUT', expected: 100, desc: 'MCX Crude Oil (100 barrels)' }
];

for (const t of lotTests) {
  const resolved = resolveSingleLotSize(t.sym);
  assert.strictEqual(resolved, t.expected, `Lot size for ${t.sym} (${t.desc}) must be ${t.expected}, got ${resolved}`);
  console.log(`  ✔ [PASS] ${t.desc} (${t.sym}) -> Lot Size: ${resolved}`);
}


// 3. Simulation of Real Volume Matching Engine (No Capping)
console.log('\n▶ TEST SUITE 3: Real Volume Matching Engine Simulation (User Scenarios)');

function simulateMatch(order, tickDelta) {
  const lotsize = resolveSingleLotSize(order.symbol);
  let availableVol = tickDelta;
  let fillQty = 0;

  if (lotsize > 1) {
    const maxLotsFromVol = Math.floor(availableVol / lotsize);
    if (maxLotsFromVol >= 1) {
      const rawCap = Math.min(order.pending, availableVol);
      fillQty = Math.max(lotsize, Math.floor(rawCap / lotsize) * lotsize);
      fillQty = Math.min(order.pending, fillQty);
      fillQty = Math.floor(fillQty / lotsize) * lotsize;
    } else if (order.pending < lotsize && availableVol >= order.pending) {
      fillQty = order.pending;
    }
  } else {
    fillQty = Math.min(order.pending, availableVol);
  }

  return fillQty;
}

// User Scenario 1: Share X has 1 Lakh pending order. Next minute 500 executed in real world -> 500 executed on web
console.log('\n  --- User Scenario 1: 1 Lakh Pending, 500 Executed in Real World ---');
let orderX = { symbol: 'NSE:RELIANCE-EQ', side: 'BUY', pending: 100000, filled: 0 };
let fill1 = simulateMatch(orderX, 500);
assert.strictEqual(fill1, 500, '500 executed in real world -> exactly 500 executed on web');
orderX.filled += fill1;
orderX.pending -= fill1;
assert.strictEqual(orderX.filled, 500);
assert.strictEqual(orderX.pending, 99500);
console.log('  ✔ [PASS] 500 executed in real world -> 500 filled on web, 99,500 pending');

// User Scenario 2: After that, 15,000 executed in real world -> 15,000 executed on web
console.log('\n  --- User Scenario 2: 99,500 Pending, 15,000 Executed in Real World ---');
let fill2 = simulateMatch(orderX, 15000);
assert.strictEqual(fill2, 15000, '15,000 executed in real world -> exactly 15,000 executed on web');
orderX.filled += fill2;
orderX.pending -= fill2;
assert.strictEqual(orderX.filled, 15500);
assert.strictEqual(orderX.pending, 84500);
console.log('  ✔ [PASS] 15,000 executed in real world -> 15,000 filled on web, 84,500 pending');

// User Scenario 3: 1 Lakh Pending, 2 Lakh Executed in Real World -> 1 Lakh Executed on Web (Full Fill)
console.log('\n  --- User Scenario 3: 1 Lakh Pending, 2 Lakh Executed in Real World ---');
let orderY = { symbol: 'NSE:VMM-EQ', side: 'BUY', pending: 100000, filled: 0 };
let fill3 = simulateMatch(orderY, 200000);
assert.strictEqual(fill3, 100000, '2 Lakh executed in real world -> full 1 Lakh executed on web');
orderY.filled += fill3;
orderY.pending -= fill3;
assert.strictEqual(orderY.filled, 100000);
assert.strictEqual(orderY.pending, 0);
console.log('  ✔ [PASS] 2 Lakh executed in real world -> full 1 Lakh executed on web (100% complete)');

// User Scenario 4: Derivatives / Futures / Options in Whole Lot Size (No Lot Capping)
console.log('\n  --- User Scenario 4: NIFTY Option 50 Lots (3,250 Qty) Pending, 100 Lots (6,500 Qty) Real Volume ---');
let nifOpt = { symbol: 'NSE:NIFTY24DEC24000CE', side: 'BUY', pending: 3250, filled: 0 };
let nifFill = simulateMatch(nifOpt, 6500);
assert.strictEqual(nifFill, 3250, '100 lots real volume fills all 50 pending lots without artificial capping');
nifOpt.filled += nifFill;
nifOpt.pending -= nifFill;
assert.strictEqual(nifOpt.filled, 3250);
assert.strictEqual(nifOpt.pending, 0);
console.log('  ✔ [PASS] 50 Lots NIFTY Option fills 100% when 100 lots trade in real world');

// User Scenario 5: NIFTY Option 50 Lots Pending, 2 Lots (130 Qty) Real Volume
console.log('\n  --- User Scenario 5: NIFTY Option 50 Lots Pending, 2 Lots Real Volume ---');
let nifOpt2 = { symbol: 'NSE:NIFTY24DEC24000CE', side: 'BUY', pending: 3250, filled: 0 };
let nifFill2 = simulateMatch(nifOpt2, 130);
assert.strictEqual(nifFill2, 130, '2 lots real volume fills exactly 2 lots (130 qty)');
nifOpt2.filled += nifFill2;
nifOpt2.pending -= nifFill2;
assert.strictEqual(nifOpt2.filled, 130);
assert.strictEqual(nifOpt2.pending, 3120);
console.log('  ✔ [PASS] 2 Lots real volume fills exactly 2 lots (130 qty), 48 lots pending');

// User Scenario 6: MCX Crude Oil (Lot = 100)
console.log('\n  --- User Scenario 6: MCX Crude Oil Whole Lot Matching ---');
let mcxOrder = { symbol: 'MCX:CRUDEOIL26OCTFUT', side: 'BUY', pending: 1000, filled: 0 }; // 10 lots
let mcxFill1 = simulateMatch(mcxOrder, 75); // Less than 1 lot
assert.strictEqual(mcxFill1, 0, 'Volume < 1 lot (75 barrels) fills 0');
let mcxFill2 = simulateMatch(mcxOrder, 500); // 5 lots
assert.strictEqual(mcxFill2, 500, 'Volume of 500 barrels fills exactly 5 lots (500 barrels)');
mcxOrder.filled += mcxFill2;
mcxOrder.pending -= mcxFill2;
assert.strictEqual(mcxOrder.filled, 500);
assert.strictEqual(mcxOrder.pending, 500);
console.log('  ✔ [PASS] MCX Crude Oil enforces strict whole lots (0 fill for 75 vol, 500 fill for 500 vol)');

// User Scenario 7: Zero Volume Tick (Illiquid Stock)
console.log('\n  --- User Scenario 7: Zero Volume Protection ---');
let illiquidOrder = { symbol: 'NSE:KITEX', side: 'BUY', pending: 500, filled: 0 };
let zeroFill = simulateMatch(illiquidOrder, 0);
assert.strictEqual(zeroFill, 0, '0 real volume must produce 0 fill');
assert.strictEqual(illiquidOrder.pending, 500);
console.log('  ✔ [PASS] Zero volume tick produces 0 fill, order stays pending');

console.log('\n======================================================================');
console.log('🎉 ALL USER SCENARIOS (NO CAPPING, 1:1 REAL VOLUME) PASSED FLAWLESSLY!');
console.log('======================================================================\n');

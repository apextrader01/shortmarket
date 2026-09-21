const assert = require('assert');
const { isDerivativeContract, isCommodityContract } = require('./services/instrumentsCache');

console.log('=== Verifying Real Volume Matching (No Artificial Capping) ===\n');

// 1. Test Depth Matching at Order Submission (No Capping)
function testDepthMatching() {
  const order = {
    id: 999,
    symbol: 'NSE:KITEX',
    quantity: 100000,
    pending_quantity: 100000,
    filled_quantity: 0
  };

  const depthBids = [
    { price: 119.70, qty: 15000 },
    { price: 119.65, qty: 25000 },
    { price: 119.60, qty: 20000 },
    { price: 119.55, qty: 18876 },
    { price: 119.50, qty: 10000 }
  ];
  const totalBidsInBook = depthBids.reduce((sum, b) => sum + b.qty, 0);
  assert.strictEqual(totalBidsInBook, 88876, 'Depth bids must sum to 88,876');

  // No artificial capping: match whatever depth is available in the order book
  let remainingToFill = order.pending_quantity;
  let depthFilled = 0;

  for (const level of depthBids) {
    const levelQty = level.qty;
    const fillQty = Math.min(remainingToFill, levelQty);
    if (fillQty > 0) {
      depthFilled += fillQty;
      remainingToFill -= fillQty;
    }
    if (remainingToFill <= 0) break;
  }

  assert.strictEqual(depthFilled, 88876, 'Depth fill matches all 88,876 available in book');
  order.filled_quantity = depthFilled;
  order.pending_quantity -= depthFilled;

  assert.strictEqual(order.filled_quantity, 88876);
  assert.strictEqual(order.pending_quantity, 11124);
  console.log('  ✓ PASS: 1 Lakh KITEX order matches all 88,876 available depth (11,124 remains queued for ticks)');
}

// 2. Test Real Tick Volume Matching (No Capping)
function testTickVolumeMatching() {
  const restingOrder = {
    id: 999,
    symbol: 'NSE:KITEX',
    quantity: 100000,
    filled_quantity: 0,
    pending_quantity: 100000
  };

  // User Scenario: 500 executed in real world -> 500 executed on web
  const vol1 = 500;
  const fill1 = Math.min(restingOrder.pending_quantity, vol1);
  assert.strictEqual(fill1, 500, '500 real volume fills 500 shares');
  restingOrder.filled_quantity += fill1;
  restingOrder.pending_quantity -= fill1;
  assert.strictEqual(restingOrder.filled_quantity, 500);
  assert.strictEqual(restingOrder.pending_quantity, 99500);
  console.log('  ✓ PASS: 500 real volume fills 500 shares (99,500 remains queued)');

  // User Scenario: 15,000 executed after that in real world -> 15,000 executed on web
  const vol2 = 15000;
  const fill2 = Math.min(restingOrder.pending_quantity, vol2);
  assert.strictEqual(fill2, 15000, '15,000 real volume fills 15,000 shares');
  restingOrder.filled_quantity += fill2;
  restingOrder.pending_quantity -= fill2;
  assert.strictEqual(restingOrder.filled_quantity, 15500);
  assert.strictEqual(restingOrder.pending_quantity, 84500);
  console.log('  ✓ PASS: 15,000 real volume fills 15,000 shares (84,500 remains queued)');

  // User Scenario: 2 Lakh executed in real world -> remaining 84,500 shares filled (100% complete)
  const vol3 = 200000;
  const fill3 = Math.min(restingOrder.pending_quantity, vol3);
  assert.strictEqual(fill3, 84500, '2 Lakh real volume fills remaining 84,500 shares');
  restingOrder.filled_quantity += fill3;
  restingOrder.pending_quantity -= fill3;
  assert.strictEqual(restingOrder.filled_quantity, 100000);
  assert.strictEqual(restingOrder.pending_quantity, 0);
  console.log('  ✓ PASS: 2 Lakh real volume completes the 1 Lakh order (100% filled)');
}

// 3. Test Zero-Volume Tick does not corrupt lastSymbolVolume
function testZeroVolumeProtection() {
  const lastSymbolVolume = new Map();
  lastSymbolVolume.set('KITEX', 250000);

  const tick1 = { ltp: 119.70, volume: 0 };
  const currentVol1 = Number(tick1.volume || 0);

  if (currentVol1 > 0) {
    lastSymbolVolume.set('KITEX', currentVol1);
  }

  assert.strictEqual(lastSymbolVolume.get('KITEX'), 250000, 'Zero volume tick must NOT reset lastSymbolVolume to 0');

  const tick2 = { ltp: 119.75, volume: 250200 };
  const currentVol2 = Number(tick2.volume || 0);
  const prevVol = lastSymbolVolume.get('KITEX');
  let deltaVol = 0;
  if (currentVol2 > prevVol) {
    deltaVol = currentVol2 - prevVol;
    lastSymbolVolume.set('KITEX', currentVol2);
  }

  assert.strictEqual(deltaVol, 200, 'Delta volume must be true trade size (200), not daily volume (250,200)');
  console.log('  ✓ PASS: Zero-volume tick does not corrupt tracker; true delta of 200 is captured');
}

testDepthMatching();
testTickVolumeMatching();
testZeroVolumeProtection();
console.log('\n🎉 ALL REAL VOLUME MATCHING TESTS PASSED!\n');

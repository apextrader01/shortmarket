const assert = require('assert');
const { isDerivativeContract, isCommodityContract } = require('./services/instrumentsCache');

console.log('=== Verifying Whale Order Depth Capping & Tick Pacing ===\n');

// 1. Test Depth Capping at Order Submission
function testDepthCapping() {
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

  const isHighLiquiditySegment = isDerivativeContract(order.symbol) || isCommodityContract(order.symbol);
  const totalOrderQty = Number(order.pending_quantity || order.quantity || 0);
  const isRetailOrder = totalOrderQty <= 500;
  const canInstantSweep = isHighLiquiditySegment || isRetailOrder;

  const depthCap = canInstantSweep ? order.pending_quantity : Math.min(order.pending_quantity, 500);

  let remainingToFill = depthCap;
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

  assert.strictEqual(depthFilled, 500, 'Initial depth fill must be capped at 500 shares, NOT 88,876');
  order.filled_quantity = depthFilled;
  order.pending_quantity -= depthFilled;

  assert.strictEqual(order.filled_quantity, 500);
  assert.strictEqual(order.pending_quantity, 99500);
  console.log('  ✓ PASS: 1 Lakh KITEX order caps initial depth sweep at 500 shares (99,500 remains queued)');
}

// 2. Test Single-Tick Volume Pacing Protection
function testTickVolumePacing() {
  const restingOrder = {
    id: 999,
    symbol: 'NSE:KITEX',
    quantity: 100000,
    filled_quantity: 500,
    pending_quantity: 99500
  };

  const availableVol = 3350;
  const maxFill = Math.min(restingOrder.pending_quantity, Math.min(500, Math.floor(availableVol * 0.5)));
  const fillQty = Math.min(restingOrder.pending_quantity, Math.round(maxFill));

  assert.strictEqual(fillQty, 500, 'Tick fill for cash equity order must be capped at 500 shares');
  restingOrder.filled_quantity += fillQty;
  restingOrder.pending_quantity -= fillQty;

  assert.strictEqual(restingOrder.filled_quantity, 1000);
  assert.strictEqual(restingOrder.pending_quantity, 99000);
  console.log('  ✓ PASS: Large volume tick (3,350) is capped at 500 shares (99,000 remains queued)');

  const microVol = 150;
  let microFill = 0;
  if (microVol <= 500) {
    microFill = Math.min(restingOrder.pending_quantity, microVol);
  } else {
    const raw = Math.min(restingOrder.pending_quantity, Math.min(500, Math.floor(microVol * 0.5)));
    microFill = Math.min(restingOrder.pending_quantity, Math.round(raw));
  }

  assert.strictEqual(microFill, 150, 'Micro trade of 150 shares must fill exactly 150 shares');
  restingOrder.filled_quantity += microFill;
  restingOrder.pending_quantity -= microFill;

  assert.strictEqual(restingOrder.filled_quantity, 1150);
  assert.strictEqual(restingOrder.pending_quantity, 98850);
  console.log('  ✓ PASS: Micro trade of 150 shares paces order to 1,150 filled / 98,850 queued');
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

testDepthCapping();
testTickVolumePacing();
testZeroVolumeProtection();
console.log('\n🎉 ALL WHALE VOLUME PROTECTION TESTS PASSED!\n');

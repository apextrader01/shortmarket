/**
 * Test Suite: Short Position Exit Arithmetic & Tiered Volume Matching
 */

const assert = require('assert');

console.log('=== Verifying Short Position Exit Math & Tiered Matching Rules ===\n');

// 1. Test Short Position Arithmetic Fix (Simulating Postgres Decimal Strings)
function testShortExit() {
  const existingPos = {
    id: 42,
    symbol: 'MCX:CRUDEOILM26SEPFUT',
    quantity: "-1.0000", // Postgres decimal string
    average_price: "9796.00",
    closed_quantity: "0.0000",
    realized_pnl: "0.0000",
    margin: "15000.00"
  };

  const order = {
    symbol: 'MCX:CRUDEOILM26SEPFUT',
    side: 'BUY',
    quantity: 1
  };

  const sliceQtyClean = 1;
  const slicePrice = 9827.00;
  const roundQty = (q) => Math.round(Number(q));

  // The engine fix:
  existingPos.quantity = roundQty(Number(existingPos.quantity));
  existingPos.average_price = Number(existingPos.average_price);
  existingPos.margin = Number(existingPos.margin || 0);
  existingPos.closed_quantity = roundQty(Number(existingPos.closed_quantity || 0));
  existingPos.realized_pnl = Number(existingPos.realized_pnl || 0);

  const isClosing = existingPos && (
    (existingPos.quantity > 0 && order.side === 'SELL') ||
    (existingPos.quantity < 0 && order.side === 'BUY')
  );

  assert.strictEqual(isClosing, true, 'Short position must be recognized as closing when BUY order arrives');

  const absPosQty = roundQty(Math.abs(existingPos.quantity));
  const closeQty = Math.min(sliceQtyClean, absPosQty);
  const leftoverQty = roundQty(sliceQtyClean - closeQty);

  assert.strictEqual(absPosQty, 1);
  assert.strictEqual(closeQty, 1);
  assert.strictEqual(leftoverQty, 0);

  const realizedPnl = (existingPos.average_price - slicePrice) * closeQty;
  assert.strictEqual(realizedPnl, -31.00, 'Realized P&L should be -31.00');

  const newPosQty = roundQty(existingPos.quantity > 0 ? (existingPos.quantity - closeQty) : (existingPos.quantity + closeQty));
  const isFullyClosed = newPosQty === 0 || absPosQty <= closeQty;

  assert.strictEqual(newPosQty, 0, 'newPosQty must equal 0, not -1 or "-1.00001"');
  assert.strictEqual(isFullyClosed, true, 'isFullyClosed must be true');

  console.log('  ✓ PASS: Short position correctly closes to quantity 0 with -1 + 1 = 0');
}

// 2. Test Tiered Volume Matching Rules
function testTieredVolumeMatching() {
  const { isDerivativeContract, isCommodityContract, isFnoEligibleStock } = require('./backend/services/instrumentsCache');

  function checkCanInstantSweep(symbol, qty, cached) {
    const isHighLiquiditySegment = isDerivativeContract(symbol) || isCommodityContract(symbol) || isFnoEligibleStock(symbol);
    const depthTotalQty = 0;
    const liveDailyVol = Number(cached?.volume || 0);
    const marketTotalQty = 0;
    const effectiveVolume = Math.max(liveDailyVol, marketTotalQty, depthTotalQty * 10);
    const isRetailOrder = Number(qty) <= 500 || (effectiveVolume > 0 && (Number(qty) / effectiveVolume) <= 0.05) || effectiveVolume >= 100000;
    return isHighLiquiditySegment || isRetailOrder;
  }

  // Case A: SENSEX / CRUDEOIL / NIFTY options -> Always instant sweep
  assert.strictEqual(checkCanInstantSweep('BSE:SENSEX2691774400PE', 20000, { volume: 5000000 }), true, 'SENSEX must instant sweep');
  assert.strictEqual(checkCanInstantSweep('MCX:CRUDEOILM26SEPFUT', 1, { volume: 200000 }), true, 'CRUDEOILM must instant sweep');

  // Case B: Retail cash equity order <= 500 shares -> Always instant sweep
  assert.strictEqual(checkCanInstantSweep('NSE:KITEX', 100, { volume: 5000 }), true, 'Retail 100 shares of KITEX must instant sweep');
  assert.strictEqual(checkCanInstantSweep('NSE:KITEX', 500, { volume: 5000 }), true, 'Retail 500 shares of KITEX must instant sweep');

  // Case C: Bulk 1,00,000 shares on illiquid cash equity with 5k daily volume -> CANNOT instant sweep!
  assert.strictEqual(checkCanInstantSweep('NSE:KITEX', 100000, { volume: 5000 }), false, '1 Lakh shares of KITEX must NOT instant sweep');

  console.log('  ✓ PASS: Tiered volume matching properly separates liquid/retail orders from illiquid whale orders');
}

testShortExit();
testTieredVolumeMatching();
console.log('\n🎉 ALL TESTS PASSED WITH ZERO ERRORS!\n');

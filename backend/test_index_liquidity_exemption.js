const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { isIndexContract, isDerivativeContract, isCommodityContract, isFnoEligibleStock } = require('./services/instrumentsCache');

console.log('======================================================================');
console.log('🧪 VERIFYING INDEX LIQUIDITY EXEMPTION FOR INTRADAY (MIS) ORDERS');
console.log('======================================================================\n');

// 1. Verify contract classifications
console.log('▶ TEST 1: Contract Type Identification');
assert.strictEqual(isIndexContract('NSE:NIFTYBANK-INDEX'), true, 'NSE:NIFTYBANK-INDEX is index');
assert.strictEqual(isIndexContract('NIFTYBANK-INDEX'), true, 'NIFTYBANK-INDEX is index');
assert.strictEqual(isIndexContract('NSE:NIFTY50-INDEX'), true, 'NSE:NIFTY50-INDEX is index');
assert.strictEqual(isIndexContract('BSE:SENSEX-INDEX'), true, 'BSE:SENSEX-INDEX is index');
assert.strictEqual(isIndexContract('NSE:FINNIFTY-INDEX'), true, 'NSE:FINNIFTY-INDEX is index');
assert.strictEqual(isIndexContract('NSE:RELIANCE-EQ'), false, 'RELIANCE is not index');
assert.strictEqual(isIndexContract('NIFTY24OCT25000CE'), false, 'NIFTY CE is not index');
console.log('  ✔ [PASS] isIndexContract correctly identifies benchmark indices and excludes stocks/derivatives');

// 2. Simulate server.js liquidity filter logic
console.log('\n▶ TEST 2: Intraday (MIS) Liquidity Check Simulation');

function checkIntradayLiquidity({ symbol, dayVolume, isPastOpening = true }) {
  const cleanSym = symbol.includes(':') ? symbol.split(':')[1] : symbol;
  const isDeriv = isDerivativeContract(symbol);
  const isCom = isCommodityContract(symbol);
  const isIdx = isIndexContract(symbol);
  const MIN_INTRADAY_VOLUME = 25000;

  // Enforce liquidity threshold for non-F&O cash equities after initial morning burst (past 09:30 AM IST)
  if (!isDeriv && !isCom && !isIdx) {
    const isFno = isFnoEligibleStock(symbol);
    if (!isFno && isPastOpening && dayVolume < MIN_INTRADAY_VOLUME) {
      return {
        allowed: false,
        error: `Intraday (MIS) is disabled for ${cleanSym} due to low market liquidity (${dayVolume.toLocaleString()} shares traded today). Minimum volume required is ${MIN_INTRADAY_VOLUME.toLocaleString()}. Please select Delivery (CNC).`
      };
    }
  }

  return { allowed: true };
}

// Case A: NIFTYBANK-INDEX with 0 volume (the exact user scenario)
const indexRes = checkIntradayLiquidity({ symbol: 'NSE:NIFTYBANK-INDEX', dayVolume: 0 });
assert.strictEqual(indexRes.allowed, true, 'NIFTYBANK-INDEX must be ALLOWED for Intraday (MIS) even with 0 volume');
console.log('  ✔ [PASS] NIFTYBANK-INDEX with 0 volume is exempt from cash equity liquidity check and ALLOWED for MIS');

// Case B: NIFTY50-INDEX with 0 volume
const niftyRes = checkIntradayLiquidity({ symbol: 'NSE:NIFTY50-INDEX', dayVolume: 0 });
assert.strictEqual(niftyRes.allowed, true, 'NIFTY50-INDEX must be ALLOWED for Intraday (MIS) even with 0 volume');
console.log('  ✔ [PASS] NIFTY50-INDEX with 0 volume is exempt and ALLOWED for MIS');

// Case C: SENSEX-INDEX with 0 volume
const sensexRes = checkIntradayLiquidity({ symbol: 'BSE:SENSEX-INDEX', dayVolume: 0 });
assert.strictEqual(sensexRes.allowed, true, 'SENSEX-INDEX must be ALLOWED for Intraday (MIS) even with 0 volume');
console.log('  ✔ [PASS] BSE:SENSEX-INDEX with 0 volume is exempt and ALLOWED for MIS');

// Case D: Illiquid Non-F&O penny stock with 500 volume past 09:30 AM (must still be blocked)
const illiquidStockRes = checkIntradayLiquidity({ symbol: 'NSE:PENNYSTOCK-EQ', dayVolume: 500 });
assert.strictEqual(illiquidStockRes.allowed, false, 'Illiquid cash equity must still be blocked');
assert.ok(illiquidStockRes.error.includes('due to low market liquidity'), 'Error message must match');
console.log('  ✔ [PASS] Non-F&O cash equity with <25k volume is still properly protected/blocked');

// 3. Inspect server.js source code directly
console.log('\n▶ TEST 3: Static Code Inspection of server.js');
const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

assert(
  serverContent.includes('if (!isDeriv && !isCom && !isIdx)'),
  'server.js /api/orders must exempt isIdx from cash equity liquidity check'
);
assert(
  serverContent.includes('if (!isDeriv && !isCommodity && !isIdx)'),
  'server.js /api/orders/basket must exempt isIdx from basket order liquidity check'
);
console.log('  ✔ [PASS] server.js /api/orders and /api/orders/basket both exempt isIdx');

console.log('\n======================================================================');
console.log('🎉 ALL INDEX LIQUIDITY EXEMPTION TESTS PASSED 100% SUCCESFULLY!');
console.log('======================================================================\n');

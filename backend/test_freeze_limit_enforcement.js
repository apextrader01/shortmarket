// backend/test_freeze_limit_enforcement.js
// Verification suite for Exchange Freeze Limit Enforcement across Segments & UI Disabled States

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getFreezeLimit } = require('./services/taxCalculator');

console.log('\n======================================================================');
console.log('🔬 TEST SUITE: EXCHANGE FREEZE LIMIT ENFORCEMENT & BUTTON DISABLE');
console.log('======================================================================\n');

let passedChecks = 0;
let totalChecks = 0;

function runCheck(desc, fn) {
  totalChecks++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${desc}`);
    passedChecks++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1: CASH EQUITIES (SHARES) - 1 LAKH (1,00,000) LIMIT
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ MODULE 1: Cash Equities (Shares) - 1 Lakh Freeze Limit');

runCheck('KITEX cash equity has exactly 1,00,000 shares freeze limit', () => {
  const limit = getFreezeLimit('NSE:KITEX-EQ', 1);
  assert.strictEqual(limit, 100000, `Expected 100000, got ${limit}`);
});

runCheck('RELIANCE and TCS cash equity have 1,00,000 shares freeze limit', () => {
  assert.strictEqual(getFreezeLimit('NSE:RELIANCE', 1), 100000);
  assert.strictEqual(getFreezeLimit('BSE:TCS', 1), 100000);
  assert.strictEqual(getFreezeLimit('TATAMOTORS', 1), 100000);
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: INDEX DERIVATIVES (NIFTY 1755, BANKNIFTY 600, FINNIFTY 1800, ETC.)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 2: Index Derivatives (NIFTY 1755, BANKNIFTY 600, etc.)');

runCheck('NIFTY Options & Futures have 1,755 qty freeze limit (27 lots * 65)', () => {
  const limitOpt = getFreezeLimit('NSE:NIFTY26SEP22600PE', 65);
  const limitFut = getFreezeLimit('NSE:NIFTY26SEPFUT', 65);
  assert.strictEqual(limitOpt, 1755, `Expected 1755 for NIFTY Put, got ${limitOpt}`);
  assert.strictEqual(limitFut, 1755, `Expected 1755 for NIFTY Fut, got ${limitFut}`);
});

runCheck('BANKNIFTY Options & Futures have 600 qty freeze limit (20 lots * 30)', () => {
  const limitOpt = getFreezeLimit('NSE:BANKNIFTY26SEP52000CE', 30);
  const limitFut = getFreezeLimit('NSE:BANKNIFTY26SEPFUT', 30);
  assert.strictEqual(limitOpt, 600, `Expected 600 for BANKNIFTY Call, got ${limitOpt}`);
  assert.strictEqual(limitFut, 600, `Expected 600 for BANKNIFTY Fut, got ${limitFut}`);
});

runCheck('FINNIFTY has 1,800 qty freeze limit (30 lots * 60)', () => {
  const limit = getFreezeLimit('NSE:FINNIFTY26SEP24000CE', 60);
  assert.strictEqual(limit, 1800, `Expected 1800, got ${limit}`);
});

runCheck('MIDCPNIFTY / MIDCAPNIFTY has 2,800 qty freeze limit', () => {
  assert.strictEqual(getFreezeLimit('NSE:MIDCPNIFTY26SEP13000CE', 50), 2800);
  assert.strictEqual(getFreezeLimit('NSE:MIDCAPNIFTY26SEPFUT', 50), 2800);
});

runCheck('BSE SENSEX & BANKEX have 1,000 qty freeze limit', () => {
  assert.strictEqual(getFreezeLimit('BSE:SENSEX26O0172600CE', 20), 1000);
  assert.strictEqual(getFreezeLimit('BSE:BANKEX26SEPFUT', 15), 1000);
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3: MCX COMMODITIES (SYMBOL-SPECIFIC LIMITS)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 3: MCX Commodities Specific Freeze Limits');

runCheck('MCX CRUDEOIL (10,000) and CRUDEOILM (1,000) freeze limits', () => {
  assert.strictEqual(getFreezeLimit('MCX:CRUDEOIL26OCTFUT', 100), 10000);
  assert.strictEqual(getFreezeLimit('MCX:CRUDEOILM26OCTFUT', 10), 1000);
});

runCheck('MCX NATURALGAS (50,000) and NATURALGASM (10,000) freeze limits', () => {
  assert.strictEqual(getFreezeLimit('MCX:NATURALGAS26OCTFUT', 1250), 50000);
  assert.strictEqual(getFreezeLimit('MCX:NATURALGASM26OCTFUT', 250), 10000);
});

runCheck('MCX GOLD (100) and GOLDM (1,000) freeze limits', () => {
  assert.strictEqual(getFreezeLimit('MCX:GOLD26OCTFUT', 1), 100);
  assert.strictEqual(getFreezeLimit('MCX:GOLDM26OCTFUT', 1), 1000);
});

runCheck('MCX SILVER (300) and SILVERM (1,000) freeze limits', () => {
  assert.strictEqual(getFreezeLimit('MCX:SILVER26NOVFUT', 30), 300);
  assert.strictEqual(getFreezeLimit('MCX:SILVERM26NOVFUT', 5), 1000);
});

runCheck('MCX COPPER (25,000) and ZINC (50,000) freeze limits', () => {
  assert.strictEqual(getFreezeLimit('MCX:COPPER26OCTFUT', 2500), 25000);
  assert.strictEqual(getFreezeLimit('MCX:ZINC26OCTFUT', 5000), 50000);
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: STOCK F&O (40 MARKET LOTS)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 4: Stock Derivatives (40 Lots Freeze Limit)');

runCheck('Stock F&O respects 40 market lots limit', () => {
  // TCS lot size 225 -> 40 lots = 9000
  const tcsLimit = getFreezeLimit('NSE:TCS26SEPFUT', 225);
  assert.strictEqual(tcsLimit, 9000, `Expected 9000 for TCS (225 * 40), got ${tcsLimit}`);

  // TATAPOWER lot size 1450 -> 40 lots = 58000
  const tataLimit = getFreezeLimit('NSE:TATAPOWER26SEPFUT', 1450);
  assert.strictEqual(tataLimit, 58000, `Expected 58000 for TATAPOWER (1450 * 40), got ${tataLimit}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5: FRONTEND UI & CODE INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 5: Frontend UI Disabled States & Red Banner Alerts');

runCheck('OrderModal.jsx disables buy/sell button when isExceedingFreezeLimit is true', () => {
  const modalCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'OrderModal.jsx'), 'utf8');
  assert.ok(modalCode.includes('disabled={isInsufficient || isPlacing || isExceedingFreezeLimit}'), 'Button must be disabled when isExceedingFreezeLimit is true');
  assert.ok(modalCode.includes('cursor: (isInsufficient || isPlacing || isExceedingFreezeLimit) ? \'not-allowed\' : \'pointer\''), 'Cursor must be not-allowed');
});

runCheck('OrderModal.jsx renders red exchange freeze warning banner matching reference screenshot', () => {
  const modalCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'OrderModal.jsx'), 'utf8');
  assert.ok(modalCode.includes('Max allowed lots per order as per exchange is'), 'Must display max allowed lots warning');
  assert.ok(modalCode.includes('Max allowed quantity per order as per exchange is'), 'Must display max allowed quantity warning');
  assert.ok(modalCode.includes('Please place multiple orders.'), 'Must match reference screenshot text');
});

runCheck('OrderModal.jsx provides Set Max clamp button in quantity field', () => {
  const modalCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'OrderModal.jsx'), 'utf8');
  assert.ok(modalCode.includes('Set Max: {maxAllowedLots.toLocaleString(\'en-IN\')} Lots'), 'Must provide 1-click lots clamp');
  assert.ok(modalCode.includes('Set Max: {maxAllowedQty.toLocaleString(\'en-IN\')} Shares'), 'Must provide 1-click shares clamp');
});

runCheck('store.js placeOrder enforces client-side freeze limit validation', () => {
  const storeCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'store.js'), 'utf8');
  assert.ok(storeCode.includes('exceeds exchange freeze limit'), 'store.js placeOrder must validate freeze limit');
});

runCheck('server.js POST /api/order enforces freeze limit validation', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert.ok(serverCode.includes('Validate Exchange Freeze Limit (Hard Limit per Single Order)'), 'server.js must validate freeze limit');
  assert.ok(serverCode.includes('exceeds exchange freeze limit of'), 'server.js must return freeze limit error message');
});

runCheck('server.js POST /api/basket-order enforces freeze limit for all basket legs', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert.ok(serverCode.includes('Validate Freeze Limit for each basket item'), 'Basket orders must validate freeze limit on every leg');
});

runCheck('BasketModal.jsx disables Execute Basket button if any leg exceeds freeze limit', () => {
  const basketCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'BasketModal.jsx'), 'utf8');
  assert.ok(basketCode.includes('hasFreezeExceededItem'), 'BasketModal must track hasFreezeExceededItem');
  assert.ok(basketCode.includes('disabled={isInsufficient || isSubmitting || basketItems.length === 0 || hasFreezeExceededItem}'), 'Execute button must be disabled');
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
console.log('======================================================================');

if (passedChecks === totalChecks) {
  console.log('🎉 ALL FREEZE LIMIT & BUTTON DISABLE CHECKS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('❌ SOME CHECKS FAILED!\n');
  process.exit(1);
}

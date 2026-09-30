// backend/test_order_edit_and_exit_freeze_slicing.js
// Verification suite for Order Modification Freeze Limit & Position Exit Auto-Slicing

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getFreezeLimit, calculateOrderSlices, getInstantLotsize } = require('./services/taxCalculator');

console.log('\n======================================================================');
console.log('🔬 TEST SUITE: ORDER EDIT FREEZE LIMITS & POSITION EXIT AUTO-SLICING');
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
// MODULE 1: BACKEND PUT /api/order/:id FREEZE LIMIT ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ MODULE 1: PUT /api/order/:id Freeze Limit Enforcement in server.js');

runCheck('server.js contains freeze limit validation in PUT /api/order/:id', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert.ok(serverCode.includes("app.put('/api/order/:id'"), 'PUT /api/order/:id endpoint exists');
  assert.ok(serverCode.includes('Validate Exchange Freeze Limit on order modification'), 'Freeze limit comment found');
  assert.ok(serverCode.includes('exceeds exchange freeze limit'), 'Freeze limit error message found in PUT /api/order/:id');
});

runCheck('Attempting to modify NIFTY order to 3,510 qty throws freeze limit error', () => {
  const symbol = 'NSE:NIFTY26SEP22600PE';
  const newQty = 3510;
  const freezeLimit = getFreezeLimit(symbol);
  assert.strictEqual(freezeLimit, 1755, 'NIFTY freeze limit is 1755');
  assert.ok(newQty > freezeLimit, '3510 exceeds 1755 freeze limit');
  const lotSize = getInstantLotsize(symbol);
  const maxLots = (lotSize && lotSize > 1) ? Math.floor(freezeLimit / lotSize) : freezeLimit;
  assert.strictEqual(maxLots, 27, 'NIFTY max lots is 27');
});

runCheck('Attempting to modify Cash Equity order to 1,50,000 shares throws freeze limit error', () => {
  const symbol = 'NSE:RELIANCE';
  const newQty = 150000;
  const freezeLimit = getFreezeLimit(symbol);
  assert.strictEqual(freezeLimit, 100000, 'Equity freeze limit is 100,000');
  assert.ok(newQty > freezeLimit, '150,000 exceeds 100,000 freeze limit');
});

runCheck('Modifying within freeze limit is permitted (e.g. 1,755 NIFTY or 50,000 RELIANCE)', () => {
  assert.ok(1755 <= getFreezeLimit('NSE:NIFTY26SEP22600PE'), '1755 is within NIFTY freeze limit');
  assert.ok(50000 <= getFreezeLimit('NSE:RELIANCE'), '50000 is within RELIANCE freeze limit');
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: FRONTEND EditOrderModal.jsx FREEZE LIMIT INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 2: Frontend EditOrderModal.jsx Integration & UI Disable');

runCheck('EditOrderModal imports freezeLimits and lotsizeHelper', () => {
  const modalCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'EditOrderModal.jsx'), 'utf8');
  assert.ok(modalCode.includes("import { getFreezeLimit } from '../utils/freezeLimits'"), 'getFreezeLimit imported');
  assert.ok(modalCode.includes("import { getInstantLotsize } from '../utils/lotsizeHelper'"), 'getInstantLotsize imported');
  assert.ok(modalCode.includes('AlertTriangle'), 'AlertTriangle icon imported');
});

runCheck('EditOrderModal computes freezeLimit and isExceedingFreezeLimit', () => {
  const modalCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'EditOrderModal.jsx'), 'utf8');
  assert.ok(modalCode.includes('const freezeLimit = symbol ? getFreezeLimit(symbol, orderLotSize) : 100000;'), 'freezeLimit calculation found');
  assert.ok(modalCode.includes('const isExceedingFreezeLimit = freezeLimit > 0 && numQty > freezeLimit;'), 'isExceedingFreezeLimit check found');
});

runCheck('EditOrderModal renders AlertTriangle banner and disables UPDATE ORDER button', () => {
  const modalCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'EditOrderModal.jsx'), 'utf8');
  assert.ok(modalCode.includes('{isExceedingFreezeLimit && ('), 'Conditional alert banner rendered');
  assert.ok(modalCode.includes('SET MAX'), 'SET MAX helper button present');
  assert.ok(modalCode.includes('disabled={isInsufficient || isExceedingFreezeLimit}'), 'UPDATE ORDER button disabled when freeze limit exceeded');
  assert.ok(modalCode.includes("EXCEEDS FREEZE LIMIT"), 'Button label changes to EXCEEDS FREEZE LIMIT');
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3: AUTO-SLICING POSITION EXITS IN PositionsView.jsx
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 3: Position Exit Auto-Slicing in PositionsView.jsx');

runCheck('PositionsView imports calculateOrderSlices', () => {
  const posCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'PositionsView.jsx'), 'utf8');
  assert.ok(posCode.includes("import { calculateOrderSlices } from '../utils/freezeLimits'"), 'calculateOrderSlices imported');
});

runCheck('exitAllPositions auto-slices large positions using calculateOrderSlices', () => {
  const posCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'PositionsView.jsx'), 'utf8');
  assert.ok(posCode.includes('const slices = calculateOrderSlices(pos.symbol, totalExitQty, pos.lotSize || pos.lotsize || 1);'), 'calculateOrderSlices called in exitAllPositions');
  assert.ok(posCode.includes('for (const sliceQty of slices) {'), 'Iterates over each slice');
  assert.ok(posCode.includes('quantity: sliceQty'), 'Places order slice with sliceQty');
});

runCheck('partialExit modal auto-slices exits exceeding freeze limit', () => {
  const posCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'PositionsView.jsx'), 'utf8');
  assert.ok(posCode.includes('const slices = calculateOrderSlices(partialExitPos.symbol, qtyToExit, ls);'), 'calculateOrderSlices called in partial exit');
  assert.ok(posCode.includes('for (const sliceQty of slices) {'), 'Iterates over each slice in partial exit');
  assert.ok(posCode.includes('quantity: sliceQty'), 'Places order slice with sliceQty in partial exit');
});

runCheck('calculateOrderSlices correctly partitions large positions into valid freeze slices', () => {
  // 54 lots of NIFTY (3510 qty) -> 2 slices of 1755 (27 lots each)
  const niftySlices = calculateOrderSlices('NSE:NIFTY26SEP22600PE', 3510, 65);
  assert.deepStrictEqual(niftySlices, [1755, 1755], 'NIFTY 3510 sliced into [1755, 1755]');

  // 60 lots of BANKNIFTY (1800 qty) -> 3 slices of 600 (20 lots each)
  const bnfSlices = calculateOrderSlices('NSE:BANKNIFTY26SEP52000CE', 1800, 30);
  assert.deepStrictEqual(bnfSlices, [600, 600, 600], 'BANKNIFTY 1800 sliced into [600, 600, 600]');

  // 2,50,000 shares of Reliance -> [100000, 100000, 50000]
  const relSlices = calculateOrderSlices('NSE:RELIANCE', 250000, 1);
  assert.deepStrictEqual(relSlices, [100000, 100000, 50000], 'RELIANCE 2.5L sliced into [100000, 100000, 50000]');
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: OrderModal.jsx CLAMPING & SET MAX
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 4: OrderModal.jsx Quantity Clamping & SET MAX Button');

runCheck('OrderModal clamps totalExitQty to maxAllowedLots on open', () => {
  const modalCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'OrderModal.jsx'), 'utf8');
  assert.ok(modalCode.includes('const maxAllowed = (effectiveLotsize && effectiveLotsize > 1) ? Math.floor(freezeLim / effectiveLotsize) : freezeLim;'), 'Clamping logic found in OrderModal');
  assert.ok(modalCode.includes('setQuantity(maxAllowed > 0 ? Math.min(rawLots, maxAllowed) : rawLots);'), 'Quantity set to clamped lots');
});

runCheck('OrderModal has SET MAX button inside exchange freeze limit alert banner', () => {
  const modalCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'OrderModal.jsx'), 'utf8');
  assert.ok(modalCode.includes('SET MAX'), 'SET MAX button found in OrderModal banner');
  assert.ok(modalCode.includes('setQuantity(orderModal.lotsize > 1 ? maxAllowedLots : freezeLimit)'), 'SET MAX click handler sets maxAllowedLots or freezeLimit');
});

console.log('\n======================================================================');
console.log(`🏁 TEST COMPLETE: ${passedChecks}/${totalChecks} CHECKS PASSED`);
console.log('======================================================================\n');

if (passedChecks === totalChecks) {
  process.exit(0);
} else {
  process.exit(1);
}

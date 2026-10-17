const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== Starting Test Suite: Paper Trade New Features ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// 1. Store check
test('store.js: openOrderModal accepts initialQty, initialAmo, initialOrderType', () => {
  const storeCode = fs.readFileSync(path.join(__dirname, 'frontend/src/store.js'), 'utf8');
  assert(storeCode.includes('initialQty = 1, initialAmo = false, initialOrderType = null'), 'Missing default parameters in openOrderModal');
  assert(storeCode.includes('initialQty, initialAmo, initialOrderType'), 'Missing props in orderModal store object');
});

// 2. OrderModal check
test('OrderModal.jsx: initializes initialAmo, initialQty, and initialOrderType', () => {
  const modalCode = fs.readFileSync(path.join(__dirname, 'frontend/src/components/OrderModal.jsx'), 'utf8');
  assert(modalCode.includes('orderModal.initialAmo !== undefined'), 'Missing initialAmo initialization');
  assert(modalCode.includes('orderModal.initialQty && Number(orderModal.initialQty) > 0'), 'Missing initialQty initialization');
  assert(modalCode.includes('orderModal.initialOrderType'), 'Missing initialOrderType initialization');
});

// 3. OrdersView Contract Expiry & Repeat Trade
test('OrdersView.jsx: imports RotateCcw and implements contract expiry parsing', () => {
  const ordersCode = fs.readFileSync(path.join(__dirname, 'frontend/src/components/OrdersView.jsx'), 'utf8');
  assert(ordersCode.includes('RotateCcw'), 'Missing RotateCcw icon import');
  assert(ordersCode.includes('getContractExpiryInfo'), 'Missing getContractExpiryInfo helper');
  assert(ordersCode.includes('handleRepeatOrder'), 'Missing handleRepeatOrder function');
});

test('OrdersView.jsx: handles AMO, Intraday Cutoff (15:15), and Expired Contracts', () => {
  const ordersCode = fs.readFileSync(path.join(__dirname, 'frontend/src/components/OrdersView.jsx'), 'utf8');
  assert(ordersCode.includes('Intraday MIS is closed for today (15:15 cutoff)'), 'Missing 15:15 intraday cutoff alert');
  assert(ordersCode.includes('Re-order configured as After Market Order (AMO)'), 'Missing AMO mode auto-config alert');
  assert(ordersCode.includes('Original contract expired. Auto-rolled to active'), 'Missing expired contract auto-roll logic');
});

test('OrdersView.jsx: renders REPEAT button on Desktop, Mobile Cards, and Order Details Modal', () => {
  const ordersCode = fs.readFileSync(path.join(__dirname, 'frontend/src/components/OrdersView.jsx'), 'utf8');
  assert(ordersCode.includes('title="Repeat Trade (1-Click Re-Order)"'), 'Missing mobile Repeat button');
  assert(ordersCode.includes('title="1-Click Re-Order: Pre-fills and repeats this exact trade with live checks"'), 'Missing desktop table Repeat button');
  assert(ordersCode.includes('REPEAT ORDER'), 'Missing modal Repeat Order button');
});

// 4. PositionsView Daily Discipline Guard
test('PositionsView.jsx: imports Shield, ShieldAlert, Target, PartyPopper and includes ConfettiCanvas', () => {
  const posCode = fs.readFileSync(path.join(__dirname, 'frontend/src/components/PositionsView.jsx'), 'utf8');
  assert(posCode.includes('PartyPopper'), 'Missing PartyPopper icon import');
  assert(posCode.includes('ConfettiCanvas'), 'Missing ConfettiCanvas component');
  assert(posCode.includes('skandx_daily_discipline'), 'Missing skandx_daily_discipline localStorage handling');
});

test('PositionsView.jsx: evaluates Target Hit celebration and Max Loss Capital Protection Alert', () => {
  const posCode = fs.readFileSync(path.join(__dirname, 'frontend/src/components/PositionsView.jsx'), 'utf8');
  assert(posCode.includes('isTargetAchieved'), 'Missing isTargetAchieved evaluation');
  assert(posCode.includes('isMaxLossHit'), 'Missing isMaxLossHit evaluation');
  assert(posCode.includes('DAILY PROFIT TARGET HIT'), 'Missing Target Hit banner');
  assert(posCode.includes('CAPITAL PROTECTION TRIGGERED'), 'Missing Max Loss Capital Defense banner');
  assert(posCode.includes('Daily Discipline & Risk Guard'), 'Missing Discipline modal title');
});

console.log(`\n=== Verification Results: ${passed}/${passed + failed} Tests Passed ===\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

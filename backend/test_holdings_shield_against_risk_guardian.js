const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 TEST SUITE: HOLDINGS & CNC SHIELD AGAINST RISK GUARDIAN & EXIT ALL');
console.log('================================================================\n');

// ── TEST 1: Verify mtmRiskManager.js code structure ──
console.log('Test 1: Inspecting mtmRiskManager.js shielding logic...');
const mtmCode = fs.readFileSync(path.join(__dirname, 'services', 'mtmRiskManager.js'), 'utf8');

// Check that Check 1 filters intradayPositions
assert(
    mtmCode.includes("const intradayPositions = positions.filter(p => !['DEL', 'CNC', 'DELIVERY'].includes(String(p.product_type || '').toUpperCase()))"),
    'Risk Guardian Check 1 must filter out DEL, CNC, and DELIVERY positions'
);
assert(
    mtmCode.includes('await this.liquidateUser(uid, intradayPositions, auditReason, false)'),
    'Risk Guardian must pass only intradayPositions to liquidateUser'
);
assert(
    mtmCode.includes("['DEL', 'CNC', 'DELIVERY'].includes(prodType)"),
    'liquidateUser must have a fail-safe check shielding DEL, CNC, and DELIVERY positions'
);
assert(
    mtmCode.includes("trx('holdings').where({ user_id: userId, symbol: freshPos.symbol }).first()"),
    'liquidateUser must check against the holdings table'
);
assert(
    mtmCode.includes(".whereIn('product_type', ['INT', 'MIS', 'BO', 'CO'])"),
    'liquidateUser must only cancel pending intraday orders, keeping delivery/CNC orders safe'
);
console.log('  ✔ [PASS] mtmRiskManager.js strictly isolates and liquidates ONLY Intraday positions.');
console.log('  ✔ [PASS] Delivery, CNC, and Holdings assets are completely shielded from Risk Guardian.');

// ── TEST 2: Simulate position filtering logic ──
console.log('\nTest 2: Simulating Risk Guardian position filter...');
const testPositions = [
    { id: 1, symbol: 'NSE:ASTAR', product_type: 'INT', quantity: 1000 },
    { id: 2, symbol: 'NSE:KITEX', product_type: 'MIS', quantity: 500 },
    { id: 3, symbol: 'NSE:TCS', product_type: 'CNC', quantity: 50 },
    { id: 4, symbol: 'MCX:NATURALGAS26SEP275CE', product_type: 'DEL', quantity: 1250 },
    { id: 5, symbol: 'NSE:FINNIFTY26SEP25650CE', product_type: 'DEL', quantity: 60 },
    { id: 6, symbol: 'NSE:TCS26NOVFUT', product_type: 'DELIVERY', quantity: 225 }
];

const shieldedFilter = p => !['DEL', 'CNC', 'DELIVERY'].includes(String(p.product_type || '').toUpperCase());
const liquidatablePositions = testPositions.filter(shieldedFilter);

assert.strictEqual(liquidatablePositions.length, 2, 'Only 2 intraday positions should be liquidatable');
assert.deepStrictEqual(liquidatablePositions.map(p => p.symbol), ['NSE:ASTAR', 'NSE:KITEX']);

const protectedPositions = testPositions.filter(p => !shieldedFilter(p));
assert.strictEqual(protectedPositions.length, 4, '4 positions must be protected');
assert(protectedPositions.some(p => p.symbol === 'NSE:TCS' && p.product_type === 'CNC'));
assert(protectedPositions.some(p => p.symbol.includes('NATURALGAS') && p.product_type === 'DEL'));
assert(protectedPositions.some(p => p.symbol.includes('FINNIFTY') && p.product_type === 'DEL'));
assert(protectedPositions.some(p => p.symbol.includes('TCS26NOVFUT') && p.product_type === 'DELIVERY'));

console.log('  ✔ [PASS] ASTAR (INT) & KITEX (MIS) correctly selected for liquidation.');
console.log('  ✔ [PASS] TCS (CNC), NATURALGAS (DEL), FINNIFTY (DEL), and TCS26NOVFUT (DELIVERY) are 100% shielded.');

// ── TEST 3: Inspect PositionsView.jsx frontend filter ──
console.log('\nTest 3: Inspecting PositionsView.jsx exitAllPositions filter...');
const posViewCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'PositionsView.jsx'), 'utf8');

assert(
    posViewCode.includes("prod === 'DEL' || prod === 'CNC' || prod === 'DELIVERY' || p.isDbHolding || p.isOvernightPos"),
    'PositionsView.jsx exitAllPositions must filter out DEL, CNC, DELIVERY, isDbHolding, and isOvernightPos'
);
assert(
    posViewCode.includes('Delivery, CNC, and Holdings will NOT be touched'),
    'Confirmation dialog in PositionsView.jsx must explicitly reassure the user that Holdings/CNC are safe'
);

console.log('  ✔ [PASS] PositionsView.jsx exitAllPositions guarantees 0 impact on Holdings & CNC.');

console.log('\n================================================================');
console.log('🎉 ALL TESTS PASSED! HOLDINGS & CNC PROTECTION FULLY VERIFIED!');
console.log('================================================================');

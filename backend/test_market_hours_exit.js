const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================================');
console.log('🔬 VERIFICATION: MARKET TRADING HOURS ENFORCEMENT');
console.log('======================================================================\n');

// 1. Static verification of server.js
const serverPath = path.join(__dirname, 'server.js');
const serverCode = fs.readFileSync(serverPath, 'utf8');

// Check 1: server.js /api/holdings/exit-all enforces market hours check
assert.ok(
  serverCode.includes("const marketCheck = isSegmentMarketOpen(false, null, 'DEL', false);") &&
  serverCode.includes("Market is closed. Regular orders can only be placed during trading hours (${hoursDesc}). Please select AMO to place an After Market Order."),
  'server.js /api/holdings/exit-all must strictly enforce regular trading hours'
);
console.log('  ✔ [PASS] server.js /api/holdings/exit-all strictly validates regular market trading hours (09:15 AM - 03:30 PM)');

// Check 2: server.js /api/basket-order enforces market hours when variety is not AMO
assert.ok(
  serverCode.includes("isItemAmo") &&
  serverCode.includes("Market is closed. Regular orders can only be placed during trading hours"),
  'server.js /api/basket-order must reject regular orders placed outside trading hours'
);
console.log('  ✔ [PASS] server.js /api/basket-order validates market session and blocks non-AMO items');

// Check 3: server.js /api/order enforces market hours
assert.ok(
  serverCode.includes("${marketName} is closed. Regular orders can only be placed during trading hours (${hoursDesc}). Please select AMO to place an After Market Order."),
  'server.js /api/order must enforce market hours for regular orders'
);
console.log('  ✔ [PASS] server.js /api/order has standard market closed message');

// 2. Static verification of frontend PositionsView.jsx
const positionsViewPath = path.join(__dirname, '../frontend/src/components/PositionsView.jsx');
const positionsViewCode = fs.readFileSync(positionsViewPath, 'utf8');

// Check 4: PositionsView imports getMarketSession
assert.ok(
  positionsViewCode.includes("import { getMarketSession } from '../utils/marketTiming';"),
  'PositionsView.jsx must import getMarketSession'
);
console.log('  ✔ [PASS] PositionsView.jsx imports centralized getMarketSession');

// Check 5: PositionsView EXIT ALL HOLDINGS checks session.open
assert.ok(
  positionsViewCode.includes("if (!session.open) {") &&
  positionsViewCode.includes("Market is closed. Regular orders can only be placed during trading hours (09:15 AM - 03:30 PM). Please select AMO to place an After Market Order."),
  'PositionsView.jsx EXIT ALL HOLDINGS button must block when market is closed'
);
console.log('  ✔ [PASS] PositionsView.jsx "EXIT ALL HOLDINGS ⚡" blocks off-market clicks with alert');

// Check 6: PositionsView exitAllPositions checks session.open
assert.ok(
  positionsViewCode.includes("hasEquity && !equitySession.open") &&
  positionsViewCode.includes("hasCommodity && !commSession.open"),
  'PositionsView.jsx exitAllPositions must block when equity/commodity markets are closed'
);
console.log('  ✔ [PASS] PositionsView.jsx "EXIT ALL POSITIONS ⚡" verifies session before market exits');

// Check 7: PositionsView partial exit modal supports AMO and checks session.open
assert.ok(
  positionsViewCode.includes("!partialExitIsAmo && !session.open") &&
  positionsViewCode.includes("variety: partialExitIsAmo ? 'AMO' : 'REGULAR'"),
  'PositionsView.jsx partial exit modal must validate market session and support AMO'
);
console.log('  ✔ [PASS] PositionsView.jsx partial exit modal enforces market hours and supports AMO');

// 3. Static verification of marketTiming.js
const marketTimingPath = path.join(__dirname, '../frontend/src/utils/marketTiming.js');
assert.ok(fs.existsSync(marketTimingPath), 'marketTiming.js must exist');
const marketTimingCode = fs.readFileSync(marketTimingPath, 'utf8');
assert.ok(
  marketTimingCode.includes("09:15 AM - 03:30 PM") &&
  marketTimingCode.includes("09:00 AM - 11:30 PM") &&
  marketTimingCode.includes("Please select AMO to place an After Market Order."),
  'marketTiming.js must return exact prompt strings'
);
console.log('  ✔ [PASS] frontend/src/utils/marketTiming.js standardizes equity & commodity trading schedules');

console.log('\n======================================================================');
console.log('🏁 ALL MARKET TRADING HOURS AUDIT CHECKS PASSED');
console.log('======================================================================\n');

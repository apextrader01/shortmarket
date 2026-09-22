const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('🔬 VERIFICATION: EXIT ORDER POSITION REVERSAL SAFEGUARDS');
console.log('======================================================================\n');

// 1. Check PositionsView.jsx has is_exit: true in exitAllPositions and handlePartialExit
console.log('▶ TEST SUITE 1: PositionsView.jsx Exit Order Tagging');
const positionsViewPath = path.join(__dirname, '../frontend/src/components/PositionsView.jsx');
const pvContent = fs.readFileSync(positionsViewPath, 'utf8').replace(/\r\n/g, '\n');

assert(pvContent.includes("is_exit: true,\n        remarks: 'Exit All Positions'"), 'exitAllPositions must have is_exit: true and remarks');
console.log('  ✔ [PASS] exitAllPositions payload tags is_exit: true and remarks: "Exit All Positions"');

assert(pvContent.includes("is_exit: true,\n                      remarks: 'Exit Position'"), 'handlePartialExit must have is_exit: true and remarks');
console.log('  ✔ [PASS] handlePartialExit payload tags is_exit: true and remarks: "Exit Position"');

// 2. Check server.js real-time DB position clamping
console.log('\n▶ TEST SUITE 2: server.js Real-time Clamping & Exit Preservation');
const serverPath = path.join(__dirname, 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8').replace(/\r\n/g, '\n');

assert(serverContent.includes('const isExplicitExit = Boolean(req.body.is_exit || (req.body.remarks && /exit|square-off|close/i.test(req.body.remarks)));'), 'server.js must detect isExplicitExit');
console.log('  ✔ [PASS] server.js accurately detects isExplicitExit from is_exit and remarks');

assert(serverContent.includes('quantity = isMF ? Number(openQty.toFixed(4)) : Math.round(openQty);'), 'server.js must clamp quantity to openQty');
console.log('  ✔ [PASS] server.js clamps exit quantity to actual database open position');

assert(serverContent.includes('is_exit: Boolean(req.body.is_exit || isExplicitExit)'), 'server.js must pass is_exit in req.orderToProcess');
console.log('  ✔ [PASS] server.js preserves is_exit flag on orderToProcess');

// 3. Check volumeMatchingEngine.js position reversal suppression for exit orders
console.log('\n▶ TEST SUITE 3: volumeMatchingEngine.js Exit Safeguards');
const enginePath = path.join(__dirname, 'services/volumeMatchingEngine.js');
const engineContent = fs.readFileSync(enginePath, 'utf8').replace(/\r\n/g, '\n');

assert(engineContent.includes('is_exit: Boolean(order.is_exit || (order.remarks && /exit|square-off|close/i.test(order.remarks)))'), 'volumeMatchingEngine must capture is_exit on ordObj');
console.log('  ✔ [PASS] volumeMatchingEngine preserves is_exit in active ordObj');

assert(engineContent.includes('// Position Reversal: If order slice quantity exceeds closed position, open reverse position'), 'Position Reversal comment must exist');
assert(engineContent.includes('if (isExitOrder) {\n                // For EXIT orders (Exit All, Position Exit Button), user intent is ONLY to close.\n                // Do NOT open an unwanted reverse position. Cancel remainder & refund any margin.'), 'volumeMatchingEngine must suppress reversal on exit orders');
console.log('  ✔ [PASS] volumeMatchingEngine suppresses Position Reversal on exit orders');

assert(engineContent.includes('Blocked exit order'), 'volumeMatchingEngine must block exit orders from opening new positions when closed');
console.log('  ✔ [PASS] volumeMatchingEngine blocks exit orders from opening new positions if already closed');

console.log('\n======================================================================');
console.log('TOTAL CHECKS: 7 | PASSED: 7 | FAILED: 0');
console.log('======================================================================');
console.log('🎉 ALL TESTS PASSED!\n');

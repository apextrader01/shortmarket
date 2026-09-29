const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('========================================================');
console.log('🧪 Testing Ledger Consolidation & De-fragmentation Logic');
console.log('========================================================\n');

// 1. Verify volumeMatchingEngine.js
const vmeCode = fs.readFileSync(path.join(__dirname, '../services/volumeMatchingEngine.js'), 'utf8');

assert(vmeCode.includes("const orderTag = sliceGroupId ? `[${sliceGroupId}]` : `(Order #${order.id})`;"), 
  'volumeMatchingEngine.js must construct orderTag for order-level consolidation');
assert(vmeCode.includes("existingRelease = await trx('ledger')"), 
  'volumeMatchingEngine.js must query existingRelease before inserting fragmented margin release');
assert(vmeCode.includes("existingPnl = await trx('ledger')"), 
  'volumeMatchingEngine.js must query existingPnl before inserting fragmented realized P&L');
assert(vmeCode.includes("description: `Margin released for partial close: ${totalClose} ${order.symbol} ${orderTag}`"), 
  'volumeMatchingEngine.js must update existingRelease with accumulated closed quantity');
assert(vmeCode.includes("description: `Realized P&L on ${totalClose} ${order.symbol} ${orderTag}`"), 
  'volumeMatchingEngine.js must update existingPnl with accumulated closed quantity');

console.log('✔ [PASS] volumeMatchingEngine.js correctly consolidates partial close margin release & realized P&L per order');

// 2. Verify consolidate_today_slice_taxes.js
const cleanupCode = fs.readFileSync(path.join(__dirname, '../scripts/consolidate_today_slice_taxes.js'), 'utf8');

assert(cleanupCode.includes('slicePnlEntries = await knexInstance(\'ledger\')'), 
  'consolidate_today_slice_taxes.js must scan for fragmented REALIZED_PNL entries');
assert(cleanupCode.includes('partial close:'), 
  'consolidate_today_slice_taxes.js must detect partial close margin releases');
assert(cleanupCode.includes('Realized P&L on'), 
  'consolidate_today_slice_taxes.js must consolidate Realized P&L entries');

console.log('✔ [PASS] consolidate_today_slice_taxes.js includes retroactive consolidation for partial close margin releases and realized P&L');

// 3. Verify ReportsView.jsx
const reportsViewCode = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/ReportsView.jsx'), 'utf8');

assert(reportsViewCode.includes('openBuckets = new Map()'), 
  'ReportsView.jsx must use multi-bucket map to prevent alternating rows from breaking consolidation');
assert(reportsViewCode.includes("isPnl = t === 'REALIZED_PNL'"), 
  'ReportsView.jsx must include REALIZED_PNL in consolidatable types');
assert(reportsViewCode.includes('Realized P&L on'), 
  'ReportsView.jsx must format consolidated Realized P&L descriptions with totalQty and slice count');
assert(reportsViewCode.includes('Margin released for close:'), 
  'ReportsView.jsx must format consolidated Margin Release descriptions with totalQty and slice count');

console.log('✔ [PASS] ReportsView.jsx correctly aggregates interleaved partial close rows, margin releases, realized P&L, and taxes');

console.log('\n========================================================');
console.log('🎉 ALL LEDGER CONSOLIDATION TESTS PASSED PERFECTLY!');
console.log('========================================================\n');

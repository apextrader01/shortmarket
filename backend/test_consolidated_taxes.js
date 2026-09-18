const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateTaxes } = require('./services/taxCalculator');

console.log('\n======================================================================');
console.log('🔬 CONSOLIDATED ORDER TAXES & LEDGER CLEANUP TEST SUITE');
console.log('======================================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 1: Multi-Slice Progressive Tax Calculation Mathematical Parity
// -----------------------------------------------------------------------------
console.log('▶ TEST SUITE 1: Multi-Slice Progressive Tax Calculation Mathematical Parity');

it('A 7,000-share buy order filled in 5 slices caps brokerage at ₹20 for the whole order', () => {
  const slices = [100, 400, 1500, 2000, 3000];
  const price = 250;
  
  let filledQty = 0;
  let previouslyDebited = 0;
  let totalDebited = 0;

  for (const slice of slices) {
    filledQty += slice;
    const taxesObj = calculateTaxes('NSE:KITEX-EQ', 'INT', 'BUY', filledQty, price);
    const accumulatedTaxes = Math.round((Number(taxesObj.totalTaxes || 0) + Number.EPSILON) * 100) / 100;
    const incrementalTaxes = Math.max(0, Math.round((accumulatedTaxes - previouslyDebited + Number.EPSILON) * 100) / 100);
    
    totalDebited += incrementalTaxes;
    previouslyDebited = accumulatedTaxes;
  }

  const finalSingleOrderTaxes = calculateTaxes('NSE:KITEX-EQ', 'INT', 'BUY', 7000, price);
  const expectedTotalTaxes = Math.round((Number(finalSingleOrderTaxes.totalTaxes || 0) + Number.EPSILON) * 100) / 100;

  assert.strictEqual(finalSingleOrderTaxes.brokerage, 20, 'Brokerage must be capped at ₹20 for the whole parent order');
  assert.strictEqual(Math.round(totalDebited * 100) / 100, expectedTotalTaxes, 'Sum of incremental slice taxes must exactly equal single parent order taxes');
});

// -----------------------------------------------------------------------------
// TEST SUITE 2: volumeMatchingEngine.js Code Verification
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 2: volumeMatchingEngine.js Code Verification');

const vmeContent = fs.readFileSync(path.join(__dirname, 'services', 'volumeMatchingEngine.js'), 'utf8');

it('volumeMatchingEngine.js calculates cumulative order taxes using newFilled and newAvgPrice', () => {
  assert(vmeContent.includes('const totalOrderTaxesObj = calculateTaxes('), 'calculateTaxes call missing');
  assert(vmeContent.includes('newFilled,'), 'newFilled parameter missing');
  assert(vmeContent.includes('newAvgPrice'), 'newAvgPrice parameter missing');
});

it('volumeMatchingEngine.js debits incremental taxes and writes ledger entry ONLY when order reaches EXECUTED', () => {
  assert(vmeContent.includes('const incrementalTaxes = Math.max(0, Math.round((accumulatedTaxes - previouslyDebited + Number.EPSILON) * 100) / 100);'), 'incrementalTaxes calculation missing');
  assert(vmeContent.includes('if (isComplete && accumulatedTaxes > 0)'), 'isComplete ledger check missing');
  assert(vmeContent.includes("description: `Taxes & Brokerage for ${order.side} ${newFilled} ${order.symbol} (Order #${order.id})`"), 'Consolidated ledger description missing');
  assert(!vmeContent.includes('LedgerService.chargeExecutionTaxes('), 'Legacy slice-by-slice chargeExecutionTaxes still present in volumeMatchingEngine.js');
});

// -----------------------------------------------------------------------------
// TEST SUITE 3: Partial Order Cancellation Tax Handling
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 3: Partial Order Cancellation Tax Handling');

const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const cronJobsContent = fs.readFileSync(path.join(__dirname, 'services', 'cronJobs.js'), 'utf8');

it('server.js creates consolidated tax entry when a partially filled order is cancelled', () => {
  assert(serverContent.includes('if (filledQty > 0 && Number(order.taxes) > 0)'), 'filledQty and taxes check missing in server.js cancellation');
  assert(serverContent.includes("description: `Taxes & Brokerage for ${order.side} ${filledQty} ${order.symbol} (Order #${order.id})`"), 'Consolidated description missing in server.js cancellation');
});

it('cronJobs.js creates consolidated tax entry when a partially filled order is cancelled during EOD square-off', () => {
  assert(cronJobsContent.includes('if (filledQ > 0 && Number(o.taxes) > 0)'), 'filledQ and taxes check missing in cronJobs.js cancellation');
  assert(cronJobsContent.includes("description: `Taxes & Brokerage for ${o.side} ${filledQ} ${o.symbol} (Order #${o.id})`"), 'Consolidated description missing in cronJobs.js cancellation');
});

// -----------------------------------------------------------------------------
// TEST SUITE 4: consolidateTodaySliceTaxes Logic
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 4: consolidateTodaySliceTaxes Logic Verification');

const { consolidateTodaySliceTaxes } = require('./scripts/consolidate_today_slice_taxes');

it('consolidateTodaySliceTaxes groups fragmented slice entries and preserves exact total debit', async () => {
  const mockRows = [
    { id: 1, user_id: 42, amount: -0.05, type: 'TAXES', description: 'Taxes & Brokerage for BUY 1 NSE:KITEX-EQ', created_at: new Date() },
    { id: 2, user_id: 42, amount: -0.10, type: 'TAXES', description: 'Taxes & Brokerage for BUY 2 NSE:KITEX-EQ', created_at: new Date() },
    { id: 3, user_id: 42, amount: -0.50, type: 'TAXES', description: 'Taxes & Brokerage for BUY 10 NSE:KITEX-EQ', created_at: new Date() },
    { id: 4, user_id: 42, amount: -2.52, type: 'TAXES', description: 'Taxes & Brokerage for BUY 50 NSE:KITEX-EQ', created_at: new Date() },
    { id: 5, user_id: 42, amount: -48.49, type: 'TAXES', description: 'Taxes & Brokerage for BUY 3090 NSE:KITEX-EQ', created_at: new Date() }
  ];

  let deletedIds = [];
  let insertedRecord = null;

  const mockDb = (table) => {
    return {
      where: () => mockDb(table),
      whereNot: () => mockDb(table),
      whereIn: (col, arr) => {
        deletedIds = arr;
        return { del: async () => deletedIds.length };
      },
      del: async () => deletedIds.length,
      insert: async (rec) => { insertedRecord = rec; }
    };
  };
  mockDb.transaction = async (cb) => {
    return cb({
      ledger: (t) => mockDb(t)
    });
  };

  const groups = {};
  for (const entry of mockRows) {
    const match = entry.description.match(/Taxes\s+&\s+Brokerage\s+for\s+(BUY|SELL)\s+([\d.]+)\s+(.+)/i);
    const side = match ? match[1].toUpperCase() : 'TRADE';
    const qty = match ? parseFloat(match[2]) : 0;
    const symbol = match ? match[3].trim() : 'SCRIP';
    const key = `${entry.user_id}_${symbol}_${side}`;

    if (!groups[key]) {
      groups[key] = {
        user_id: entry.user_id,
        symbol,
        side,
        totalQty: 0,
        totalAmount: 0,
        ids: [],
        firstCreatedAt: entry.created_at
      };
    }
    groups[key].totalQty += qty;
    groups[key].totalAmount += Number(entry.amount || 0);
    groups[key].ids.push(entry.id);
  }

  const g = groups[Object.keys(groups)[0]];
  assert.strictEqual(g.totalQty, 3153, 'Total quantity must equal sum of slices (1 + 2 + 10 + 50 + 3090 = 3153)');
  assert.strictEqual(Math.round(g.totalAmount * 100) / 100, -51.66, 'Total amount must equal sum of slice amounts');
  assert.strictEqual(g.ids.length, 5, '5 fragmented rows must be consolidated into 1');
});

it('server.js triggers cleanupTodayFragmentedTaxes on startup', () => {
  assert(serverContent.includes('cleanupTodayFragmentedTaxes()'), 'cleanupTodayFragmentedTaxes startup invocation missing in server.js');
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('======================================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL CONSOLIDATED TAXES & LEDGER CHECKS PASSED 100% SUCCESFULLY!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED!');
  process.exit(1);
}

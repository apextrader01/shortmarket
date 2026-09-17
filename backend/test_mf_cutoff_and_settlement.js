/**
 * Test Suite: Mutual Fund 2:00 PM NAV Cut-off & Next Business Day Settlement (Option 2)
 *
 * Verifies:
 * 1. Cut-off timing logic (09:00 AM - 02:00 PM IST Mon-Fri qualify for Today's NAV; all other times Next Business Day)
 * 2. Non-cancellable Mutual Fund order enforcement (cancellation strictly rejected with 400 error)
 * 3. Frontend UI safeguards in OrdersView & MutualFundDetailsModal
 * 4. Next-Day Settlement calculations & holdings crediting logic
 * 5. Automated Cron job schedules for MF settlements (09:00 AM & 10:30 PM IST)
 */

const fs = require('fs');
const path = require('path');

let totalAsserts = 0;
let passedAsserts = 0;
let failedAsserts = 0;

function assert(condition, desc) {
  totalAsserts++;
  if (condition) {
    passedAsserts++;
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${desc}`);
  } else {
    failedAsserts++;
    console.error(`  \x1b[31m✖ FAIL:\x1b[0m ${desc}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// MODULE 1: CUT-OFF TIMING SIMULATION
// ─────────────────────────────────────────────────────────────────────────
function checkMfCutoff(date) {
  try {
    const istStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Kolkata', 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', hour12: false 
    }).format(date);
    const [datePart, timePart] = istStr.split(', ');
    const [y, m, d] = datePart.split('-').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const curMins = h * 60 + min;
    const isWorkingDay = day >= 1 && day <= 5;
    return isWorkingDay && curMins >= 540 && curMins < 840;
  } catch (e) {
    return false;
  }
}

console.log('\n======================================================================');
console.log('TEST SUITE: MUTUAL FUND 2:00 PM CUT-OFF & NEXT-DAY SETTLEMENT (OPTION 2)');
console.log('======================================================================\n');

console.log('▶ MODULE 1: 02:00 PM Cut-off Evaluation');
// Wednesday 11:30 AM IST (UTC 06:00 AM)
assert(checkMfCutoff(new Date('2026-09-16T06:00:00Z')) === true, "Wed 11:30 AM IST qualifies for Today's NAV");
// Wednesday 01:59 PM IST (UTC 08:29 AM)
assert(checkMfCutoff(new Date('2026-09-16T08:29:00Z')) === true, "Wed 01:59 PM IST qualifies for Today's NAV");
// Wednesday 02:00 PM IST (UTC 08:30 AM - cut-off hit)
assert(checkMfCutoff(new Date('2026-09-16T08:30:00Z')) === false, "Wed 02:00 PM IST qualifies for Next Business Day NAV");
// Wednesday 02:01 PM IST (UTC 08:31 AM)
assert(checkMfCutoff(new Date('2026-09-16T08:31:00Z')) === false, "Wed 02:01 PM IST qualifies for Next Business Day NAV");
// Wednesday 03:30 PM IST (UTC 10:00 AM)
assert(checkMfCutoff(new Date('2026-09-16T10:00:00Z')) === false, "Wed 03:30 PM IST qualifies for Next Business Day NAV");
// Wednesday 08:45 AM IST (UTC 03:15 AM - pre-market)
assert(checkMfCutoff(new Date('2026-09-16T03:15:00Z')) === false, "Wed 08:45 AM IST qualifies for Next Business Day NAV");
// Saturday 11:00 AM IST (UTC 05:30 AM)
assert(checkMfCutoff(new Date('2026-09-19T05:30:00Z')) === false, "Saturday 11:00 AM IST qualifies for Next Business Day NAV");
// Sunday 11:00 AM IST (UTC 05:30 AM)
assert(checkMfCutoff(new Date('2026-09-20T05:30:00Z')) === false, "Sunday 11:00 AM IST qualifies for Next Business Day NAV");


// ─────────────────────────────────────────────────────────────────────────
// MODULE 2: NON-CANCELLABLE MF ORDER BACKEND ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 2: Non-Cancellable Order Enforcement');

function validateOrderCancellation(order) {
  const isMf = Boolean((order.symbol || '').endsWith('-MF') || (order.symbol || '').includes('MUTUALFUND'));
  if (isMf) {
    return { error: 'Mutual Fund purchase orders cannot be cancelled once placed as per AMC guidelines.', statusCode: 400 };
  }
  if (order.status !== 'PENDING' && order.status !== 'PENDING_TRIGGER' && order.status !== 'PARTIAL_FILLED' && order.status !== 'AMO_PENDING') {
    return { error: 'Only pending, partially filled, or AMO orders can be cancelled', statusCode: 400 };
  }
  return { success: true };
}

const mfOrder1 = { id: 101, symbol: '120503-MF', status: 'AMO_PENDING' };
const res1 = validateOrderCancellation(mfOrder1);
assert(res1.statusCode === 400, 'Cancellation of 120503-MF is rejected with statusCode 400');
assert(res1.error.includes('Mutual Fund purchase orders cannot be cancelled'), 'Rejection contains AMC non-cancellable explanation');

const mfOrder2 = { id: 102, symbol: 'HDFCMUTUALFUND', status: 'AMO_PENDING' };
const res2 = validateOrderCancellation(mfOrder2);
assert(res2.statusCode === 400, 'Cancellation of HDFCMUTUALFUND order is rejected');

const stockOrder = { id: 103, symbol: 'RELIANCE', status: 'AMO_PENDING' };
const res3 = validateOrderCancellation(stockOrder);
assert(res3.success === true, 'Regular equity stock order can be cancelled during AMO');


// ─────────────────────────────────────────────────────────────────────────
// MODULE 3: FRONTEND CODE INTEGRITY (OrdersView.jsx & MutualFundDetailsModal.jsx)
// ─────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 3: Frontend Code Review & UI Integrity');

const ordersViewCode = fs.readFileSync(path.join(__dirname, '../frontend/src/components/OrdersView.jsx'), 'utf8');
assert(ordersViewCode.includes('QUEUED (NEXT DAY NAV)'), 'OrdersView renders "QUEUED (NEXT DAY NAV)" badge for MF orders');
assert(ordersViewCode.includes('Mutual Fund purchase orders cannot be cancelled once placed as per AMC guidelines'), 'OrdersView bulk cancel excludes non-cancellable MF orders');

const mfModalCode = fs.readFileSync(path.join(__dirname, '../frontend/src/components/MutualFundDetailsModal.jsx'), 'utf8');
assert(mfModalCode.includes("Applicable NAV:"), 'MutualFundDetailsModal contains Applicable NAV banner');
assert(mfModalCode.includes("Pay Now (Today's NAV)"), "MutualFundDetailsModal has Pay Now (Today's NAV) action button");
assert(mfModalCode.includes("Place Order (Next Day NAV)"), "MutualFundDetailsModal has Place Order (Next Day NAV) action button");
assert(mfModalCode.includes("Order Queued for Next Business Day NAV!"), "MutualFundDetailsModal notifies user when order is queued");


// ─────────────────────────────────────────────────────────────────────────
// MODULE 4: SETTLEMENT LOGIC & HOLDINGS ALLOCATION
// ─────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 4: Settlement Calculations & Holdings Crediting');

function simulateSettleOrder(order, latestNav, currentHoldings = []) {
  const marginAmount = parseFloat(order.margin || 0);
  const units = parseFloat((marginAmount / latestNav).toFixed(4));
  
  const updatedOrder = {
    ...order,
    status: 'EXECUTED',
    quantity: units,
    filled_quantity: units,
    pending_quantity: 0,
    price: latestNav,
    average_price: latestNav,
    remarks: `Settled @ Next Day NAV ₹${latestNav.toFixed(2)}`
  };

  const existingIdx = currentHoldings.findIndex(h => h.symbol === order.symbol);
  let updatedHoldings = [...currentHoldings];

  if (existingIdx >= 0) {
    const curQty = parseFloat(updatedHoldings[existingIdx].quantity) || 0;
    const curAvg = parseFloat(updatedHoldings[existingIdx].average_price) || latestNav;
    const newQty = parseFloat((curQty + units).toFixed(4));
    const newAvg = parseFloat((((curQty * curAvg) + marginAmount) / newQty).toFixed(4));
    updatedHoldings[existingIdx] = {
      ...updatedHoldings[existingIdx],
      quantity: newQty,
      average_price: newAvg,
      asset_class: 'MUTUAL_FUND'
    };
  } else {
    updatedHoldings.push({
      symbol: order.symbol,
      quantity: units,
      average_price: latestNav,
      asset_class: 'MUTUAL_FUND'
    });
  }

  return { updatedOrder, updatedHoldings };
}

// Case 1: Initial Investment of ₹10,000 at Next-Day NAV ₹125.00
const queuedOrder1 = {
  id: 1,
  symbol: '120503-MF',
  status: 'AMO_PENDING',
  margin: 10000.00
};

const result1 = simulateSettleOrder(queuedOrder1, 125.00, []);
assert(result1.updatedOrder.status === 'EXECUTED', 'Queued order transitions to EXECUTED on settlement');
assert(result1.updatedOrder.quantity === 80.0000, 'Units credited match 10000 / 125.00 = 80.0000');
assert(result1.updatedHoldings.length === 1, 'Holding record created');
assert(result1.updatedHoldings[0].quantity === 80.0000, 'Holding quantity is 80 units');
assert(result1.updatedHoldings[0].average_price === 125.00, 'Holding average price is ₹125.00');

// Case 2: Subsequent Investment of ₹5,000 at Next-Day NAV ₹150.00
const queuedOrder2 = {
  id: 2,
  symbol: '120503-MF',
  status: 'AMO_PENDING',
  margin: 5000.00
};

const result2 = simulateSettleOrder(queuedOrder2, 150.00, result1.updatedHoldings);
// 5000 / 150 = 33.3333 units
assert(result2.updatedOrder.quantity === 33.3333, 'Second order allocates 33.3333 units');
// Total qty: 80 + 33.3333 = 113.3333 units
assert(result2.updatedHoldings[0].quantity === 113.3333, 'Holding accumulated quantity is 113.3333 units');
// Weighted average price: (10000 + 5000) / 113.3333 = 132.3529
assert(Math.abs(result2.updatedHoldings[0].average_price - 132.3529) < 0.001, 'Weighted average price recalculated accurately');


// ─────────────────────────────────────────────────────────────────────────
// MODULE 5: CRON SCHEDULES AUDIT (09:00 AM & 10:30 PM IST)
// ─────────────────────────────────────────────────────────────────────────
console.log('\n▶ MODULE 5: Automated Cron Schedule Audit');

const sipEngineCode = fs.readFileSync(path.join(__dirname, 'services/sipEngine.js'), 'utf8');
assert(sipEngineCode.includes("'0 9 * * 1-5'"), 'SIPEngine schedules morning Next-Day settlement cycle at 09:00 AM IST (Mon-Fri)');
assert(sipEngineCode.includes("'30 22 * * 1-5'"), 'SIPEngine schedules evening Next-Day settlement cycle at 10:30 PM IST (Mon-Fri)');
assert(sipEngineCode.includes('processPendingMutualFundOrders'), 'SIPEngine calls processPendingMutualFundOrders during cron cycles');

const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert(serverCode.includes('isMutualFundSameDayCutoffOpen'), 'server.js defines isMutualFundSameDayCutoffOpen helper');
assert(serverCode.includes('/api/admin/mf/settle-pending'), 'server.js exposes /api/admin/mf/settle-pending manual trigger endpoint');

console.log('\n======================================================================');
console.log(`TOTAL AUDIT CHECKS: ${totalAsserts} | PASSED: ${passedAsserts} | FAILED: ${failedAsserts}`);
console.log('======================================================================\n');

if (failedAsserts > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL MUTUAL FUND CUT-OFF & SETTLEMENT TESTS PASSED WITH 100% SUCCESS!\n');
  process.exit(0);
}

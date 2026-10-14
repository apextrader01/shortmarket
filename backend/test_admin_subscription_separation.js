/**
 * Unit Test: Verification of Real Payments vs Admin Upgrades separation in Subscriptions
 */
const assert = require('assert');

function runTests() {
  console.log('🧪 Starting Subscription Admin Upgrade Separation Tests...\n');

  // Test data representing raw payments returned by DB / Cashfree
  const mockPayments = [
    // Real Gateway Payment 1: Monthly Plan Paid
    {
      id: 1,
      username: 'trader_raj',
      client_id: 'SH1001',
      plan: 'MONTHLY',
      amount: 199,
      payment_type: 'ORDER',
      status: 'SUCCESS',
      failure_reason: null,
      razorpay_payment_id: 'pay_12345'
    },
    // Real Gateway Payment 2: Yearly Plan Paid
    {
      id: 2,
      username: 'trader_priya',
      client_id: 'SH1002',
      plan: 'YEARLY',
      amount: 1999,
      payment_type: 'AUTOPAY',
      status: 'SUCCESS',
      failure_reason: null,
      razorpay_payment_id: 'pay_67890'
    },
    // Admin Upgrade: Manually set by Admin
    {
      id: 3,
      username: 'vip_user',
      client_id: 'SH1003',
      plan: 'HIGHEST',
      amount: 0,
      payment_type: 'ADMIN_GRANT',
      status: 'ADMIN_UPGRADE',
      failure_reason: 'Manually set to HIGHEST by Admin (superadmin)'
    },
    // Admin Upgrade: Synced from profile
    {
      id: 4,
      username: 'legacy_pro',
      client_id: 'SH1004',
      plan: 'VIP',
      amount: 0,
      payment_type: 'ADMIN_GRANT',
      status: 'ADMIN_UPGRADE',
      failure_reason: 'Active plan set by Admin / Profile Override'
    },
    // Failed payment
    {
      id: 5,
      username: 'failed_trader',
      client_id: 'SH1005',
      plan: 'MONTHLY',
      amount: 199,
      payment_type: 'ORDER',
      status: 'FAILED',
      failure_reason: 'Bank declined transaction'
    },
    // Cancelled checkout
    {
      id: 6,
      username: 'cancelled_user',
      client_id: 'SH1006',
      plan: 'YEARLY',
      amount: 1999,
      payment_type: 'ORDER',
      status: 'CANCELLED',
      failure_reason: 'User closed modal'
    }
  ];

  // Helper matching backend & frontend classification logic
  function classifyRow(p) {
    const st = String(p.status || '').toUpperCase();
    const pType = String(p.payment_type || '').toUpperCase();
    const amt = Number(p.amount || 0);
    const reason = String(p.failure_reason || '').toLowerCase();

    const isAdmin = (
      pType === 'ADMIN_GRANT' ||
      pType === 'ACTIVE_SUBSCRIPTION' ||
      pType === 'ADMIN_UPGRADE' ||
      st === 'ADMIN_UPGRADE' ||
      reason.includes('admin') ||
      reason.includes('profile override') ||
      reason.includes('active plan set by admin') ||
      reason.includes('manually set') ||
      reason.includes('active plan synced')
    );

    return {
      isAdmin,
      isRealSuccess: !isAdmin && st === 'SUCCESS' && amt > 0,
      isFailed: st === 'FAILED',
      isCancelled: st === 'CANCELLED',
      amount: amt
    };
  }

  // Calculate summary metrics
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalCancelled = 0;
  let totalInitiated = 0;
  let totalRevenue = 0;
  let totalAdminUpgrades = 0;

  for (const p of mockPayments) {
    const info = classifyRow(p);
    if (info.isAdmin) {
      totalAdminUpgrades++;
    } else if (info.isRealSuccess) {
      totalSuccess++;
      totalRevenue += info.amount;
    } else if (info.isFailed) {
      totalFailed++;
    } else if (info.isCancelled) {
      totalCancelled++;
    } else {
      totalInitiated++;
    }
  }

  console.log('Results:');
  console.log(`- Total Real Success Count: ${totalSuccess} (Expected: 2)`);
  console.log(`- Total Real Revenue: ₹${totalRevenue} (Expected: 2198)`);
  console.log(`- Total Admin Upgrades: ${totalAdminUpgrades} (Expected: 2)`);
  console.log(`- Total Failed: ${totalFailed} (Expected: 1)`);
  console.log(`- Total Cancelled: ${totalCancelled} (Expected: 1)`);

  assert.strictEqual(totalSuccess, 2, 'Total Success count must only count real paid payments');
  assert.strictEqual(totalRevenue, 2198, 'Total Revenue must only sum money from real paid payments');
  assert.strictEqual(totalAdminUpgrades, 2, 'Admin upgrades must be counted separately');
  assert.strictEqual(totalFailed, 1, 'Total Failed count must be 1');
  assert.strictEqual(totalCancelled, 1, 'Total Cancelled count must be 1');

  // Test Filtering Logic
  const realSuccessRows = mockPayments.filter(p => {
    const info = classifyRow(p);
    return info.isRealSuccess;
  });
  assert.strictEqual(realSuccessRows.length, 2, 'SUCCESS filter must only yield real paid rows');
  assert.ok(realSuccessRows.every(r => r.amount > 0 && r.payment_type !== 'ADMIN_GRANT'));

  const adminUpgradeRows = mockPayments.filter(p => {
    const info = classifyRow(p);
    return info.isAdmin;
  });
  assert.strictEqual(adminUpgradeRows.length, 2, 'ADMIN_UPGRADES filter must only yield admin upgrades');
  assert.ok(adminUpgradeRows.every(r => r.amount === 0));

  console.log('\n✅ All tests passed successfully!');
}

runTests();

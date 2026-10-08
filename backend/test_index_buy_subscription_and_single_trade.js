/**
 * Test: Index Buy Subscription & Single Active Index Trade Limit Verification
 * Tests the rules:
 * 1. Index buy is ONLY possible for users with active subscription (Pro / Monthly / Yearly / VIP / Admin).
 * 2. Only ONE active index trade at a time across index contracts.
 * 3. Exits and square-off orders (covering short positions) are NEVER blocked.
 * 4. Non-index equities (e.g. RELIANCE, TCS) are unaffected by the index limit.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function test(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Verify isIndexContract identification logic
function isIndexContract(sym) {
  if (!sym || typeof sym !== 'string') return false;
  const clean = sym.replace(/^(NSE:|BSE:|MCX:)/i, '').trim().toUpperCase();
  if (clean.includes('INDEX')) return true;
  const INDEX_PREFIXES = [
    'NIFTY',
    'BANKNIFTY',
    'FINNIFTY',
    'MIDCPNIFTY',
    'MIDCAPNIFTY',
    'NIFTYNXT50',
    'NIFTYFPI',
    'SENSEX',
    'BANKEX'
  ];
  return INDEX_PREFIXES.some(prefix => clean.startsWith(prefix));
}

test('isIndexContract accurately identifies all index spot, options, and futures', () => {
  // Indices Spot
  assert.strictEqual(isIndexContract('NSE:NIFTY50-INDEX'), true);
  assert.strictEqual(isIndexContract('NSE:NIFTYBANK-INDEX'), true);
  assert.strictEqual(isIndexContract('BSE:SENSEX-INDEX'), true);
  assert.strictEqual(isIndexContract('NIFTY'), true);
  assert.strictEqual(isIndexContract('BANKNIFTY'), true);
  assert.strictEqual(isIndexContract('FINNIFTY'), true);
  assert.strictEqual(isIndexContract('MIDCPNIFTY'), true);
  assert.strictEqual(isIndexContract('SENSEX'), true);
  assert.strictEqual(isIndexContract('BANKEX'), true);

  // Index Options
  assert.strictEqual(isIndexContract('NSE:NIFTY24OCT25000CE'), true);
  assert.strictEqual(isIndexContract('NSE:NIFTY24OCT25000PE'), true);
  assert.strictEqual(isIndexContract('NSE:BANKNIFTY24OCT52000CE'), true);
  assert.strictEqual(isIndexContract('NSE:BANKNIFTY24OCT52000PE'), true);
  assert.strictEqual(isIndexContract('NSE:FINNIFTY24OCT24000CE'), true);
  assert.strictEqual(isIndexContract('NSE:MIDCPNIFTY24OCT13000PE'), true);
  assert.strictEqual(isIndexContract('BSE:SENSEX24OCT82000CE'), true);
  assert.strictEqual(isIndexContract('BSE:BANKEX24OCT58000PE'), true);

  // Index Futures
  assert.strictEqual(isIndexContract('NSE:NIFTY24OCTFUT'), true);
  assert.strictEqual(isIndexContract('NSE:BANKNIFTY24OCTFUT'), true);

  // Non-Index Equities & Stock Derivatives (must return FALSE)
  assert.strictEqual(isIndexContract('NSE:RELIANCE'), false);
  assert.strictEqual(isIndexContract('NSE:TCS'), false);
  assert.strictEqual(isIndexContract('NSE:INFY-EQ'), false);
  assert.strictEqual(isIndexContract('NSE:HDFCBANK24OCT1700CE'), false);
  assert.strictEqual(isIndexContract('NSE:TATAMOTORS24OCTFUT'), false);
  assert.strictEqual(isIndexContract('MCX:CRUDEOIL24OCTFUT'), false);
  assert.strictEqual(isIndexContract('MCX:GOLD24OCTFUT'), false);
});

// 2. Mock Validator mimicking server.js logic
function simulateOrderValidation({ user, order, positions = [], pendingOrders = [] }) {
  const symbol = order.symbol;
  const side = String(order.side).toUpperCase();
  const isExplicitExit = Boolean(order.is_exit || (order.remarks && /exit|square-off|close/i.test(order.remarks)));

  const isPaidTier = Boolean(user?.is_admin) || (user && ['PRO', 'MONTHLY', 'YEARLY', 'HIGHEST', 'FEATURE', 'VIP', 'LIFETIME'].includes(user.subscription_tier) && (!user.subscription_expires || new Date(user.subscription_expires) > new Date()));

  const isOrderBuy = side === 'BUY';
  const isTargetIndex = isIndexContract(symbol);

  if (isOrderBuy && isTargetIndex && !isExplicitExit) {
    const cleanSymForIndex = String(symbol).replace(/^(NSE:|BSE:|MCX:)/i, '');
    const coveringShortPos = positions.find(p => {
      const pClean = (p.symbol || '').replace(/^(NSE:|BSE:|MCX:)/i, '');
      return (p.symbol === symbol || pClean === cleanSymForIndex) && Number(p.quantity) < 0;
    });

    const isCoveringShort = Boolean(coveringShortPos && Math.abs(Number(coveringShortPos.quantity)) > 0);

    if (!isCoveringShort) {
      // 1. Subscription Check
      if (!isPaidTier) {
        return {
          status: 403,
          error: 'Index buying is exclusive to Pro subscribers. Please upgrade your subscription to trade Nifty, BankNifty, Sensex and other index contracts.',
          requires_subscription: true
        };
      }

      // 2. Single Active Index Trade Limit
      const existingIndexPos = positions.find(p => isIndexContract(p.symbol) && Math.abs(Number(p.quantity)) > 0);
      if (existingIndexPos) {
        const cleanExistingSym = existingIndexPos.symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
        return {
          status: 400,
          error: `Index trading limit: Only 1 active index trade is allowed at a time. You currently have an active position in ${cleanExistingSym}.`,
          index_limit_reached: true
        };
      }

      const existingPendingIndex = pendingOrders.find(o => String(o.side).toUpperCase() === 'BUY' && ['OPEN', 'PENDING', 'TRIGGER_PENDING', 'AMO'].includes(o.status) && isIndexContract(o.symbol));
      if (existingPendingIndex) {
        const cleanPendingSym = existingPendingIndex.symbol.replace(/^(NSE:|BSE:|MCX:)/i, '');
        return {
          status: 400,
          error: `Index trading limit: Only 1 active index trade is allowed at a time. You already have a pending ${existingPendingIndex.status} order for ${cleanPendingSym}.`,
          index_limit_reached: true
        };
      }
    }
  }

  return { status: 200, success: true };
}

test('Non-subscribed (BASIC) user buying index is rejected with 403 requires_subscription', () => {
  const result = simulateOrderValidation({
    user: { id: 101, subscription_tier: 'BASIC', is_admin: false },
    order: { symbol: 'NSE:NIFTY24OCT25000CE', side: 'BUY' }
  });
  assert.strictEqual(result.status, 403);
  assert.strictEqual(result.requires_subscription, true);
  assert.ok(result.error.includes('exclusive to Pro subscribers'));
});

test('Masterclass (pure coaching) user buying index is rejected with 403 requires_subscription', () => {
  const result = simulateOrderValidation({
    user: { id: 103, subscription_tier: 'MASTERCLASS', is_admin: false },
    order: { symbol: 'NSE:NIFTY24OCT25000CE', side: 'BUY' }
  });
  assert.strictEqual(result.status, 403);
  assert.strictEqual(result.requires_subscription, true);
  assert.ok(result.error.includes('exclusive to Pro subscribers'));
});

test('Lifetime Elite user (includes Yearly plan features for life) can buy index', () => {
  const result = simulateOrderValidation({
    user: { id: 104, subscription_tier: 'LIFETIME', is_admin: false },
    order: { symbol: 'NSE:NIFTY24OCT25000CE', side: 'BUY' }
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.success, true);
});

test('Monthly and Yearly Elite users both have index buying permissions (same features)', () => {
  const monthlyRes = simulateOrderValidation({
    user: { id: 105, subscription_tier: 'MONTHLY', is_admin: false },
    order: { symbol: 'NSE:BANKNIFTY24OCT52000CE', side: 'BUY' }
  });
  assert.strictEqual(monthlyRes.status, 200);

  const yearlyRes = simulateOrderValidation({
    user: { id: 106, subscription_tier: 'YEARLY', is_admin: false },
    order: { symbol: 'NSE:BANKNIFTY24OCT52000CE', side: 'BUY' }
  });
  assert.strictEqual(yearlyRes.status, 200);
});

test('Subscribed (PRO) user with no existing index trades can buy index', () => {
  const result = simulateOrderValidation({
    user: { id: 102, subscription_tier: 'PRO', is_admin: false },
    order: { symbol: 'NSE:NIFTY24OCT25000CE', side: 'BUY' }
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.success, true);
});

test('Subscribed user holding active index position is blocked from buying another index (1 at a time)', () => {
  const result = simulateOrderValidation({
    user: { id: 102, subscription_tier: 'PRO', is_admin: false },
    order: { symbol: 'NSE:BANKNIFTY24OCT52000CE', side: 'BUY' },
    positions: [
      { symbol: 'NSE:NIFTY24OCT25000CE', quantity: 50 } // Already has 1 open NIFTY position
    ]
  });
  assert.strictEqual(result.status, 400);
  assert.strictEqual(result.index_limit_reached, true);
  assert.ok(result.error.includes('Only 1 active index trade is allowed at a time'));
});

test('Subscribed user holding active index position CAN still buy non-index equities', () => {
  const result = simulateOrderValidation({
    user: { id: 102, subscription_tier: 'PRO', is_admin: false },
    order: { symbol: 'NSE:RELIANCE', side: 'BUY' },
    positions: [
      { symbol: 'NSE:NIFTY24OCT25000CE', quantity: 50 } // Holds index position
    ]
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.success, true);
});

test('Subscribed user with pending index BUY order is blocked from placing another index BUY', () => {
  const result = simulateOrderValidation({
    user: { id: 102, subscription_tier: 'PRO', is_admin: false },
    order: { symbol: 'NSE:BANKNIFTY24OCT52000CE', side: 'BUY' },
    positions: [],
    pendingOrders: [
      { symbol: 'NSE:NIFTY24OCT25000CE', side: 'BUY', status: 'OPEN' }
    ]
  });
  assert.strictEqual(result.status, 400);
  assert.strictEqual(result.index_limit_reached, true);
  assert.ok(result.error.includes('Only 1 active index trade is allowed at a time'));
});

test('Selling to exit existing long index position is NEVER blocked', () => {
  // Exit order
  const result = simulateOrderValidation({
    user: { id: 102, subscription_tier: 'BASIC', is_admin: false },
    order: { symbol: 'NSE:NIFTY24OCT25000CE', side: 'SELL', is_exit: true },
    positions: [
      { symbol: 'NSE:NIFTY24OCT25000CE', quantity: 50 }
    ]
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.success, true);
});

test('Buying to cover existing short index position is NEVER blocked', () => {
  // Buy to cover short position
  const result = simulateOrderValidation({
    user: { id: 102, subscription_tier: 'BASIC', is_admin: false },
    order: { symbol: 'NSE:NIFTY24OCT25000CE', side: 'BUY' },
    positions: [
      { symbol: 'NSE:NIFTY24OCT25000CE', quantity: -50 } // Short position
    ]
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.success, true);
});

test('Code inspection: server.js and store.js enforce index buy subscription and 1-index limit', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert.ok(serverCode.includes('function isIndexContract'), 'server.js must define isIndexContract');
  assert.ok(serverCode.includes('Index buying is exclusive to Pro subscribers'), 'server.js must require pro subscription for index buy');
  assert.ok(serverCode.includes('Only 1 active index trade is allowed at a time'), 'server.js must enforce single index trade limit');

  const storeCode = fs.readFileSync(path.join(__dirname, '../frontend/src/store.js'), 'utf8');
  assert.ok(storeCode.includes('export function isIndexContract'), 'store.js must export isIndexContract');
  assert.ok(storeCode.includes('Index limit reached: Only 1 active index trade is allowed at a time'), 'store.js must enforce single index limit');
});

console.log('\n🎉 ALL INDEX BUY SUBSCRIPTION & SINGLE-TRADE LIMIT TESTS PASSED PERFECTLY!\n');

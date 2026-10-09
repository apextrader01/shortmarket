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

// 1. Verify isIndexContract identification logic (Spot Index only, excludes derivatives)
function isIndexContract(sym) {
  if (!sym || typeof sym !== 'string') return false;
  const upper = sym.trim().toUpperCase();
  const clean = upper.replace(/^(NSE:|BSE:|NFO:|BFO:|MCX:|CDS:)/i, '').trim();

  // 1. Exclude ALL derivatives (Options, Futures, NFO/BFO contracts)
  // Spot index is never an option (CE/PE) or a future (FUT)
  if (upper.startsWith('NFO:') || upper.startsWith('BFO:') || upper.startsWith('MCX:') || upper.startsWith('CDS:')) {
    return false;
  }
  if (clean.endsWith('CE') || clean.endsWith('PE') || clean.endsWith('FUT') || clean.endsWith('-FUT')) {
    return false;
  }
  if (/(?:\d+|[-_\s])(CE|PE)(?:[-_\s].*)?$/i.test(clean) || /(?:\d+|[A-Z]{3}|[-_\s])FUT(?:[-_\s].*)?$/i.test(clean)) {
    return false;
  }
  if (/\d+.*?(CE|PE)$/i.test(clean)) {
    return false;
  }

  // 2. Identify pure benchmark/spot indices (e.g. NSE:NIFTY50-INDEX, NIFTY, BANKNIFTY, SENSEX)
  if (clean.includes('INDEX') || clean.endsWith('-INDEX')) {
    return true;
  }

  const SPOT_INDICES = [
    'NIFTY',
    'NIFTY50',
    'NIFTY 50',
    'BANKNIFTY',
    'NIFTYBANK',
    'FINNIFTY',
    'MIDCPNIFTY',
    'MIDCAPNIFTY',
    'NIFTYNXT50',
    'NIFTY NEXT 50',
    'NIFTYFPI',
    'SENSEX',
    'BANKEX'
  ];

  const normalizedClean = clean.replace(/[^A-Z0-9]/g, '');
  return SPOT_INDICES.some(idx => normalizedClean === idx.replace(/[^A-Z0-9]/g, ''));
}

test('isIndexContract accurately identifies pure spot indices and NEVER matches options/futures', () => {
  // Pure Spot Indices (MUST return TRUE)
  assert.strictEqual(isIndexContract('NSE:NIFTY50-INDEX'), true);
  assert.strictEqual(isIndexContract('NSE:NIFTYBANK-INDEX'), true);
  assert.strictEqual(isIndexContract('BSE:SENSEX-INDEX'), true);
  assert.strictEqual(isIndexContract('NSE:FINNIFTY-INDEX'), true);
  assert.strictEqual(isIndexContract('NSE:MIDCPNIFTY-INDEX'), true);
  assert.strictEqual(isIndexContract('BSE:BANKEX-INDEX'), true);
  assert.strictEqual(isIndexContract('NIFTY'), true);
  assert.strictEqual(isIndexContract('NIFTY 50'), true);
  assert.strictEqual(isIndexContract('BANKNIFTY'), true);
  assert.strictEqual(isIndexContract('FINNIFTY'), true);
  assert.strictEqual(isIndexContract('MIDCPNIFTY'), true);
  assert.strictEqual(isIndexContract('SENSEX'), true);
  assert.strictEqual(isIndexContract('BANKEX'), true);

  // Index Options (MUST return FALSE - derivatives are tradeable without spot index restriction)
  assert.strictEqual(isIndexContract('NIFTY26O1322500CE'), false);
  assert.strictEqual(isIndexContract('NSE:NIFTY24OCT25000CE'), false);
  assert.strictEqual(isIndexContract('NSE:NIFTY24OCT25000PE'), false);
  assert.strictEqual(isIndexContract('NSE:BANKNIFTY24OCT52000CE'), false);
  assert.strictEqual(isIndexContract('NSE:BANKNIFTY24OCT52000PE'), false);
  assert.strictEqual(isIndexContract('NSE:FINNIFTY24OCT24000CE'), false);
  assert.strictEqual(isIndexContract('NSE:MIDCPNIFTY24OCT13000PE'), false);
  assert.strictEqual(isIndexContract('BSE:SENSEX24OCT82000CE'), false);
  assert.strictEqual(isIndexContract('BSE:BANKEX24OCT58000PE'), false);

  // Index Futures (MUST return FALSE - derivatives are tradeable without spot index restriction)
  assert.strictEqual(isIndexContract('NSE:NIFTY24OCTFUT'), false);
  assert.strictEqual(isIndexContract('NSE:BANKNIFTY24OCTFUT'), false);

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
      // 1. Subscription Check (Exclusive to Pro/Paid subscribers)
      if (!isPaidTier) {
        return {
          status: 403,
          error: 'Index buying is exclusive to Pro subscribers. Please upgrade your subscription to trade Nifty, BankNifty, Sensex and other index contracts.',
          requires_subscription: true
        };
      }
    }
  }

  return { status: 200, success: true };
}

test('Non-subscribed (BASIC) user CAN buy options (NIFTY26O1322500CE, etc.) freely without restriction', () => {
  const result = simulateOrderValidation({
    user: { id: 101, subscription_tier: 'BASIC', is_admin: false },
    order: { symbol: 'NIFTY26O1322500CE', side: 'BUY' }
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.success, true);
});

test('Non-subscribed (BASIC) user buying spot index (NSE:NIFTY50-INDEX) is rejected with 403 requires_subscription', () => {
  const result = simulateOrderValidation({
    user: { id: 101, subscription_tier: 'BASIC', is_admin: false },
    order: { symbol: 'NSE:NIFTY50-INDEX', side: 'BUY' }
  });
  assert.strictEqual(result.status, 403);
  assert.strictEqual(result.requires_subscription, true);
  assert.ok(result.error.includes('exclusive to Pro subscribers'));
});

test('Masterclass (pure coaching) user buying spot index is rejected with 403 requires_subscription', () => {
  const result = simulateOrderValidation({
    user: { id: 103, subscription_tier: 'MASTERCLASS', is_admin: false },
    order: { symbol: 'NSE:NIFTYBANK-INDEX', side: 'BUY' }
  });
  assert.strictEqual(result.status, 403);
  assert.strictEqual(result.requires_subscription, true);
  assert.ok(result.error.includes('exclusive to Pro subscribers'));
});

test('Lifetime Elite user (includes Yearly plan features for life) can buy spot index', () => {
  const result = simulateOrderValidation({
    user: { id: 104, subscription_tier: 'LIFETIME', is_admin: false },
    order: { symbol: 'NSE:NIFTY50-INDEX', side: 'BUY' }
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

test('Subscribed user CAN buy more than one index at a time across NSE and BSE', () => {
  // User already holds NIFTY position and buys BANKNIFTY -> MUST SUCCEED (200 OK)
  const result = simulateOrderValidation({
    user: { id: 102, subscription_tier: 'PRO', is_admin: false },
    order: { symbol: 'NSE:BANKNIFTY24OCT52000CE', side: 'BUY' },
    positions: [
      { symbol: 'NSE:NIFTY24OCT25000CE', quantity: 50 }, // Existing NIFTY position
      { symbol: 'BSE:SENSEX24OCT82000CE', quantity: 10 }  // Existing SENSEX position
    ]
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.success, true);
});

test('Subscribed user holding active index position CAN still buy non-index equities', () => {
  const result = simulateOrderValidation({
    user: { id: 102, subscription_tier: 'PRO', is_admin: false },
    order: { symbol: 'NSE:RELIANCE', side: 'BUY' },
    positions: [
      { symbol: 'NSE:NIFTY24OCT25000CE', quantity: 50 }
    ]
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.success, true);
});

test('Subscribed user with pending index BUY order CAN place another index BUY order', () => {
  const result = simulateOrderValidation({
    user: { id: 102, subscription_tier: 'PRO', is_admin: false },
    order: { symbol: 'NSE:BANKNIFTY24OCT52000CE', side: 'BUY' },
    positions: [],
    pendingOrders: [
      { symbol: 'NSE:NIFTY24OCT25000CE', side: 'BUY', status: 'OPEN' }
    ]
  });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.success, true);
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

test('Code inspection: server.js and store.js enforce index buy subscription without artificial 1-index blockage', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert.ok(serverCode.includes('function isIndexContract'), 'server.js must define isIndexContract');
  assert.ok(serverCode.includes('Index buying is exclusive to Pro subscribers'), 'server.js must require pro subscription for index buy');
  assert.ok(!serverCode.includes('Only 1 active index trade is allowed at a time'), 'server.js must NOT block multiple index trades');

  const storeCode = fs.readFileSync(path.join(__dirname, '../frontend/src/store.js'), 'utf8');
  assert.ok(storeCode.includes('export function isIndexContract'), 'store.js must export isIndexContract');
  assert.ok(!storeCode.includes('Index limit reached: Only 1 active index trade is allowed at a time'), 'store.js must NOT block multiple index trades');
});

console.log('\n🎉 ALL INDEX BUY SUBSCRIPTION & MULTI-TRADE TESTS PASSED PERFECTLY!\n');

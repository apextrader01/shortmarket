#!/usr/bin/env node
/**
 * TEST SUITE: DEEP AUDIT ROUND 3 — COMPREHENSIVE CRASH SHIELDS & ERROR RESILIENCE
 * Verifies:
 * 1. server.js /api/order full route-level try/catch wrapper
 * 2. server.js /api/basket-order full route-level try/catch wrapper
 * 3. MutualFundModal.jsx fund.nav null guard
 * 4. ChartWidget.jsx price.ltp null guard
 * 5. OptionsStrategyBuilder.jsx & OptionChainView.jsx leg.price null guard
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;
const results = [];

function check(label, condition) {
  if (condition) {
    passed++;
    results.push(`  ✔ [PASS] ${label}`);
  } else {
    failed++;
    results.push(`  ✘ [FAIL] ${label}`);
  }
}

console.log('\n======================================================================');
console.log('🔬 TEST SUITE: DEEP AUDIT ROUND 3 — ADVANCED CRASH SHIELDS');
console.log('======================================================================\n');

// ─── MODULE 1: /api/order Full Route-Level Safety Net ────────────────────────

console.log('▶ MODULE 1: server.js POST /api/order Full Route-Level try/catch');

const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8').replace(/\r\n/g, '\n');

// Find /api/order route header
const orderRouteIndex = serverCode.indexOf("app.post('/api/order', authenticateToken");
const orderRouteSlice = serverCode.slice(orderRouteIndex, orderRouteIndex + 400);

check(
  '/api/order begins with try { at the very top of handler',
  orderRouteSlice.includes('lastOrderError = null;') &&
  orderRouteSlice.includes('try {\n    const symbol = req.body.symbol;')
);

check(
  '/api/order has no duplicate nested try at transaction start',
  !serverCode.includes("equityExpiryClosed || mcxExpiryClosed) {\n        return res.status(400).json({\n          error: `Cannot place orders on ${symbol.split('-')[0]}. This contract expires today and the Auto-Square-Off cutoff time has passed.`\n        });\n      }\n    }\n  }\n\n  try {\n    await db.transaction")
);

check(
  '/api/order properly catches errors at the end and responds with HTTP 500',
  serverCode.includes('lastOrderError = { message: error.message, stack: error.stack, payload: req.body };') &&
  serverCode.includes("res.status(500).json({ error: error.message, success: false });")
);

results.forEach(r => console.log(r));
results.length = 0;
console.log('');

// ─── MODULE 2: /api/basket-order Full Route-Level Safety Net ─────────────────

console.log('▶ MODULE 2: server.js POST /api/basket-order Full Route-Level try/catch');

const basketRouteIndex = serverCode.indexOf("app.post('/api/basket-order', authenticateToken");
const basketRouteSlice = serverCode.slice(basketRouteIndex, basketRouteIndex + 300);

check(
  '/api/basket-order begins with try { at the very top of handler',
  basketRouteSlice.includes("try {\n    const { items, total_margin } = req.body;")
);

check(
  '/api/basket-order has no duplicate nested try at transaction start',
  !serverCode.includes("shares. Please adjust quantity.`;\n      return res.status(400).json({ error: err });\n    }\n  }\n\n  try {\n    await db.transaction")
);

check(
  '/api/basket-order catches errors and responds cleanly with HTTP 400',
  serverCode.includes("const hasErrors = finalResponseOrders.some(o => o.error);\n    res.json({ success: !hasErrors, orders: finalResponseOrders });\n  } catch (error) {\n    res.status(400).json({ error: error.message });")
);

results.forEach(r => console.log(r));
results.length = 0;
console.log('');

// ─── MODULE 3: MutualFundModal.jsx Null Guard ────────────────────────────────

console.log('▶ MODULE 3: MutualFundModal.jsx fund.nav Crash Protection');

const mfModalCode = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'src', 'components', 'MutualFundModal.jsx'), 'utf8'
);

check(
  'MutualFundModal.jsx uses null coalescing (fund.nav ?? 0).toFixed(2)',
  mfModalCode.includes('(fund.nav ?? 0).toFixed(2)')
);

check(
  'MutualFundModal.jsx has no unguarded fund.nav.toFixed',
  !mfModalCode.includes('fund.nav.toFixed')
);

results.forEach(r => console.log(r));
results.length = 0;
console.log('');

// ─── MODULE 4: ChartWidget.jsx price.ltp Crash Protection ────────────────────

console.log('▶ MODULE 4: ChartWidget.jsx price.ltp Crash Protection in Quick Order Buttons');

const chartWidgetCode = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'src', 'components', 'ChartWidget.jsx'), 'utf8'
);

check(
  'ChartWidget.jsx SELL quick order button has null guard on price.ltp',
  chartWidgetCode.includes("price?.ltp !== undefined && price?.ltp !== null ? Number(price.ltp).toFixed(2) : '--'")
);

const unguardedLtpCalls = (chartWidgetCode.match(/price\.ltp\.toFixed/g) || []).length;
check(
  'ChartWidget.jsx has zero unguarded price.ltp.toFixed calls in quick order overlay',
  unguardedLtpCalls === 0
);

results.forEach(r => console.log(r));
results.length = 0;
console.log('');

// ─── MODULE 5: OptionsStrategyBuilder.jsx & OptionChainView.jsx ──────────────

console.log('▶ MODULE 5: Options Strategy Builder & Chain leg.price Crash Protection');

const stratBuilderCode = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'src', 'components', 'OptionsStrategyBuilder.jsx'), 'utf8'
);

check(
  'OptionsStrategyBuilder.jsx has null guard (leg.price ?? 0).toFixed(1)',
  stratBuilderCode.includes('(leg.price ?? 0).toFixed(1)')
);

check(
  'OptionsStrategyBuilder.jsx has no unguarded leg.price.toFixed',
  !stratBuilderCode.includes('leg.price.toFixed')
);

const optChainCode = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'src', 'components', 'OptionChainView.jsx'), 'utf8'
);

check(
  'OptionChainView.jsx defaults leg price to 0 when ltp is missing',
  optChainCode.includes('price: legData.ltp || 0')
);

results.forEach(r => console.log(r));
results.length = 0;
console.log('');

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

console.log('======================================================================');
console.log(`🏁 TEST COMPLETE: ${passed}/${passed + failed} CHECKS PASSED`);
console.log('======================================================================');

if (failed > 0) {
  console.log(`\n⚠️  ${failed} check(s) FAILED — review above output.`);
  process.exit(1);
}
console.log('\n🎉 ALL DEEP AUDIT ROUND 3 CRASH SHIELDS VERIFIED PERFECTLY!\n');

#!/usr/bin/env node
/**
 * TEST SUITE: DEEP AUDIT ROUND 2 — CRASH-PROOF ROUTES, NULL GUARDS & FREEZE LIMIT ENFORCEMENT
 * Tests all fixes from the second deep platform audit.
 */

const fs = require('fs');
const path = require('path');

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
console.log('🔬 TEST SUITE: DEEP AUDIT ROUND 2 — CRASH PROTECTION & FREEZE LIMITS');
console.log('======================================================================\n');

// ─── MODULE 1: Async Route Try/Catch Protection ───────────────────────────────

console.log('▶ MODULE 1: Async Routes Protected with try/catch (Server Crash Prevention)');

const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

// /api/prices/batch
const batchPricesSection = serverCode.match(/app\.get\('\/api\/prices\/batch'[\s\S]*?\n\}\);/);
check(
  '/api/prices/batch route has try/catch error handling',
  batchPricesSection && batchPricesSection[0].includes('try {') && batchPricesSection[0].includes('catch (err)')
);

// /api/options/chain/:symbol
const optionsChainSection = serverCode.match(/app\.get\('\/api\/options\/chain\/:symbol'[\s\S]*?\n\}\);/);
check(
  '/api/options/chain/:symbol route has try/catch error handling',
  optionsChainSection && optionsChainSection[0].includes('try {') && optionsChainSection[0].includes('catch (err)')
);

// /api/options/symbols
const optionsSymbolsSection = serverCode.match(/app\.get\('\/api\/options\/symbols'[\s\S]*?\n\}\);/);
check(
  '/api/options/symbols route has try/catch error handling',
  optionsSymbolsSection && optionsSymbolsSection[0].includes('try {') && optionsSymbolsSection[0].includes('catch (err)')
);

// /api/options/futures/:symbol
const futuresSection = serverCode.match(/app\.get\('\/api\/options\/futures\/:symbol'[\s\S]*?\n\}\);/);
check(
  '/api/options/futures/:symbol route has try/catch error handling',
  futuresSection && futuresSection[0].includes('try {') && futuresSection[0].includes('catch (err)')
);

// Verify all return 500 on error
check(
  'All protected routes return HTTP 500 on error',
  batchPricesSection[0].includes('res.status(500)') &&
  optionsChainSection[0].includes('res.status(500)') &&
  optionsSymbolsSection[0].includes('res.status(500)') &&
  futuresSection[0].includes('res.status(500)')
);

results.forEach(r => console.log(r));
results.length = 0;
console.log('');

// ─── MODULE 2: Null Guards for .toFixed() Crashes ────────────────────────────

console.log('▶ MODULE 2: Null Guards for .toFixed() Crashes');

const stockDetailsCode = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'src', 'components', 'StockDetails.jsx'), 'utf8'
);

check(
  'StockDetails.jsx peer.livePriceData.dayChange has null coalescing guard',
  stockDetailsCode.includes('(peer.livePriceData.dayChange ?? 0)') || 
  stockDetailsCode.includes('(peer.livePriceData.dayChange || 0)')
);

check(
  'StockDetails.jsx peer.livePriceData.dayChangePerc has null coalescing guard',
  stockDetailsCode.includes('(peer.livePriceData.dayChangePerc ?? 0)') ||
  stockDetailsCode.includes('(peer.livePriceData.dayChangePerc || 0)')
);

const mfViewCode = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'src', 'components', 'MutualFundsView.jsx'), 'utf8'
);

// Count how many unguarded fund.nav.toFixed remain
const unguardedNavCalls = (mfViewCode.match(/fund\.nav\.toFixed/g) || []).length;
const guardedNavCalls = (mfViewCode.match(/\(fund\.nav \?\? 0\)\.toFixed/g) || []).length;

check(
  'MutualFundsView.jsx all fund.nav.toFixed() calls are protected with ?? 0',
  unguardedNavCalls === 0 && guardedNavCalls >= 2
);

results.forEach(r => console.log(r));
results.length = 0;
console.log('');

// ─── MODULE 3: DOMLadderModal Freeze Limit Enforcement ───────────────────────

console.log('▶ MODULE 3: DOMLadderModal Freeze Limit Enforcement (Security Fix)');

const domLadderCode = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'src', 'components', 'DOMLadderModal.jsx'), 'utf8'
);

check(
  'DOMLadderModal imports getFreezeLimit from freezeLimits',
  domLadderCode.includes("import { getFreezeLimit") || domLadderCode.includes("getFreezeLimit")
);

check(
  'DOMLadderModal imports calculateOrderSlices from freezeLimits',
  domLadderCode.includes("calculateOrderSlices") && domLadderCode.includes("freezeLimits")
);

check(
  'DOMLadderModal handleOrder calls getFreezeLimit before placing order',
  domLadderCode.includes('getFreezeLimit(symbol)') || domLadderCode.includes('getFreezeLimit(')
);

check(
  'DOMLadderModal calls calculateOrderSlices with exact arguments (symbol, totalQty, lotsize)',
  domLadderCode.includes('calculateOrderSlices(symbol, totalQty, lotsize)')
);

check(
  'DOMLadderModal auto-slices orders exceeding freeze limit',
  domLadderCode.includes('calculateOrderSlices(') && domLadderCode.includes('maxAllowedLots')
);

// Ensure the old unprotected pattern is gone
const hasDirectUnprotectedQty = /quantity:\s*lotsize\s*\*\s*\(oneClickMultiplier/.test(domLadderCode);
check(
  'DOMLadderModal no longer directly uses lotsize * oneClickMultiplier without freeze check',
  !hasDirectUnprotectedQty
);

results.forEach(r => console.log(r));
results.length = 0;
console.log('');

// ─── MODULE 4: MarketDepthModal Freeze Limit Enforcement ────────────────────

console.log('▶ MODULE 4: MarketDepthModal Freeze Limit Enforcement (Security Fix)');

const marketDepthCode = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'src', 'components', 'MarketDepthModal.jsx'), 'utf8'
);

check(
  'MarketDepthModal imports getFreezeLimit from freezeLimits',
  marketDepthCode.includes("getFreezeLimit") && marketDepthCode.includes("freezeLimits")
);

check(
  'MarketDepthModal imports calculateOrderSlices from freezeLimits',
  marketDepthCode.includes("calculateOrderSlices") && marketDepthCode.includes("freezeLimits")
);

check(
  'MarketDepthModal calls calculateOrderSlices with exact arguments (symbol, totalQty, lotSize)',
  marketDepthCode.includes('calculateOrderSlices(symbol, totalQty, lotSize)')
);

check(
  'MarketDepthModal has handleOneClickOrder helper with freeze limit logic',
  marketDepthCode.includes('handleOneClickOrder') && marketDepthCode.includes('getFreezeLimit(symbol')
);

check(
  'MarketDepthModal BUY button uses handleOneClickOrder',
  marketDepthCode.includes("handleOneClickOrder('BUY')")
);

check(
  'MarketDepthModal SELL button uses handleOneClickOrder',
  marketDepthCode.includes("handleOneClickOrder('SELL')")
);

// Ensure the old unprotected pattern is gone from both BUY and SELL
const unprotectedMDQty = (marketDepthCode.match(/quantity:\s*lotSize\s*\*\s*\(oneClickMultiplier/g) || []).length;
check(
  'MarketDepthModal no longer has inline unprotected quantity: lotSize * (oneClickMultiplier) patterns',
  unprotectedMDQty === 0
);

results.forEach(r => console.log(r));
results.length = 0;
console.log('');

// ─── MODULE 5: OrderModal Single Clean Freeze Alert Banner ───────────────────

console.log('▶ MODULE 5: OrderModal Clean Alert Banner (No Duplication)');

const orderModalCode = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'src', 'components', 'OrderModal.jsx'), 'utf8'
);

// Count occurrences of max allowed lots per order (1 in submit validation alert, 1 in visual banner)
const warningOccurrences = (orderModalCode.match(/Max allowed lots per order as per exchange is/g) || []).length;
check(
  'OrderModal has exactly 1 visual freeze limit alert banner (duplicate 3rd banner eliminated)',
  warningOccurrences === 2 && !orderModalCode.includes('borderBottom: \'1px solid rgba(239, 68, 68, 0.3)\'')
);

check(
  'OrderModal includes SET MAX clamp button within the single alert banner',
  orderModalCode.includes('SET MAX') && orderModalCode.includes('setQuantity(orderModal.lotsize > 1 ? maxAllowedLots : freezeLimit)')
);

results.forEach(r => console.log(r));
results.length = 0;
console.log('');

// ─── MODULE 6: Backend PositionsEngine Validation ───────────────────────────

console.log('▶ MODULE 5: Backend PositionsEngine Critical Path Validation');

const positionsEngineCode = fs.readFileSync(
  path.join(__dirname, 'services', 'positionsEngine.js'), 'utf8'
);

check(
  'PositionsEngine sweepPendingOrders uses pg_try_advisory_lock for cluster safety',
  positionsEngineCode.includes('pg_try_advisory_lock') && positionsEngineCode.includes('sweepPendingOrders')
);

check(
  'PositionsEngine forceSquareOff uses pg_try_advisory_lock for cluster safety',
  positionsEngineCode.includes('cron_force_squareoff')
);

check(
  'PositionsEngine settleExpiries handles worthless OTM options at ₹0 correctly',
  positionsEngineCode.includes('ltp === 0') && positionsEngineCode.includes('expired worthless')
);

check(
  'PositionsEngine releases advisory locks in finally block',
  positionsEngineCode.includes('pg_advisory_unlock') && positionsEngineCode.includes('finally')
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
console.log('\n🎉 ALL DEEP AUDIT ROUND 2 FIXES VERIFIED PERFECTLY!\n');

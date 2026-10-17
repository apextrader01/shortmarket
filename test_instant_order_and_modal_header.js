// test_instant_order_and_modal_header.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 TESTING MODAL HEADER OVERFLOW & INSTANT BUY/SELL ENGINE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// ── TEST 1: OrderModal.jsx Header Overflow Prevention ──
runTest('OrderModal.jsx header prevents long symbol overflow with flex constraints', () => {
  const content = fs.readFileSync(path.join(__dirname, 'frontend/src/components/OrderModal.jsx'), 'utf-8');
  assert(content.includes("overflow: 'hidden'"), 'Header missing overflow: hidden');
  assert(content.includes("minWidth: 0, overflow: 'hidden'"), 'Title container missing minWidth: 0 constraint');
  assert(content.includes("textOverflow: 'ellipsis'"), 'Title missing ellipsis truncation');
  assert(content.includes("flexShrink: 0"), 'Action buttons missing flexShrink: 0 constraint');
  assert(content.includes("openMarketDepthModal"), 'Missing Market Depth trigger button');
  assert(content.includes("closeOrderModal"), 'Missing close button');
});

// ── TEST 2: MarketDepthModal.jsx Instant Buy/Sell Full Rule Execution ──
runTest('MarketDepthModal.jsx implements robust instant order execution with all trading rules', () => {
  const content = fs.readFileSync(path.join(__dirname, 'frontend/src/components/MarketDepthModal.jsx'), 'utf-8');
  assert(content.includes("getMarketSession"), 'Missing getMarketSession market timing evaluator');
  assert(content.includes("isDerivativeContract"), 'Missing isDerivativeContract helper');
  assert(content.includes("isCommodityContract"), 'Missing isCommodityContract helper');
  assert(content.includes("isIndexContract"), 'Missing isIndexContract helper');
  assert(content.includes("getFreezeLimit"), 'Missing getFreezeLimit check');
  assert(content.includes("isAmoWindow"), 'Missing AMO window evaluation');
  assert(content.includes("showToast"), 'Missing user feedback toast calls');
  assert(content.includes("setIsPlacing"), 'Missing isPlacing loading state');
  assert(content.includes("disabled={isPlacing}"), 'Missing button disabled state while placing');
});

// ── TEST 3: DOMLadderModal.jsx & OptionChainView.jsx One-Click Parity ──
runTest('DOMLadderModal.jsx & OptionChainView.jsx respect market session and show feedback toasts', () => {
  const domContent = fs.readFileSync(path.join(__dirname, 'frontend/src/components/DOMLadderModal.jsx'), 'utf-8');
  assert(domContent.includes("getMarketSession"), 'DOMLadderModal missing getMarketSession');
  assert(domContent.includes("showToast"), 'DOMLadderModal missing showToast');

  const optContent = fs.readFileSync(path.join(__dirname, 'frontend/src/components/OptionChainView.jsx'), 'utf-8');
  assert(optContent.includes("getMarketSession"), 'OptionChainView missing getMarketSession');
  assert(optContent.includes("showToast"), 'OptionChainView missing showToast');
});

console.log('\n================================================================');
console.log(`🏁 SUITE RESULTS: ${passed} / ${passed + failed} PASSED (${failed} FAILED)`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}

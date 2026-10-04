// test_skandx_algo_suite.js
// 🌟 SkandX Algo Verification & Quality Assurance Suite

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('⚡ SKANDX ALGO VERIFICATION & INTEGRATION SUITE');
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

// ── TEST 1: App.jsx Full-Page Mounting & Route Synchronization ──
runTest('App.jsx mounts SkandxAlgoView as full page at activeTab === "Algo"', () => {
  const appContent = fs.readFileSync(path.join(__dirname, 'frontend/src/App.jsx'), 'utf-8');
  assert(appContent.includes("const SkandxAlgoView = lazyWithRetry(() => import('./components/SkandxAlgoView'));"), 'Missing lazy import');
  assert(appContent.includes("'algo': 'Algo'"), 'Missing algo in tabsMap');
  assert(appContent.includes("else if (activeTab === 'Algo') newPath = '/algo';"), 'Missing /algo URL sync');
  assert(appContent.includes("<SkandxAlgoView"), 'Missing SkandxAlgoView component mounting');
  assert(appContent.includes("onOpenAlgoBridge={() => setActiveTab('Algo')}"), 'Hub 11 must direct to full Algo page');
});

// ── TEST 2: SkandxAlgoView Component Integrity ──
runTest('SkandxAlgoView.jsx has full 8 modules, modals, and institutional layouts', () => {
  const viewContent = fs.readFileSync(path.join(__dirname, 'frontend/src/components/SkandxAlgoView.jsx'), 'utf-8');
  assert(viewContent.includes('export default function SkandxAlgoView'), 'Missing default export');
  assert(viewContent.includes("activeMenu === 'Dashboard'"), 'Missing Dashboard sub-view');
  assert(viewContent.includes("activeMenu === 'Demat'"), 'Missing Demat Accounts sub-view');
  assert(viewContent.includes("activeMenu === 'StaticIp'"), 'Missing Static IPs sub-view');
  assert(viewContent.includes("activeMenu === 'LinkUser'"), 'Missing Link Users sub-view');
  assert(viewContent.includes("activeMenu === 'WatchList'"), 'Missing Algo Watchlist sub-view');
  assert(viewContent.includes("activeMenu === 'GroupCopy'"), 'Missing Copy Trading sub-view');
  assert(viewContent.includes("activeMenu === 'Bridge'"), 'Missing Webhooks sub-view');
  assert(viewContent.includes("activeMenu === 'TelegramBot'"), 'Missing Telegram sub-view');
  assert(viewContent.includes('showRechargeModal'), 'Missing Wallet Recharge / Add Funds Modal');
  assert(viewContent.includes('showAddDematModal'), 'Missing Demat Connection Modal');
  assert(viewContent.includes('showReauthModal'), 'Missing TOTP Reauth Modal');
  assert(viewContent.includes('showOrderModal'), 'Missing 1-Click Order Execution Modal');
});

// ── TEST 3: Backend Bridge API Endpoints Registered in server.js ──
runTest('backend/server.js registers all SkandX Algo bridge endpoints', () => {
  const serverContent = fs.readFileSync(path.join(__dirname, 'backend/server.js'), 'utf-8');
  assert(serverContent.includes("app.get('/api/v1/bridge/all'"), 'Missing /api/v1/bridge/all');
  assert(serverContent.includes("app.post('/api/v1/bridge/demats'"), 'Missing /api/v1/bridge/demats');
  assert(serverContent.includes("app.post('/api/v1/bridge/ips/purchase'"), 'Missing /api/v1/bridge/ips/purchase');
  assert(serverContent.includes("app.post('/api/v1/bridge/watchlist/add'"), 'Missing /api/v1/bridge/watchlist/add');
  assert(serverContent.includes("app.post('/api/v1/bridge/kill-switch'"), 'Missing /api/v1/bridge/kill-switch');
  assert(serverContent.includes("app.post('/api/v1/bridge/credit/recharge'"), 'Missing /api/v1/bridge/credit/recharge');
  assert(serverContent.includes("app.post('/api/v1/bridge/order'"), 'Missing /api/v1/bridge/order');
  assert(serverContent.includes("app.post('/api/v1/bridge/webhook'"), 'Missing /api/v1/bridge/webhook');
});

// ── TEST 4: Frontend Production Build Artifact Exists ──
runTest('Frontend build generates SkandxAlgoView production chunk', () => {
  const distAssets = fs.readdirSync(path.join(__dirname, 'frontend/dist/assets'));
  const algoChunk = distAssets.find(f => f.startsWith('SkandxAlgoView-') && f.endsWith('.js'));
  assert(algoChunk, 'SkandxAlgoView production JS chunk not found in dist/assets');
});

console.log('\n================================================================');
console.log(`🏁 SUITE RESULTS: ${passed} / ${passed + failed} PASSED (${failed} FAILED)`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}

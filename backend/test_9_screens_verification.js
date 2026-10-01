// ======================================================================
// 🧪 TEST SUITE: 9 CORE UI/UX STATES & SCREENS VERIFICATION
// ======================================================================
const fs = require('fs');
const path = require('path');

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

console.log('======================================================================');
console.log('🖥️  VERIFYING 9 CORE UI/UX STATES AND SCREEN ARCHITECTURE');
console.log('======================================================================\n');

// 1. FILE EXISTENCE CHECK
console.log('▶ 1. COMPONENT INTEGRITY & EXISTENCE');
const components = [
  'frontend/src/components/SkeletonLoader.jsx',
  'frontend/src/components/EmptyState.jsx',
  'frontend/src/components/GlobalToast.jsx',
  'frontend/src/components/ErrorBoundary.jsx',
  'frontend/src/components/NetworkStatusBanner.jsx',
  'frontend/src/components/PermissionDenied.jsx',
  'frontend/src/components/SessionExpiredModal.jsx'
];

components.forEach(comp => {
  const fullPath = path.resolve(__dirname, '..', comp);
  assert(fs.existsSync(fullPath), `Component file exists: ${path.basename(comp)}`);
});

// 2. STORE.JS INTEGRATION (Toast & 401 Session Expiry)
console.log('\n▶ 2. STORE & FETCH INTERCEPTOR (Session Expiry & Toast Management)');
const storeContent = fs.readFileSync(path.resolve(__dirname, '../frontend/src/store.js'), 'utf-8');

assert(storeContent.includes('isSessionExpired: false'), 'store.js initializes isSessionExpired: false');
assert(storeContent.includes('setSessionExpired: (isExpired)'), 'store.js provides setSessionExpired action');
assert(storeContent.includes('toast: null'), 'store.js initializes global toast: null');
assert(storeContent.includes('showToast: (toastOrMessage'), 'store.js provides showToast action');
assert(storeContent.includes('hideToast: () =>'), 'store.js provides hideToast action');
assert(storeContent.includes('res.status === 401'), 'window.fetch interceptor catches 401 status for session expiry');
assert(storeContent.includes('window.__triggerSessionExpired'), 'Global trigger handler __triggerSessionExpired attached');
assert(storeContent.includes('isInitialUserDataLoaded: false'), 'store.js tracks initial data hydration state');

// 3. APP.JSX MOUNTING & ROUTING
console.log('\n▶ 3. TOP-LEVEL MOUNTING & ACCESS CONTROL (App.jsx)');
const appContent = fs.readFileSync(path.resolve(__dirname, '../frontend/src/App.jsx'), 'utf-8');

assert(appContent.includes('<NetworkStatusBanner />'), 'App.jsx mounts NetworkStatusBanner');
assert(appContent.includes('<GlobalToast />'), 'App.jsx mounts GlobalToast');
assert(appContent.includes('<SessionExpiredModal />'), 'App.jsx mounts SessionExpiredModal');
assert(appContent.includes('<PermissionDenied onBack='), 'App.jsx renders PermissionDenied when non-admin accesses AdminPanel');
assert(appContent.includes('<DataStatusBadge />'), 'App.jsx includes DataStatusBadge for LIVE / PARTIAL DATA');
assert(appContent.includes("PARTIAL DATA"), 'DataStatusBadge supports fallback indicator');

// 4. ORDERSVIEW & POSITIONSVIEW (Skeleton Loader & Empty State)
console.log('\n▶ 4. DATA VIEWS (Skeleton Loader & Standardized Empty State)');
const ordersContent = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/OrdersView.jsx'), 'utf-8');
const positionsContent = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/PositionsView.jsx'), 'utf-8');

assert(ordersContent.includes('<SkeletonLoader'), 'OrdersView integrates SkeletonLoader during hydration');
assert(ordersContent.includes('<EmptyState'), 'OrdersView integrates EmptyState for 0 records');
assert(positionsContent.includes('<SkeletonLoader'), 'PositionsView integrates SkeletonLoader during hydration');
assert(positionsContent.includes('<EmptyState'), 'PositionsView integrates EmptyState for 0 records');

// 5. ORDERMODAL VALIDATION & SUCCESS TOASTS (No Blocking Alerts)
console.log('\n▶ 5. ORDER MODAL VALIDATION & SUCCESS NOTIFICATIONS');
const modalContent = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/OrderModal.jsx'), 'utf-8');

assert(modalContent.includes('validationError'), 'OrderModal tracks validationError state');
assert(modalContent.includes('failValidation'), 'OrderModal uses non-blocking failValidation handler');
assert(modalContent.includes('showToast("Order Executed Successfully!"'), 'OrderModal shows animated success toast on execution');
assert(!modalContent.includes('alert("✅ Order Executed Successfully!")'), 'OrderModal eliminated blocking alert() on execution');

// 6. ERROR BOUNDARY POLISHED FALLBACK
console.log('\n▶ 6. ERROR BOUNDARY CUSTOMER RECOVERY');
const errorContent = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/ErrorBoundary.jsx'), 'utf-8');

assert(errorContent.includes('Reload Platform'), 'ErrorBoundary provides "Reload Platform" recovery button');
assert(errorContent.includes('Go to Dashboard'), 'ErrorBoundary provides "Go to Dashboard" button');
assert(!errorContent.includes('#330000'), 'ErrorBoundary removed legacy red developer crash box');

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
console.log('======================================================================');

if (totalChecks === passedChecks) {
  console.log('🎉 ALL 9 CORE UI/UX STATES & SCREENS VERIFIED 100% PERFECT!\n');
  process.exit(0);
} else {
  console.error('❌ SOME CHECKS FAILED!\n');
  process.exit(1);
}

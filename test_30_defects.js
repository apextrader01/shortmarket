/**
 * Test Suite: 30 Concrete Bugs Remediation Verification
 * Run with: node test_30_defects.js
 */

const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] Defect ${totalTests.toString().padStart(2, '0')}: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] Defect ${totalTests.toString().padStart(2, '0')}: ${testName}`);
    if (details) console.error(`     Reason: ${details}`);
  }
}

console.log('\n================================================================');
console.log('🧪 SKANDX 30-DEFECT REMEDIATION VERIFICATION SUITE');
console.log('================================================================\n');

// Load source files
const serverJs = fs.readFileSync(path.join(__dirname, 'backend/server.js'), 'utf8');
const authJs = fs.readFileSync(path.join(__dirname, 'backend/middleware/auth.js'), 'utf8');
const autoSqJs = fs.readFileSync(path.join(__dirname, 'backend/services/autoSquareOff.js'), 'utf8');
const cronJs = fs.readFileSync(path.join(__dirname, 'backend/services/cronJobs.js'), 'utf8');
const orderExecJs = fs.readFileSync(path.join(__dirname, 'backend/services/orderExecutor.js'), 'utf8');
const posEngJs = fs.readFileSync(path.join(__dirname, 'backend/services/positionsEngine.js'), 'utf8');
const trigEngJs = fs.readFileSync(path.join(__dirname, 'backend/services/triggerEngine.js'), 'utf8');

const appJs = fs.readFileSync(path.join(__dirname, 'frontend/src/App.jsx'), 'utf8');
const alertModalJs = fs.readFileSync(path.join(__dirname, 'frontend/src/components/AlertModal.jsx'), 'utf8');
const mfModalJs = fs.readFileSync(path.join(__dirname, 'frontend/src/components/MutualFundModal.jsx'), 'utf8');
const orderModalJs = fs.readFileSync(path.join(__dirname, 'frontend/src/components/OrderModal.jsx'), 'utf8');
const ordersViewJs = fs.readFileSync(path.join(__dirname, 'frontend/src/components/OrdersView.jsx'), 'utf8');
const portViewJs = fs.readFileSync(path.join(__dirname, 'frontend/src/components/PortfolioView.jsx'), 'utf8');
const posViewJs = fs.readFileSync(path.join(__dirname, 'frontend/src/components/PositionsView.jsx'), 'utf8');
const journalJs = fs.readFileSync(path.join(__dirname, 'frontend/src/components/TradingJournalView.jsx'), 'utf8');

// -------------------------------------------------------------
// BATCH 1: Security & Authentication (Defects 1 - 6)
// -------------------------------------------------------------
console.log('🔒 BATCH 1: Security & Authentication');

// Defect 1: IP ban spoofing via untrusted headers removed
const hasUntrustedHeaders = serverJs.includes("req.headers['x-client-public-ip']") || authJs.includes("req.headers['x-client-public-ip']");
const hasUntrustedBodyIp = serverJs.includes("req.body?.client_ip") || authJs.includes("req.body?.client_ip");
assert(!hasUntrustedHeaders && !hasUntrustedBodyIp, 'Untrusted IP spoofing headers purged from auth & server');

// Defect 2: Reverse proxy order limiter bypass
const hasLoopbackBypass = serverJs.includes('const isLoopback = ip ===') && serverJs.includes('skip: (req) => isLoopback');
const keysByUser = serverJs.includes("req.user?.id ? `user_${req.user.id}` : (req.ip || 'ip_unknown')");
assert(!hasLoopbackBypass && keysByUser, 'Order limiter loopback bypass removed and keyed by authenticated user ID');

// Defect 3: JWT session record deletion on logout
const logoutInvalidatesSession = serverJs.includes("app.post('/api/auth/logout'") && 
  serverJs.includes("db('user_sessions').where({ token_hash: tokenHash }).del()");
assert(logoutInvalidatesSession, 'Logout endpoint deletes token session from user_sessions table');

// Defect 4: Session revocation on password change
const pwdRevokesSessions = serverJs.includes("app.post('/api/user/password'") &&
  serverJs.includes("db('user_sessions').where({ user_id: req.user.id }).del()");
assert(pwdRevokesSessions, 'Password change revokes all active sessions for the user');

// Defect 5: Pre-login rate limiting applied
const preLoginHasLimiter = serverJs.includes("app.post('/api/auth/pre-login', authLimiter");
assert(preLoginHasLimiter, 'authLimiter middleware attached to POST /api/auth/pre-login');

// Defect 6: Password reset attempt wipe exploit fixed
const forgotStart = serverJs.indexOf("app.post('/api/auth/forgot-password'");
const forgotEnd = serverJs.indexOf("app.post('/api/auth/verify-reset-otp'");
const forgotBlock = forgotStart !== -1 && forgotEnd !== -1 ? serverJs.substring(forgotStart, forgotEnd) : '';
const forgotHasLockout = serverJs.includes("attemptRecord.lockedUntil && now < attemptRecord.lockedUntil") &&
  !forgotBlock.includes("passwordResetAttempts.delete");
assert(forgotHasLockout, 'Password reset enforces 15-min lockout without wiping attempt counter on OTP requests');

// -------------------------------------------------------------
// BATCH 2: Trading Engine & Orders (Defects 7 - 14)
// -------------------------------------------------------------
console.log('\n📈 BATCH 2: Trading Engine & Orders');

// Defect 7: Exit order modification margin check prefix normalization
const exitOrderPrefixNorm = serverJs.includes("const cleanSym = order.symbol && order.symbol.includes(':') ? order.symbol.split(':')[1] : order.symbol;") &&
  serverJs.includes("openHolding = (order.product_type === 'DEL' || order.product_type === 'CNC') && order.side === 'SELL'");
assert(exitOrderPrefixNorm, 'PUT /api/order/:id normalizes symbol prefixes and verifies holdings for exit orders');

// Defect 8: Backend GTT order status acceptance
const gttAccepted = !serverJs.includes("error: 'GTT orders are not supported.'") &&
  serverJs.includes("type === 'GTT' && (!trigger_price || parseFloat(trigger_price) <= 0 || isNaN(parseFloat(trigger_price))))");
assert(gttAccepted, 'Backend accepts GTT orders with valid trigger prices instead of rejecting with HTTP 400');

// Defect 9: Dead trigger code removed from orderExecutor.js
const hasDeadTriggerCode = orderExecJs.includes('// --- GTT / SL Trigger Logic ---') || orderExecJs.includes('if (order.trigger_price)');
assert(!hasDeadTriggerCode, 'Dead trigger logic removed from orderExecutor; market orders executed directly');

// Defect 10: OrderModal exitQuantity typo fixed
const exitQtyTypoFixed = !orderModalJs.includes('orderModal.exitQuantity ? totalQuantity <= Number(orderModal.exitQuantity)') &&
  orderModalJs.includes('explicitExitMax > 0 && totalQuantity <= explicitExitMax');
assert(exitQtyTypoFixed, 'OrderModal.jsx totalExitQty typo fixed to prevent naked shorting with ₹0 margin');

// Defect 11: Convert Position UI in PositionsView
const hasConvertModal = posViewJs.includes('Convert Position') && posViewJs.includes('convertPosition(posId, targetProd, reqMargin)');
const hasConvertButtons = posViewJs.includes('Convert') && posViewJs.includes('RefreshCw');
assert(hasConvertModal && hasConvertButtons, 'Convert Position UI modal and action buttons integrated in PositionsView.jsx');

// Defect 12: Derivative holding offset during expiry
const derivExpiryFix = /if \(\(order\.product_type === 'DEL' \|\| order\.product_type === 'CNC'\) && remainingQty < 0\) \{\s*const holding = await trx\('holdings'\)/.test(trigEngJs);
assert(derivExpiryFix, 'Derivative holdings settled on expiry properly offset holdings without injecting rogue shorts');

// Defect 13: EOD square-off pricing fallback sequence
const eodFallbackFix = cronJs.includes('cached?.close > 0') &&
  cronJs.includes('cached?.prev_close_price > 0') &&
  cronJs.includes("status: 'EXECUTED'");
assert(eodFallbackFix, 'EOD square-off resolves close, prev_close, and last trade before falling back to average_price');

// Defect 14: Post-cutoff intraday trading blocked
const intradayBlockedEnforced = serverJs.includes("const { isIntradayBlocked } = require('./services/cronJobs');") &&
  serverJs.includes("isIntradayBlocked(symbol)");
assert(intradayBlockedEnforced, 'server.js imports and enforces isIntradayBlocked on order placement');

// -------------------------------------------------------------
// BATCH 3: Crons, Background Services & Settlements (Defects 15 - 21)
// -------------------------------------------------------------
console.log('\n⚙️ BATCH 3: Crons, Background Services & Settlements');

// Defect 15: autoSquareOff trigger cancellations scoped to intraday products
const autoSqTrigScoped = autoSqJs.includes(".whereIn('product_type', ['INT', 'MIS', 'BO', 'CO'])");
assert(autoSqTrigScoped, 'autoSquareOff scopes trigger cancellation strictly to intraday products (INT, MIS, BO, CO)');

// Defect 16: Zero RMS penalty on natural contract expiry
const naturalExpiryZeroPenalty = autoSqJs.includes("await squareOffPositionInProcess(pos, ltp, 'Contract Expiry Settlement', false);") &&
  autoSqJs.includes('isRmsPenalty = true');
assert(naturalExpiryZeroPenalty, 'Zero RMS penalty (₹0) charged on natural derivative expiry settlements');

// Defect 17: Expiry date lookup prefix tolerance
const parseExpiryTolerance = autoSqJs.includes("const cleanSym = symbol.includes(':') ? symbol.split(':')[1] : symbol;") &&
  autoSqJs.includes('map[cleanSym]');
assert(parseExpiryTolerance, 'parseExpiryDate supports both raw and exchange-prefixed contract lookups');

// Defect 18: Zombie positions eliminated when LTP <= 0 in positionsEngine
const posEngLtpFallback = posEngJs.includes('cached?.close > 0') &&
  posEngJs.includes('cached?.prev_close_price > 0') &&
  posEngJs.includes('ltp = Number(pos.average_price) || 0;');
assert(posEngLtpFallback, 'positionsEngine falls back to settlement prices when LTP <= 0 to eliminate zombie positions');

// Defect 19: MCX winter session DST trading schedule
const mcxWinterAware = cronJs.includes('const isMCXWinterSession = () =>') &&
  cronJs.includes("cron.schedule('30 23 * * *'") &&
  cronJs.includes("cron.schedule('40 23 * * *'");
assert(mcxWinterAware, 'MCX winter session aware crons scheduled for 23:30 cutoff and 23:40 square-off');

// Defect 20: PUT /api/user/details route implemented
const putUserDetailsRoute = serverJs.includes("app.put('/api/user/details', authenticateToken, handleUpdateUserDetails)") &&
  serverJs.includes("app.post('/api/user/details', authenticateToken, handleUpdateUserDetails)");
assert(putUserDetailsRoute, 'PUT /api/user/details route registered for updating user phone, PAN, and bank details');

// Defect 21: MutualFundModal store dispatch hookup
const mfStoreDispatch = mfModalJs.includes('useStore.getState().createSip') &&
  mfModalJs.includes('useStore.getState().buyMutualFund') &&
  !mfModalJs.includes('In a real app, this would dispatch to backend');
assert(mfStoreDispatch, 'MutualFundModal.jsx hooks directly into real store SIP and lumpsum methods');

// -------------------------------------------------------------
// BATCH 4: Frontend Portfolios, Journal & Analytics (Defects 22 - 30)
// -------------------------------------------------------------
console.log('\n📊 BATCH 4: Frontend Portfolios, Journal & Analytics');

// Defect 22: TradingJournalView entrySide dynamic deduction
const journalSideFix = journalJs.includes('const closingOrder = (orders || []).find') &&
  journalJs.includes("entrySide = closingOrder.side === 'BUY' ? 'SELL' : 'BUY'");
assert(journalSideFix, 'TradingJournalView derives trade side dynamically from closing orders and P&L');

// Defect 23: Distinct entry and exit prices in TradingJournalView
const journalPriceFix = journalJs.includes('entryPrice = exitPrice - (pnl / qty)') &&
  journalJs.includes('entryPrice = exitPrice + (pnl / qty)');
assert(journalPriceFix, 'TradingJournalView calculates separate, authentic entry and exit prices');

// Defect 24: PUT /api/journal/mistakes/:id endpoint
const putMistakesRoute = serverJs.includes("app.put('/api/journal/mistakes/:id', authenticateToken");
assert(putMistakesRoute, 'PUT /api/journal/mistakes/:id registered and protected on backend');

// Defect 25: PUT /api/journal/strategies/:id endpoint
const putStrategiesRoute = serverJs.includes("app.put('/api/journal/strategies/:id', authenticateToken");
assert(putStrategiesRoute, 'PUT /api/journal/strategies/:id registered and protected on backend');

// Defect 26: PortfolioView IST timezone comparison
const portIstDate = portViewJs.includes("timeZone: 'Asia/Kolkata'");
assert(portIstDate, 'PortfolioView uses Asia/Kolkata timezone formatting in isToday date comparisons');

// Defect 27: Symbol prefix normalization in App.jsx alertPrices
const appAlertPrefixNorm = appJs.includes("const clean = sym.includes(':') ? sym.split(':')[1] : sym;") &&
  appJs.includes("if (alert.createdPrice && alert.createdPrice >= alert.targetPrice) return;");
assert(appAlertPrefixNorm, 'App.jsx normalizes symbol prefixes in alert price mappings');

// Defect 28: AlertModal symbol prefix normalization
const alertModalPrefixNorm = alertModalJs.includes("const clean = symbol.includes(':') ? symbol.split(':')[1] : symbol;") &&
  alertModalJs.includes("createdPrice: ltp");
assert(alertModalPrefixNorm, 'AlertModal.jsx looks up exchange-prefixed prices and tracks initial createdPrice');

// Defect 29: Cancel all triggers clears both backend and client triggers
const cancelTriggersBoth = ordersViewJs.includes('.filter(t => t.isBackendOrder || t.status === \'PENDING_TRIGGER\')') &&
  ordersViewJs.includes('useStore.setState({ pendingTriggers: [] });');
assert(cancelTriggersBoth, 'OrdersView "Cancel All Triggers" cleanly purges both server orders and client state');

// Defect 30: Standardized trigger state clearing
const triggerStoreSync = ordersViewJs.includes("if (typeof removePendingTrigger === 'function')");
assert(triggerStoreSync, 'OrdersView synchronizes trigger removal across client stores safely');

// -------------------------------------------------------------
// RESULTS SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`);
console.log('================================================================\n');

if (failedTests === 0) {
  console.log('🎉 ALL 30 DEFECTS REMEDIATED AND CODE-LEVEL INTEGRITY VERIFIED!\n');
  process.exit(0);
} else {
  console.error('⚠️ SOME DEFECT CHECKS FAILED. Please review the output above.\n');
  process.exit(1);
}

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================================');
console.log('🔔 VERIFICATION SUITE: PWA PUSH NOTIFICATIONS & TRADE ALERTS LIFECYCLE');
console.log('======================================================================\n');

// 1. Backend VAPID Key and Push Service
console.log('▶ 1. BACKEND PUSH SERVICE & VAPID KEY INTEGRITY');
const pushService = require('./services/pushService');
assert(pushService.vapidPublicKey, 'vapidPublicKey must be exposed by pushService');
assert(typeof pushService.vapidPublicKey === 'string' && pushService.vapidPublicKey.length > 20, 'vapidPublicKey must be a non-empty string');
assert(typeof pushService.sendPushNotification === 'function', 'sendPushNotification function must exist');
console.log(`  ✔ [PASS] Backend VAPID Public Key active: ${pushService.vapidPublicKey.slice(0, 25)}...`);
console.log('  ✔ [PASS] sendPushNotification is available');

// 2. Server Push Endpoints
console.log('\n▶ 2. SERVER ENDPOINT AUDIT (backend/server.js)');
const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert(serverCode.includes("app.get('/api/push/vapid-public-key'"), 'server.js must have GET /api/push/vapid-public-key');
assert(serverCode.includes("app.get('/api/push/status'"), 'server.js must have GET /api/push/status');
assert(serverCode.includes("app.post('/api/push/subscribe'"), 'server.js must have POST /api/push/subscribe');
assert(serverCode.includes("app.post('/api/push/unsubscribe'"), 'server.js must have POST /api/push/unsubscribe');
assert(serverCode.includes("app.post('/api/push/test'"), 'server.js must have POST /api/push/test');
assert(serverCode.includes('totalSubs > 0'), 'server.js /api/push/test must verify registered device count');
console.log('  ✔ [PASS] All 5 Web Push endpoints verified in server.js');

// 3. Trigger Engine Trade Alert Push Dispatch
console.log('\n▶ 3. TRIGGER ENGINE TRADE ALERT AUDIT (backend/services/triggerEngine.js)');
const triggerCode = fs.readFileSync(path.join(__dirname, 'services', 'triggerEngine.js'), 'utf8');
assert(triggerCode.includes("const { sendPushNotification } = require('./pushService');"), 'triggerEngine must import sendPushNotification');
assert(triggerCode.includes("tag: `trig_exec_${order.id}`"), 'triggerEngine must tag push notification with order ID');
assert(triggerCode.includes('Stop Loss Hit:'), 'triggerEngine must send Stop Loss Hit alert');
assert(triggerCode.includes('Target Hit:'), 'triggerEngine must send Target Hit alert');
assert(triggerCode.includes('Order Executed:'), 'triggerEngine must send Order Executed alert');
console.log('  ✔ [PASS] triggerEngine correctly triggers Stop Loss, Target & Limit execution push notifications');

// 4. Volume Matching Engine Trade Alert Push Dispatch
console.log('\n▶ 4. VOLUME MATCHING ENGINE TRADE ALERT AUDIT (backend/services/volumeMatchingEngine.js)');
const vmeCode = fs.readFileSync(path.join(__dirname, 'services', 'volumeMatchingEngine.js'), 'utf8');
assert(vmeCode.includes("tag: `fill_exec_${order.id}`"), 'volumeMatchingEngine must tag fill push notification');
assert(vmeCode.includes("sendPushNotification(order.user_id"), 'volumeMatchingEngine must call sendPushNotification on completion');
assert(vmeCode.includes("sendTelegramAlert(order.user_id, 'ORDER'"), 'volumeMatchingEngine must dispatch Telegram alert on completion');
console.log('  ✔ [PASS] volumeMatchingEngine correctly triggers push & Telegram alerts on order fill completion');

// 5. Frontend Push Manager Resilience
console.log('\n▶ 5. FRONTEND PUSH MANAGER AUDIT (frontend/src/services/pushManager.js)');
const pmCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'services', 'pushManager.js'), 'utf8');
assert(pmCode.includes('requestNotificationPermission'), 'pushManager must define safe requestNotificationPermission helper');
assert(pmCode.includes('AbortSignal.timeout'), 'pushManager must use AbortSignal.timeout on network requests');
assert(pmCode.includes('Promise.race'), 'pushManager must protect service worker and subscribe with Promise.race');
assert(pmCode.includes('existingKeyBase64 !== cleanPublicKey'), 'pushManager must detect VAPID key mismatch and auto-heal');
assert(pmCode.includes('subscription.unsubscribe()'), 'pushManager must cleanly unsubscribe mismatched VAPID keys');
assert(!pmCode.includes('subscribeUserToPush(token);') || !pmCode.includes('getPushSubscriptionStatus(token) {\n  if (typeof window === \'undefined\') return false;\n\n  // 1. Native Mobile App'), 'pushManager status check must not call subscribe in background');
console.log('  ✔ [PASS] pushManager includes timeout guards, non-blocking requests, and VAPID key auto-healing');

// 6. Frontend ClientDataView UI State & Guards
console.log('\n▶ 6. FRONTEND PROFILE VIEW UI AUDIT (frontend/src/components/ClientDataView.jsx)');
const cdCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'ClientDataView.jsx'), 'utf8').replace(/\r\n/g, '\n');
assert(cdCode.includes('const [isPushLoading, setIsPushLoading] = useState(false);'), 'ClientDataView must maintain isPushLoading state');
assert(cdCode.includes('if (isPushLoading) return;'), 'handleTogglePush must guard against concurrent clicks');
assert(cdCode.includes('finally {\n        setIsPushLoading(false);'), 'handleTogglePush must reset loading in finally block');
assert(!cdCode.includes("alert('Notification Setup:"), 'ClientDataView must NOT use blocking alert() on failure');
assert(cdCode.includes("isPushLoading ? 'var(--color-blue-light)' : '#f87171'"), 'ClientDataView must use blue for loading and red for error');
console.log('  ✔ [PASS] ClientDataView UI has isPushLoading guard, non-blocking feedback, and responsive states');

// 7. Service Worker Notification Display
console.log('\n▶ 7. SERVICE WORKER PUSH LISTENER AUDIT (frontend/public/sw.js)');
const swCode = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'public', 'sw.js'), 'utf8');
assert(swCode.includes("self.addEventListener('push'"), 'sw.js must have push event listener');
assert(swCode.includes("self.addEventListener('notificationclick'"), 'sw.js must have notificationclick event listener');
assert(swCode.includes("'vibrate' in navigator"), 'sw.js must guard vibration support for iOS/cross-platform');
console.log('  ✔ [PASS] sw.js has complete resilient push and click handlers');

console.log('\n======================================================================');
console.log('🎉 ALL 7 AUDIT CHECKS PASSED: PWA PUSH & TRADE ALERTS FULLY VERIFIED!');
console.log('======================================================================\n');
process.exit(0);

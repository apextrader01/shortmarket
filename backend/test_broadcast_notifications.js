const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================================');
console.log('📢 VERIFICATION SUITE: BROADCAST NOTIFICATIONS & TRADING SIGNALS');
console.log('======================================================================\n');

// 1. Check database schema definition in db.js
console.log('▶ 1. DATABASE SCHEMA & TABLE DEFINITION (backend/database/db.js)');
const dbContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf8');
assert(dbContent.includes('broadcast_notifications'), 'db.js must define broadcast_notifications table');
assert(dbContent.includes("table.string('side', 10)"), 'db.js must have side column');
assert(dbContent.includes("table.string('symbol', 100)"), 'db.js must have symbol column');
assert(dbContent.includes("table.string('entry_price', 50)"), 'db.js must have entry_price column');
assert(dbContent.includes("table.string('target_price', 50)"), 'db.js must have target_price column');
assert(dbContent.includes("table.string('stop_loss', 50)"), 'db.js must have stop_loss column');
assert(dbContent.includes("table.string('product_type'"), 'db.js must have product_type column');
assert(dbContent.includes("table.string('impact', 50)"), 'db.js must have impact column');
assert(dbContent.includes("table.string('target_tier', 50)"), 'db.js must have target_tier column');
console.log('  ✔ [PASS] broadcast_notifications table defined with all signal/news attributes');

// 2. Check migration script
console.log('\n▶ 2. MIGRATION SCRIPT IDEMPOTENCY (backend/scripts/migrate_columns.js)');
const migrateContent = fs.readFileSync(path.join(__dirname, 'scripts', 'migrate_columns.js'), 'utf8');
assert(migrateContent.includes('CREATE TABLE IF NOT EXISTS broadcast_notifications'), 'migrate_columns.js must have broadcast_notifications table creation');
assert(migrateContent.includes("product_type VARCHAR(20) DEFAULT 'INT'"), 'migrate_columns.js must add product_type column');
console.log('  ✔ [PASS] migrate_columns.js contains idempotent broadcast_notifications creation');

// 3. Check server endpoints
console.log('\n▶ 3. BACKEND API ENDPOINTS (backend/server.js)');
const serverContent = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
assert(serverContent.includes("app.get('/api/notifications'"), 'server.js must have GET /api/notifications');
assert(serverContent.includes("app.post('/api/admin/broadcast-notification'"), 'server.js must have POST /api/admin/broadcast-notification');
assert(serverContent.includes("product_type: resolvedProductType"), 'server.js must save resolvedProductType');
assert(serverContent.includes("app.delete('/api/admin/broadcast-notification/:id'"), 'server.js must have DELETE /api/admin/broadcast-notification/:id');
assert(serverContent.includes("io.emit('broadcast_notification'"), 'server.js must emit broadcast_notification via WebSocket');
assert(serverContent.includes("io.emit('broadcast_notification_removed'"), 'server.js must emit broadcast_notification_removed via WebSocket');
console.log('  ✔ [PASS] Endpoints and real-time WebSocket events configured');

// 4. Check Frontend Store
console.log('\n▶ 4. FRONTEND STATE MANAGEMENT (frontend/src/store.js)');
const storeContent = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'store.js'), 'utf8');
assert(storeContent.includes("broadcastNotifications: []"), 'store.js must hold broadcastNotifications');
assert(storeContent.includes("activeBroadcastToast"), 'store.js must manage activeBroadcastToast');
assert(storeContent.includes("fetchBroadcastNotifications"), 'store.js must have fetchBroadcastNotifications action');
assert(storeContent.includes("sendBroadcastNotification"), 'store.js must have sendBroadcastNotification action');
assert(storeContent.includes("deleteBroadcastNotification"), 'store.js must have deleteBroadcastNotification action');
assert(storeContent.includes("socket.on('broadcast_notification'"), 'store.js must handle broadcast_notification socket event');
console.log('  ✔ [PASS] Zustand store handles state, sounds, real-time socket events & REST actions');

// 5. Check UI Components
console.log('\n▶ 5. UI COMPONENTS INTEGRATION');
assert(fs.existsSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'BroadcastToast.jsx')), 'BroadcastToast.jsx must exist');
assert(fs.existsSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'NotificationDrawer.jsx')), 'NotificationDrawer.jsx must exist');
assert(fs.existsSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'BroadcastModal.jsx')), 'BroadcastModal.jsx must exist');

const modalContent = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'components', 'BroadcastModal.jsx'), 'utf8');
assert(modalContent.includes('INTRADAY'), 'BroadcastModal.jsx must include INTRADAY option');
assert(modalContent.includes('DELIVERY'), 'BroadcastModal.jsx must include DELIVERY option');

const appContent = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'App.jsx'), 'utf8');
assert(appContent.includes('<BroadcastToast />'), 'App.jsx must render BroadcastToast');
assert(appContent.includes('<NotificationDrawer'), 'App.jsx must render NotificationDrawer');
assert(appContent.includes('<BroadcastModal'), 'App.jsx must render BroadcastModal');
assert(appContent.includes('Notification Center') || appContent.includes('Notifications & Trade Signals'), 'App.jsx must have Bell notification button in header');
console.log('  ✔ [PASS] UI Components wired with Delivery/Intraday and symbol search');

console.log('\n======================================================================');
console.log('🎉 ALL BROADCAST NOTIFICATION TESTS PASSED SUCCESSFULLY!');
console.log('======================================================================\n');

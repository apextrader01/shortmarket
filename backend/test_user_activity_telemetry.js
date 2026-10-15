// Verification test for User Activity & API Telemetry Inspector
const assert = require('assert');
const telemetry = require('./middleware/telemetry');

console.log('======================================================================');
console.log('🔬 VERIFICATION: USER ACTIVITY & API TELEMETRY INSPECTOR');
console.log('======================================================================\n');

// 1. Verify in-memory ring buffer recording
assert(typeof telemetry.recordUserApiCallInMemory === 'function', 'recordUserApiCallInMemory must be exported');
assert(typeof telemetry.recordUserActivityInMemory === 'function', 'recordUserActivityInMemory must be exported');
assert(typeof telemetry.getUserApiLogs === 'function', 'getUserApiLogs must be exported');
assert(typeof telemetry.getUserActivityLogs === 'function', 'getUserActivityLogs must be exported');
console.log('✔ [PASS] Module 1: Telemetry helper functions properly exported');

// 2. Test recording API calls
const testUserId = 999999;
telemetry.recordUserApiCallInMemory(testUserId, {
  method: 'GET',
  path: '/api/orders',
  status: 200,
  timeMs: 14,
  bytes: 1024,
  timestamp: Date.now(),
  ip: '127.0.0.1'
});

telemetry.recordUserApiCallInMemory(testUserId, {
  method: 'POST',
  path: '/api/auth/profile',
  status: 200,
  timeMs: 22,
  bytes: 2048,
  timestamp: Date.now() + 10,
  ip: '127.0.0.1'
});

const apiLogs = telemetry.getUserApiLogs(testUserId);
assert.strictEqual(apiLogs.length, 2, 'Should have 2 API calls recorded');
assert.strictEqual(apiLogs[0].method, 'POST', 'Most recent API call should be first (unshift)');
assert.strictEqual(apiLogs[0].path, '/api/auth/profile');
console.log('✔ [PASS] Module 2: In-memory API call ring buffer records correctly');

// 3. Test recording Activity events (Clicks, Navigation)
telemetry.recordUserActivityInMemory(testUserId, {
  type: 'NAVIGATE',
  action: 'Navigated to Paper Trading tab',
  target: 'Markets',
  timestamp: Date.now(),
  url: '/markets'
});

telemetry.recordUserActivityInMemory(testUserId, {
  type: 'CLICK',
  action: 'Clicked "BUY" order button',
  target: 'OrderModal',
  timestamp: Date.now() + 15,
  url: '/markets'
});

const actLogs = telemetry.getUserActivityLogs(testUserId);
assert.strictEqual(actLogs.length, 2, 'Should have 2 activity events recorded');
assert.strictEqual(actLogs[0].type, 'CLICK', 'Most recent click action should be first');
assert.strictEqual(actLogs[1].type, 'NAVIGATE', 'First navigation action should follow');
console.log('✔ [PASS] Module 3: In-memory user activity & clickstream ring buffer records correctly');

// 4. Verify ring buffer cap at 100 items (no memory leak)
for (let i = 0; i < 150; i++) {
  telemetry.recordUserApiCallInMemory(testUserId, {
    method: 'GET',
    path: `/api/test/${i}`,
    status: 200,
    timeMs: 5,
    bytes: 100,
    timestamp: Date.now() + i
  });
}
const cappedLogs = telemetry.getUserApiLogs(testUserId);
assert.strictEqual(cappedLogs.length, 100, 'Ring buffer must strictly cap at 100 items');
console.log('✔ [PASS] Module 4: Ring buffer cap (100 items max) prevents memory exhaustion');

console.log('\n======================================================================');
console.log('🏁 ALL USER TELEMETRY VERIFICATION CHECKS PASSED (4/4)');
console.log('======================================================================\n');
process.exit(0);

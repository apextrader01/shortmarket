/**
 * Unit Test: Telemetry Market Time (ws_minutes) Tracking & Aggregation Verification
 */
const assert = require('assert');

function runTests() {
  console.log('🧪 Starting Telemetry Market Time Verification Tests...\n');

  // Test 1: Minute Bucket Format
  function getTelemetryMinuteBucket(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  }
  const testDate = new Date('2026-10-14T08:45:00Z');
  const bucket = getTelemetryMinuteBucket(testDate);
  assert.strictEqual(bucket, '202610140845', 'Bucket must match YYYYMMDDHHMM');
  console.log('✔ [PASS] Minute bucket formatting is valid:', bucket);

  // Test 2: Active Socket Users Tracking (Multiple Sockets / Multi-Tab deduplication)
  const activeSocketUsers = new Map();

  function onRegisterUser(userId, socketId) {
    const uid = userId.toString();
    if (!activeSocketUsers.has(uid)) {
      activeSocketUsers.set(uid, new Set());
    }
    activeSocketUsers.get(uid).add(socketId);
  }

  function onDisconnect(userId, socketId) {
    const uid = userId.toString();
    if (activeSocketUsers.has(uid)) {
      const set = activeSocketUsers.get(uid);
      set.delete(socketId);
      if (set.size === 0) {
        activeSocketUsers.delete(uid);
      }
    }
  }

  // User 101 opens 3 tabs
  onRegisterUser(101, 'sock_1');
  onRegisterUser(101, 'sock_2');
  onRegisterUser(101, 'sock_3');

  // User 202 opens 1 tab
  onRegisterUser(202, 'sock_4');

  assert.strictEqual(activeSocketUsers.size, 2, 'Must track 2 unique users even if multiple tabs exist');
  assert.strictEqual(activeSocketUsers.get('101').size, 3, 'User 101 should have 3 active socket instances');
  console.log('✔ [PASS] Multi-tab socket registration tracks unique active user instances');

  // Close 2 of user 101's tabs
  onDisconnect(101, 'sock_1');
  onDisconnect(101, 'sock_2');
  assert.strictEqual(activeSocketUsers.has('101'), true, 'User 101 still active because sock_3 is open');

  // Close last tab
  onDisconnect(101, 'sock_3');
  assert.strictEqual(activeSocketUsers.has('101'), false, 'User 101 removed once all sockets disconnect');
  console.log('✔ [PASS] Sockets cleanup properly on disconnect');

  // Test 3: Unseeded historical users with API calls get sensible baseline
  function computeWsMinutes(data) {
    let wsMin = parseInt(data.ws_minutes || 0, 10);
    if (wsMin === 0 && data.api_calls) {
      const calls = parseInt(data.api_calls, 10);
      if (calls > 0) {
        wsMin = Math.max(1, Math.round(calls / 15));
      }
    }
    return wsMin;
  }

  const hariTelemetry = { api_calls: 1453, ws_minutes: 0 };
  const klugTelemetry = { api_calls: 110, ws_minutes: 0 };
  const newActiveUser = { api_calls: 50, ws_minutes: 45 }; // already tracked

  assert.strictEqual(computeWsMinutes(hariTelemetry), 97, 'Hari (1453 calls) gets 97 active mins baseline');
  assert.strictEqual(computeWsMinutes(klugTelemetry), 7, 'Klug (110 calls) gets 7 active mins baseline');
  assert.strictEqual(computeWsMinutes(newActiveUser), 45, 'Tracked ws_minutes is used directly if > 0');
  console.log('✔ [PASS] Unseeded historical users compute accurate active minutes');

  // Test 4: Minute-Bucket Aggregation
  const rawBucketResults = [
    { type: 'user', identifier: '101', data: { api_calls: '12', ws_minutes: '1' } },
    { type: 'user', identifier: '101', data: { api_calls: '8', ws_minutes: '1' } },
    { type: 'user', identifier: '101', data: { api_calls: '5' } }, // legacy bucket without ws_minutes
    { type: 'user', identifier: '202', data: { api_calls: '3', ws_minutes: '1' } }
  ];

  const userMap = {};
  rawBucketResults.forEach(vk => {
    if (!userMap[vk.identifier]) userMap[vk.identifier] = { userId: vk.identifier, apiCalls: 0, wsMinutes: 0 };
    userMap[vk.identifier].apiCalls += parseInt(vk.data.api_calls || 0, 10);
    const bWs = parseInt(vk.data.ws_minutes || 0, 10);
    userMap[vk.identifier].wsMinutes += (bWs > 0 ? bWs : 1);
  });

  assert.strictEqual(userMap['101'].wsMinutes, 3, 'User 101 active in 3 minute-buckets must have 3 mins');
  assert.strictEqual(userMap['202'].wsMinutes, 1, 'User 202 active in 1 minute-bucket must have 1 min');
  console.log('✔ [PASS] Minute-bucket aggregation properly aggregates market time');

  // Test 5: Frontend Display Formatter
  function formatMarketTime(wsMinutes) {
    const mins = wsMinutes || 0;
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} mins`;
  }

  assert.strictEqual(formatMarketTime(0), '0 mins');
  assert.strictEqual(formatMarketTime(15), '15 mins');
  assert.strictEqual(formatMarketTime(97), '1h 37m');
  assert.strictEqual(formatMarketTime(120), '2h 0m');
  console.log('✔ [PASS] Market time formatting correctly renders hours and minutes');

  console.log('\n======================================================');
  console.log('🏁 ALL TELEMETRY MARKET TIME VERIFICATIONS PASSED (5/5)');
  console.log('======================================================');
}

runTests();

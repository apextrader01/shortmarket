// backend/test_forensic_audit_fixes.js
// Master automated verification test suite for all forensic audit fixes

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n======================================================================');
console.log('🔬 FORENSIC AUDIT VERIFICATION TEST SUITE');
console.log('======================================================================\n');

// ─── TEST 1: primaryMarketsService qty reassignment fix ───
console.log('▶ TEST 1: primaryMarketsService CSV parse safety');
const pmsPath = path.join(__dirname, 'services/primaryMarketsService.js');
const pmsContent = fs.readFileSync(pmsPath, 'utf8');

assert.ok(
  pmsContent.includes('let qty = parseInt(cols[5].replace(/,/g, \'\'), 10) || 0;'),
  'primaryMarketsService must use let qty on line 651 so bulk.csv valueCr < 10 does not throw assignment to constant'
);
assert.ok(
  !pmsContent.includes('const qty = parseInt(cols[5].replace(/,/g, \'\'), 10) || 0;'),
  'const qty must not be present on bulk.csv parsing'
);
console.log('  ✔ [PASS] let qty used consistently in bulk.csv and block.csv parsing\n');

// ─── TEST 2: middleware/telemetry flushTelemetry export & userId validation ───
console.log('▶ TEST 2: Telemetry buffer flush & user ID sanitization');
const telMiddleware = require('./middleware/telemetry');
assert.strictEqual(typeof telMiddleware.flushTelemetry, 'function', 'telemetry.flushTelemetry must be exported');

const telPath = path.join(__dirname, 'middleware/telemetry.js');
const telContent = fs.readFileSync(telPath, 'utf8');
assert.ok(
  telContent.includes("userId !== 'undefined'") && telContent.includes("userId !== 'null'"),
  'telemetry.js must guard against undefined and null string user IDs'
);
console.log('  ✔ [PASS] flushTelemetry exported and invalid string IDs guarded\n');

// ─── TEST 3: server.js telemetry flushing & ghost purge enhancements ───
console.log('▶ TEST 3: server.js telemetry admin endpoints');
const serverPath = path.join(__dirname, 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

assert.ok(
  serverContent.includes('const { flushTelemetry } = require(\'./middleware/telemetry\');') &&
  serverContent.includes('await flushTelemetry().catch(() => {});'),
  'server.js must flush telemetry before admin reads and purges'
);
assert.ok(
  serverContent.includes("uid !== 'undefined' && uid !== 'null' && uid !== 'NaN'"),
  'purge-ghosts must purge non-numeric invalid string IDs'
);
console.log('  ✔ [PASS] /api/admin/telemetry flushes buffer and cleans up non-numeric ghost IDs\n');

// ─── TEST 4: FeatureTourModal mobile responsive constraints ───
console.log('▶ TEST 4: FeatureTourModal mobile responsiveness');
const modalPath = path.join(__dirname, '../frontend/src/components/FeatureTourModal.jsx');
const modalContent = fs.readFileSync(modalPath, 'utf8');

assert.ok(
  modalContent.includes('max-height: min(92vh, 720px);'),
  'FeatureTourModal card must have max-height constraint'
);
assert.ok(
  modalContent.includes('skx-tour-body') && modalContent.includes('overflow-y: auto;'),
  'FeatureTourModal must have scrollable body'
);
assert.ok(
  modalContent.includes('skx-tour-header') && modalContent.includes('skx-tour-footer'),
  'FeatureTourModal must define non-shrinking header and footer classes'
);
console.log('  ✔ [PASS] Modal has min(92vh, 720px) height limit and overflow-y: auto body\n');

// ─── TEST 5: LandingHomeView tour auto-trigger check ───
console.log('▶ TEST 5: LandingHomeView tour completion check');
const landingPath = path.join(__dirname, '../frontend/src/components/LandingHomeView.jsx');
const landingContent = fs.readFileSync(landingPath, 'utf8');

assert.ok(
  landingContent.includes('const tourDone = localStorage.getItem(\'skandx_feature_tour_completed\') === \'true\';') &&
  landingContent.includes('if (isNewRegistration && !tourDone) return true;'),
  'LandingHomeView useState must check !tourDone for isNewRegistration'
);
console.log('  ✔ [PASS] LandingHomeView checks !tourDone before auto-triggering on registration\n');

// ─── TEST 6: TradeDiaryView compressImageToDataUrl safety ───
console.log('▶ TEST 6: TradeDiaryView screenshot compression fallback hardening');
const diaryPath = path.join(__dirname, '../frontend/src/components/TradeDiaryView.jsx');
const diaryContent = fs.readFileSync(diaryPath, 'utf8');

assert.ok(
  diaryContent.includes('img.onerror = () => resolve(\'\');'),
  'img.onerror must resolve empty string rather than leaking uncompressed base64'
);
assert.ok(
  diaryContent.includes("if (!origW || !origH) return resolve('');"),
  'zero-dimension image must resolve empty string rather than leaking uncompressed base64'
);
console.log('  ✔ [PASS] compressImageToDataUrl safely returns empty string on failure\n');

console.log('======================================================================');
console.log('🏁 ALL 6 FORENSIC AUDIT CHECKS PASSED WITH 100% SUCCESS!');
console.log('======================================================================\n');
process.exit(0);


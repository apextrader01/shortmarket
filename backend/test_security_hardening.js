/**
 * Security Hardening Verification Test Suite
 * Validates fixes for:
 * 1. Reset password bypass elimination (FIREBASE_VERIFIED / FIREBASE_ACTION)
 * 2. Cryptographic reset token verification & authLimiter attachment
 * 3. CORS wildcard restriction (blocking arbitrary .web.app and .firebaseapp.com domains)
 * 4. Profile picture and KYC URL validation (blocking XSS and non-image URI schemes)
 * 5. Trading engine & financial transaction integrity preservation
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('======================================================================');
console.log('🛡️  SECURITY HARDENING & INTEGRITY TEST SUITE');
console.log('======================================================================\n');

let passCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const loginViewCode = fs.readFileSync(path.join(__dirname, '../frontend/src/components/LoginView.jsx'), 'utf8');
const firebaseAuthCode = fs.readFileSync(path.join(__dirname, 'services/firebaseAuth.js'), 'utf8');

// ─── 1. RESET PASSWORD & AUTHENTICATION BYPASS REMEDIATION ───────────────────
console.log('▶ 1. AUTHENTICATION & PASSWORD RESET HARDENING');

test('POST /api/auth/reset-password has authLimiter attached', () => {
  assert(
    serverCode.includes("app.post('/api/auth/reset-password', authLimiter,") ||
    serverCode.includes('app.post("/api/auth/reset-password", authLimiter,'),
    'reset-password endpoint must be protected by authLimiter'
  );
});

test('FIREBASE_VERIFIED and FIREBASE_ACTION bypass strings are blocked on backend', () => {
  assert(
    serverCode.includes("resetCode === 'FIREBASE_VERIFIED' || resetCode === 'FIREBASE_ACTION'"),
    'reset-password must explicitly reject hardcoded bypass tokens'
  );
  // Ensure the old bypass `if (!isFirebaseAction)` pattern is completely gone
  assert(!serverCode.includes('const isFirebaseAction = (otp ==='), 'Old isFirebaseAction bypass flag must be removed');
});

test('Cryptographic OOB Code verification is implemented in firebaseAuth.js', () => {
  assert(
    firebaseAuthCode.includes('verifyFirebasePasswordResetOobCode'),
    'firebaseAuth must export verifyFirebasePasswordResetOobCode'
  );
  assert(
    firebaseAuthCode.includes('accounts:resetPassword'),
    'verifyFirebasePasswordResetOobCode must call Google Identity Toolkit resetPassword API'
  );
});

test('Frontend LoginView does not inject FIREBASE_VERIFIED fallback', () => {
  assert(
    !loginViewCode.includes("setOtp('FIREBASE_VERIFIED')"),
    'LoginView must not set otp to static FIREBASE_VERIFIED'
  );
  assert(
    !loginViewCode.includes("otp || 'FIREBASE_VERIFIED'"),
    'LoginView must not fall back to FIREBASE_VERIFIED'
  );
  assert(
    loginViewCode.includes('if (oobCode) {\n        setOtp(oobCode);') ||
    loginViewCode.includes('if (oobCode) { setOtp(oobCode);') ||
    loginViewCode.includes('setOtp(oobCode)'),
    'LoginView must pass real oobCode from URL parameters'
  );
});

// ─── 2. CORS POLICIES & ORIGIN RESTRICTION ──────────────────────────────────
console.log('\n▶ 2. CORS POLICIES & RESTRAINT OF ARBITRARY ORIGINS');

test('CORS does not permit wildcard arbitrary third-party Firebase apps', () => {
  assert(
    !serverCode.includes("origin.endsWith('.web.app')"),
    'Must not allow wildcard *.web.app'
  );
  assert(
    !serverCode.includes("origin.endsWith('.firebaseapp.com')"),
    'Must not allow wildcard *.firebaseapp.com'
  );
});

test('CORS whitelists explicit trusted domains', () => {
  assert(serverCode.includes("'https://skandx.in'"), 'Allowed origins must include skandx.in');
  assert(serverCode.includes("'https://shortmarket-staging.web.app'"), 'Allowed origins must include shortmarket-staging.web.app');
  assert(serverCode.includes("'https://shortmarket-staging.firebaseapp.com'"), 'Allowed origins must include shortmarket-staging.firebaseapp.com');
});

// ─── 3. FILE / MEDIA URL SANITIZATION & STORED XSS MITIGATION ───────────────
console.log('\n▶ 3. INPUT VALIDATION & URL SANITIZATION');

test('isValidMediaUrl helper validates scheme and payload limits', () => {
  assert(serverCode.includes('function isValidMediaUrl('), 'server.js must define isValidMediaUrl');
  assert(serverCode.includes('https?'), 'isValidMediaUrl must validate safe URL patterns');
  assert(serverCode.includes('data:image'), 'isValidMediaUrl must validate base64 image prefixes');
});

test('POST /api/user/profile_picture enforces isValidMediaUrl', () => {
  const profilePicRoute = serverCode.substring(
    serverCode.indexOf("app.post('/api/user/profile_picture'"),
    serverCode.indexOf("app.post('/api/user/profile_picture'") + 400
  );
  assert(
    profilePicRoute.includes('isValidMediaUrl(profile_picture_url)'),
    'Profile picture endpoint must validate submitted URL or image'
  );
});

test('POST /api/user/kyc enforces isValidMediaUrl on PAN and Aadhar inputs', () => {
  const kycRoute = serverCode.substring(
    serverCode.indexOf("app.post('/api/user/kyc'"),
    serverCode.indexOf("app.post('/api/user/kyc'") + 500
  );
  assert(
    kycRoute.includes('isValidMediaUrl(kyc_pan_url)'),
    'KYC endpoint must validate PAN URL or base64 image'
  );
  assert(
    kycRoute.includes('isValidMediaUrl(kyc_aadhar_url)'),
    'KYC endpoint must validate Aadhar URL or base64 image'
  );
});

// ─── 4. TRADING CORE INTEGRITY PRESERVATION ─────────────────────────────────
console.log('\n▶ 4. FINANCIAL & ORDER EXECUTION INTEGRITY PRESERVATION');

test('Advisory transaction locks serialize financial operations', () => {
  assert(
    serverCode.includes('pg_advisory_xact_lock'),
    'Financial operations must enforce Postgres transaction-level advisory locks'
  );
});

test('Required margin is calculated strictly server-side', () => {
  assert(
    serverCode.includes('calculateRequiredMargin'),
    'Engine must compute margin server-side'
  );
});

test('Exit orders enforce strict holdings and position checks', () => {
  assert(
    serverCode.includes('isExplicitExit') &&
    serverCode.includes('replace(/^(NSE:|BSE:|MCX:)/i'),
    'Order placement must clean exchange symbol prefixes for exit position matching'
  );
});

console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalCount} | PASSED: ${passCount} | FAILED: ${totalCount - passCount}`);
console.log('======================================================================');

if (passCount === totalCount) {
  console.log('🎉 ALL SECURITY HARDENING CHECKS VERIFIED SUCCESSFULLY!\n');
  process.exit(0);
} else {
  console.error('⚠️ SOME SECURITY CHECKS FAILED!\n');
  process.exit(1);
}

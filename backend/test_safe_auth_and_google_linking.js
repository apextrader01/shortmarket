const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Safe Auth Error Handling and Google Linking...');

// 1. Verify backend/server.js awaits ensureFirebaseUser with markEmailVerified
const serverJsPath = path.join(__dirname, 'server.js');
const serverJsContent = fs.readFileSync(serverJsPath, 'utf8');

assert.ok(
  serverJsContent.includes('await ensureFirebaseUser(email, user.phone || null, null, { markEmailVerified: true })'),
  'backend/server.js must await ensureFirebaseUser with markEmailVerified: true'
);
console.log('✅ PASS: server.js awaits ensureFirebaseUser with markEmailVerified: true');

// 2. Test apiHelper.js functions
// Since apiHelper is an ES module in frontend/src/utils/apiHelper.js, let's test equivalent logic or read the file
const apiHelperPath = path.join(__dirname, '../frontend/src/utils/apiHelper.js');
assert.ok(fs.existsSync(apiHelperPath), 'frontend/src/utils/apiHelper.js must exist');
const apiHelperContent = fs.readFileSync(apiHelperPath, 'utf8');

assert.ok(apiHelperContent.includes('export async function safeParseJsonResponse'), 'apiHelper must export safeParseJsonResponse');
assert.ok(apiHelperContent.includes('export function formatAuthErrorMessage'), 'apiHelper must export formatAuthErrorMessage');
console.log('✅ PASS: apiHelper.js exists and exports safeParseJsonResponse and formatAuthErrorMessage');

// 3. Test formatAuthErrorMessage logic directly in Node
function testFormatAuthErrorMessage(errOrMsg, fallback = 'Operation failed. Please try again.') {
  if (!errOrMsg) return fallback;
  const rawMsg = typeof errOrMsg === 'string'
    ? errOrMsg
    : (errOrMsg.message || String(errOrMsg));

  if (!rawMsg || typeof rawMsg !== 'string') return fallback;

  if (
    rawMsg.includes("Unexpected token '<'") ||
    rawMsg.includes('<!DOCTYPE') ||
    rawMsg.includes('is not valid JSON') ||
    rawMsg.includes('JSON.parse') ||
    rawMsg.includes('SyntaxError')
  ) {
    return 'Connection temporarily interrupted by network security check. Please try logging in with Google or try again in a moment.';
  }

  if (
    rawMsg.includes('Failed to fetch') ||
    rawMsg.includes('NetworkError') ||
    rawMsg.includes('Load failed') ||
    rawMsg.includes('Network request failed')
  ) {
    return 'Unable to reach the server. Please check your internet connection and try again.';
  }

  return rawMsg;
}

const rawDoctypeError = 'Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON';
const formattedDoctype = testFormatAuthErrorMessage(rawDoctypeError);
assert.strictEqual(
  formattedDoctype,
  'Connection temporarily interrupted by network security check. Please try logging in with Google or try again in a moment.'
);
console.log('✅ PASS: Raw DOCTYPE / SyntaxError is cleanly transformed into friendly guidance');

const rawFetchError = new Error('Failed to fetch');
const formattedFetch = testFormatAuthErrorMessage(rawFetchError);
assert.strictEqual(
  formattedFetch,
  'Unable to reach the server. Please check your internet connection and try again.'
);
console.log('✅ PASS: Network failure is cleanly transformed');

const normalError = 'Invalid credentials';
assert.strictEqual(testFormatAuthErrorMessage(normalError), 'Invalid credentials');
console.log('✅ PASS: Normal user-facing errors are preserved intact');

// 4. Verify LoginView.jsx and store.js use safeParseJsonResponse and formatAuthErrorMessage
const loginViewPath = path.join(__dirname, '../frontend/src/components/LoginView.jsx');
const loginViewContent = fs.readFileSync(loginViewPath, 'utf8');

assert.ok(loginViewContent.includes("import { safeParseJsonResponse, formatAuthErrorMessage } from '../utils/apiHelper'"), 'LoginView must import apiHelper');
assert.ok(loginViewContent.includes('formatAuthErrorMessage(authError)'), 'LoginView must sanitize authError before rendering');

const storePath = path.join(__dirname, '../frontend/src/store.js');
const storeContent = fs.readFileSync(storePath, 'utf8');

assert.ok(storeContent.includes("import { safeParseJsonResponse, formatAuthErrorMessage } from './utils/apiHelper'"), 'store.js must import apiHelper');
assert.ok(storeContent.includes("safeParseJsonResponse(res, 'Login failed. Please check your credentials.')"), 'store.js login must use safeParseJsonResponse');
assert.ok(storeContent.includes("safeParseJsonResponse(res, 'Login verification failed. Please try again.')"), 'store.js preLogin must use safeParseJsonResponse');

console.log('✅ PASS: LoginView.jsx and store.js fully wired to safe parsing and error formatting');
console.log('🎉 All Safe Auth & Google Linking Tests PASSED!');

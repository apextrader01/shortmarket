let admin = null;
try {
  admin = require('firebase-admin');
} catch (e) {}

/**
 * Verify Firebase Phone Authentication ID token
 * Returns decoded token { uid, phone_number, ... } if valid, or null if unconfigured
 */
async function verifyFirebasePhoneToken(idToken, submittedPhone) {
  if (!idToken) return { verified: false, reason: 'Missing verification token' };
  
  if (!admin || !admin.apps || admin.apps.length === 0) {
    // If Firebase Admin credentials are not mounted on this server, log warning and allow graceful fallback
    console.warn('[FIREBASE AUTH] Firebase admin not initialized with credentials. Bypassing server token verification.');
    return { verified: true, unverifiedFallback: true };
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded) return { verified: false, reason: 'Invalid token' };

    const tokenPhone = String(decoded.phone_number || '').replace(/\D/g, '');
    const cleanPhone = String(submittedPhone || '').replace(/\D/g, '');

    if (tokenPhone && cleanPhone && !tokenPhone.endsWith(cleanPhone) && !cleanPhone.endsWith(tokenPhone)) {
      return { verified: false, reason: 'Phone number does not match OTP token verification.' };
    }

    return { verified: true, decoded };
  } catch (err) {
    console.error('[FIREBASE AUTH] Token verification error:', err.message);
    return { verified: false, reason: err.message || 'Expired or invalid token' };
  }
}

module.exports = {
  verifyFirebasePhoneToken
};

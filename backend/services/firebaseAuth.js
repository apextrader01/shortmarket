const path = require('path');
const fs = require('fs');

let admin = null;
let authInstance = null;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBc_mR872wmE9jhfjobSHODqA5OlTHrK1I';

try {
  admin = require('firebase-admin');
  const { cert } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');

  if (admin.apps && admin.apps.length > 0) {
    authInstance = getAuth(admin.apps[0]);
  } else {
    const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
    let credential = null;

    if (fs.existsSync(serviceAccountPath)) {
      const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      credential = cert ? cert(sa) : (admin.credential?.cert ? admin.credential.cert(sa) : null);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        credential = cert ? cert(sa) : (admin.credential?.cert ? admin.credential.cert(sa) : null);
      } catch (err) {
        console.warn('[FIREBASE AUTH] Failed to parse FIREBASE_SERVICE_ACCOUNT env:', err.message);
      }
    }

    if (credential) {
      const app = admin.initializeApp({ credential });
      authInstance = getAuth(app);
      console.log('[FIREBASE AUTH] Firebase Admin SDK initialized successfully.');
    }
  }
} catch (err) {
  console.warn('[FIREBASE AUTH] firebase-admin setup note:', err.message);
}

function getFirebaseAdminAuth() {
  return authInstance;
}

/**
 * Ensure user exists in Firebase Auth.
 * If user does not exist, creates the user account in Firebase.
 */
async function ensureFirebaseUser(email, phone = null) {
  if (!email) return null;
  const cleanEmail = String(email).trim().toLowerCase();
  if (!authInstance) return null;

  try {
    const existing = await authInstance.getUserByEmail(cleanEmail);
    return existing;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      try {
        const createPayload = { email: cleanEmail };
        if (phone) {
          const cleanPhone = String(phone).replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            createPayload.phoneNumber = cleanPhone.startsWith('+') ? cleanPhone : '+91' + cleanPhone.slice(-10);
          }
        }
        const created = await authInstance.createUser(createPayload);
        console.log(`[FIREBASE AUTH] Created Firebase Auth user for ${cleanEmail}: ${created.uid}`);
        return created;
      } catch (createErr) {
        // If phone already exists on another account, create without phone
        if (createErr.code === 'auth/phone-number-already-exists') {
          const created = await authInstance.createUser({ email: cleanEmail });
          return created;
        }
        console.warn(`[FIREBASE AUTH] Could not create Firebase user for ${cleanEmail}:`, createErr.message);
        return null;
      }
    }
    console.warn(`[FIREBASE AUTH] Error finding Firebase user ${cleanEmail}:`, err.message);
    return null;
  }
}

/**
 * Send official Password Reset Email via Firebase's Mail Service
 */
async function sendFirebasePasswordReset(email) {
  if (!email) throw new Error('Email is required');
  const cleanEmail = String(email).trim().toLowerCase();

  // 1. Ensure user exists in Firebase Auth so Firebase mail service can send to them
  await ensureFirebaseUser(cleanEmail);

  // 2. Dispatch email via Firebase Identity Toolkit REST API
  // This triggers Google/Firebase's high-deliverability mail servers to send the reset email
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'PASSWORD_RESET',
      email: cleanEmail
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error('[FIREBASE AUTH] sendOobCode PASSWORD_RESET failed:', data.error);
    throw new Error(data.error.message || 'Firebase failed to dispatch password reset email');
  }

  // 3. Also generate backup reset link using Admin SDK for server logs / admin verification
  let backupLink = null;
  if (authInstance) {
    try {
      backupLink = await authInstance.generatePasswordResetLink(cleanEmail);
      console.log(`[FIREBASE AUTH] Password reset link generated for ${cleanEmail}: ${backupLink}`);
    } catch (_) {}
  }

  return {
    success: true,
    email: cleanEmail,
    backupLink
  };
}

/**
 * Synchronize newly updated password into Firebase Auth
 */
async function syncFirebaseUserPassword(email, newPassword) {
  if (!email || !newPassword || !authInstance) return false;
  const cleanEmail = String(email).trim().toLowerCase();

  try {
    const user = await ensureFirebaseUser(cleanEmail);
    if (user && user.uid) {
      await authInstance.updateUser(user.uid, { password: newPassword });
      console.log(`[FIREBASE AUTH] Password updated in Firebase Auth for ${cleanEmail}`);
      return true;
    }
  } catch (err) {
    console.warn(`[FIREBASE AUTH] Failed to sync password to Firebase for ${cleanEmail}:`, err.message);
  }
  return false;
}

/**
 * Send transactional email with OTP code using configured EmailJS REST API
 */
async function sendEmailOtpViaService(email, code) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const userId = process.env.EMAILJS_USER_ID;
  const accessToken = process.env.EMAILJS_ACCESS_TOKEN;

  if (!serviceId || !templateId || !userId || !accessToken) {
    console.warn('[TRANSACTIONAL EMAIL] Missing EmailJS env config.');
    return false;
  }

  const emailData = {
    service_id: serviceId,
    template_id: templateId,
    user_id: userId,
    accessToken: accessToken,
    template_params: {
      to_email: email,
      user_email: email,
      email: email,
      to_name: email.split('@')[0],
      name: email.split('@')[0],
      otp: code,
      otp_code: code,
      passcode: code,
      code: code,
      message: `Your SkandX verification code is: ${code}. This code is valid for 10 minutes. Do not share it with anyone.`
    }
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });
      if (res.ok) {
        console.log(`[TRANSACTIONAL EMAIL] Login OTP email successfully dispatched to ${email}`);
        return true;
      } else {
        const errText = await res.text();
        console.warn(`[TRANSACTIONAL EMAIL] EmailJS attempt ${attempt} response ${res.status}: ${errText}`);
      }
    } catch (err) {
      console.warn(`[TRANSACTIONAL EMAIL] EmailJS attempt ${attempt} error:`, err.message, err.cause?.code || '');
      if (attempt < 2) await new Promise(r => setTimeout(r, 600));
    }
  }
  return false;
}

/**
 * Send login verification email via Firebase / Transactional Service
 */
async function sendFirebaseLoginEmail(email, code = null) {
  if (!email) throw new Error('Email is required');
  const cleanEmail = String(email).trim().toLowerCase();

  // 1. Deliver the 6-digit numeric OTP directly to the user's inbox IMMEDIATELY
  let emailSent = false;
  if (code) {
    emailSent = await sendEmailOtpViaService(cleanEmail, code);
  }

  // Non-blocking user sync for Firebase
  ensureFirebaseUser(cleanEmail).catch(() => {});

  // 2. Try sending Firebase Email Sign-In link if provider is enabled
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        requestType: 'EMAIL_SIGNIN',
        email: cleanEmail,
        continueUrl: 'https://www.skandx.in/login?email=' + encodeURIComponent(cleanEmail)
      })
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (!data.error) {
      console.log(`[FIREBASE AUTH] Sign-in email link dispatched to ${cleanEmail}`);
      return { success: true, method: 'EMAIL_LINK', email: cleanEmail, code, emailSent: true };
    }
  } catch (err) {
    // Non-fatal if passwordless sign-in link is disabled
  }

  // Return code status
  return { success: true, method: 'OTP', email: cleanEmail, code, emailSent };
}

/**
 * Verify Firebase Phone Authentication ID token
 * Returns decoded token { uid, phone_number, ... } if valid, or null if unconfigured
 */
async function verifyFirebasePhoneToken(idToken, submittedPhone) {
  if (!idToken) return { verified: false, reason: 'Missing verification token' };

  if (!authInstance) {
    console.warn('[FIREBASE AUTH] Firebase admin not initialized with credentials. Bypassing server token verification.');
    return { verified: true, unverifiedFallback: true };
  }

  try {
    const decoded = await authInstance.verifyIdToken(idToken);
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
  getFirebaseAdminAuth,
  ensureFirebaseUser,
  sendFirebasePasswordReset,
  syncFirebaseUserPassword,
  sendFirebaseLoginEmail,
  sendEmailOtpViaService,
  verifyFirebasePhoneToken
};

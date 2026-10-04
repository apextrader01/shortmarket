const path = require('path');
const fs = require('fs');
try {
  const dns = require('dns');
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch (_) {}

let admin = null;
let authInstance = null;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';

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
  if (!authInstance && admin) {
    try {
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
          } catch (_) {}
        }
        if (credential) {
          const app = admin.initializeApp({ credential });
          authInstance = getAuth(app);
          console.log('[FIREBASE AUTH] Firebase Admin SDK dynamically initialized.');
        }
      }
    } catch (err) {
      console.warn('[FIREBASE AUTH] Dynamic init note:', err.message);
    }
  }
  return authInstance;
}

/**
 * Ensure user exists in Firebase Auth.
 * If user does not exist, creates the user account in Firebase.
 */
async function ensureFirebaseUser(email, phone = null, password = null) {
  if (!email) return null;
  const cleanEmail = String(email).trim().toLowerCase();
  const auth = getFirebaseAdminAuth();
  if (!auth) return null;

  try {
    const existing = await auth.getUserByEmail(cleanEmail);
    if (password) {
      await auth.updateUser(existing.uid, { password }).catch(() => {});
    }
    return existing;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      try {
        const createPayload = { email: cleanEmail };
        if (password) createPayload.password = password;
        if (phone) {
          const cleanPhone = String(phone).replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            createPayload.phoneNumber = cleanPhone.startsWith('+') ? cleanPhone : '+91' + cleanPhone.slice(-10);
          }
        }
        const created = await auth.createUser(createPayload);
        console.log(`[FIREBASE AUTH] Created Firebase Auth user for ${cleanEmail}: ${created.uid}`);
        return created;
      } catch (createErr) {
        // If phone already exists on another account, create without phone
        if (createErr.code === 'auth/phone-number-already-exists') {
          const createPayload = { email: cleanEmail };
          if (password) createPayload.password = password;
          const created = await auth.createUser(createPayload);
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
      email: cleanEmail,
      continueUrl: 'https://skandx.in'
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error('[FIREBASE AUTH] sendOobCode PASSWORD_RESET failed:', data.error);
    throw new Error(data.error.message || 'Firebase failed to dispatch password reset email');
  }

  return {
    success: true,
    email: cleanEmail
  };
}

/**
 * Send official Email Verification message via Firebase's Mail Service
 */
async function sendFirebaseVerificationEmail(email) {
  if (!email) throw new Error('Email is required');
  const cleanEmail = String(email).trim().toLowerCase();

  // 1. Ensure user exists in Firebase Auth
  const user = await ensureFirebaseUser(cleanEmail);
  if (!user || !user.uid) throw new Error('Could not create or find Firebase user for ' + cleanEmail);

  const auth = getFirebaseAdminAuth();
  if (!auth) throw new Error('Firebase Admin Auth instance not initialized');

  // 2. Mint custom token and exchange for idToken to trigger official verify email
  const customToken = await auth.createCustomToken(user.uid);
  const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const signInData = await signInRes.json();
  if (!signInData.idToken) {
    throw new Error('Failed to acquire Firebase ID token: ' + (signInData.error?.message || JSON.stringify(signInData)));
  }

  // 3. Dispatch official Firebase verification email via Google Identity Toolkit REST API
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestType: 'VERIFY_EMAIL',
      idToken: signInData.idToken,
      continueUrl: 'https://skandx.in'
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error('[FIREBASE AUTH] sendOobCode VERIFY_EMAIL failed:', data.error);
    throw new Error(data.error.message || 'Firebase failed to dispatch verification email');
  }

  console.log(`[FIREBASE AUTH] Official verification email dispatched to ${cleanEmail} via Firebase Identity Toolkit`);
  return { success: true, email: cleanEmail };
}

/**
 * Synchronize newly updated password into Firebase Auth
 */
async function syncFirebaseUserPassword(email, newPassword) {
  if (!email || !newPassword) return false;
  const auth = getFirebaseAdminAuth();
  if (!auth) return false;
  const cleanEmail = String(email).trim().toLowerCase();

  try {
    const user = await ensureFirebaseUser(cleanEmail, null, newPassword);
    if (user && user.uid) {
      await auth.updateUser(user.uid, { password: newPassword });
      console.log(`[FIREBASE AUTH] Password updated in Firebase Auth for ${cleanEmail}`);
      return true;
    }
  } catch (err) {
    console.warn(`[FIREBASE AUTH] Failed to sync password to Firebase for ${cleanEmail}:`, err.message);
  }
  return false;
}

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (_) {}

/**
 * Send branded HTML verification email via Gmail SMTP
 */
async function sendEmailOtpViaService(email, code) {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  // 1. Primary: Direct Google / Gmail SMTP (₹0, 500/day free, 100% white-labeled)
  if (nodemailer && gmailUser && gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass.replace(/\s+/g, '') // remove spaces from Google app password
        }
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0e14; color: #ffffff; padding: 40px 20px; margin: 0;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #121721; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden;">
            <tr>
              <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #1f2937;">
                <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #10b981; letter-spacing: 0.5px;">SkandX</h1>
                <p style="margin: 4px 0 0; font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px;">Algorithmic Trading Platform</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px;">
                <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #f3f4f6;">Identity Verification</h2>
                <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                  A security request was initiated for your SkandX account. Use the verification code below to complete your sign-in:
                </p>
                <div style="background-color: #0a0d14; border: 1px solid #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
                  <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #10b981; font-family: monospace;">${code}</div>
                  <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">Valid for 10 minutes &bull; Do not share with anyone</div>
                </div>
                <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: #6b7280;">
                  If you did not request this code, your credentials may be at risk. Please log in to your account and change your password immediately.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; background-color: #0d111a; border-top: 1px solid #1f2937; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #4b5563;">
                  &copy; 2026 SkandX Trading Platform. All rights reserved.<br>
                  <a href="https://skandx.in" style="color: #10b981; text-decoration: none;">https://skandx.in</a>
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"SkandX Security" <${gmailUser}>`,
        to: email,
        subject: `Your SkandX Verification Code: ${code}`,
        text: `Your SkandX verification code is: ${code}. Valid for 10 minutes.`,
        html: htmlContent
      });

      console.log(`[GMAIL SMTP] Verification OTP successfully dispatched to ${email} via ${gmailUser}`);
      return true;
    } catch (smtpErr) {
      console.warn(`[GMAIL SMTP] Failed to send via Gmail, trying fallback:`, smtpErr.message);
    }
  }

  // 2. Fallback: Log info if Gmail SMTP credentials are not yet set
  console.log(`[EMAIL DISPATCH] Gmail SMTP not configured in .env (GMAIL_USER / GMAIL_APP_PASSWORD). To deliver branded 6-digit HTML OTPs directly via Google, please set these credentials in .env.`);
  return false;
}

/**
 * Send login verification email via Firebase / Transactional Service
 */
async function sendFirebaseLoginEmail(email, code = null) {
  if (!email) throw new Error('Email is required');
  const cleanEmail = String(email).trim().toLowerCase();

  // 1. Deliver official verification/sign-in notification via Firebase
  try {
    await sendFirebaseVerificationEmail(cleanEmail);
  } catch (fbErr) {
    console.warn('[FIREBASE AUTH] sendFirebaseLoginEmail note:', fbErr.message);
  }

  // 2. Deliver branded 6-digit numeric OTP via Google/Gmail SMTP if configured
  let emailSent = false;
  if (code) {
    emailSent = await sendEmailOtpViaService(cleanEmail, code);
  }

  return { success: true, method: 'FIREBASE_AUTH', email: cleanEmail, code, emailSent };
}

/**
 * Verify Firebase Phone Authentication ID token
 * Returns decoded token { uid, phone_number, ... } if valid, or null if unconfigured
 */
async function verifyFirebasePhoneToken(idToken, submittedPhone = null, submittedEmail = null) {
  if (!idToken) return { verified: false, reason: 'Missing verification token' };

  if (!authInstance) {
    console.warn('[FIREBASE AUTH] Firebase admin not initialized with credentials. Phone token verification rejected.');
    return { verified: false, reason: 'Phone token verification unavailable. Please verify via 6-digit Email/SMS OTP.' };
  }

  try {
    const decoded = await authInstance.verifyIdToken(idToken);
    if (!decoded) return { verified: false, reason: 'Invalid token' };

    const tokenPhone = String(decoded.phone_number || '').replace(/\D/g, '');
    const cleanPhone = String(submittedPhone || '').replace(/\D/g, '');

    if (tokenPhone && cleanPhone && (tokenPhone.endsWith(cleanPhone) || cleanPhone.endsWith(tokenPhone))) {
      return { verified: true, decoded };
    }

    if (submittedEmail && decoded.email && decoded.email.toLowerCase().trim() === String(submittedEmail).toLowerCase().trim()) {
      return { verified: true, decoded };
    }

    if (!cleanPhone && decoded.uid) {
      return { verified: true, decoded };
    }

    return { verified: false, reason: 'Verification token does not match registered phone number or email.' };
  } catch (err) {
    console.error('[FIREBASE AUTH] Token verification error:', err.message);
    return { verified: false, reason: err.message || 'Expired or invalid token' };
  }
}

/**
 * Cryptographically verify Firebase Password Reset OOB Code and update password via Google Identity Toolkit
 */
async function verifyFirebasePasswordResetOobCode(oobCode, newPassword) {
  if (!oobCode || !newPassword) throw new Error('Missing reset code or new password');

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      oobCode: String(oobCode).trim(),
      newPassword: String(newPassword)
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Invalid or expired Firebase reset code');
  }
  return { success: true, email: data.email };
}

/**
 * Verify user password directly against Firebase Identity Toolkit
 * Used when a user reset their password externally via the Firebase email link
 */
async function verifyFirebasePassword(email, password) {
  if (!email || !password) return { success: false };
  try {
    const cleanEmail = String(email).trim().toLowerCase();
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        password: String(password),
        returnSecureToken: true
      })
    });
    const data = await response.json();
    if (data.idToken) {
      return { success: true, email: data.email, uid: data.localId };
    }
    return { success: false, error: data.error?.message };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Send Admin & Client notification emails for Account Deletion / DPDP Data Rights Requests
 */
async function sendDataRightsNotificationEmail({
  event = 'SUBMITTED',
  requestId,
  email,
  requestType,
  details,
  userId,
  username,
  clientIp,
  adminNotes
}) {
  let gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
  let gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  if (!gmailUser || !gmailPass) {
    try {
      const db = require('../database/db');
      const rows = await db('system_settings').whereIn('key', ['gmail_user', 'gmail_app_password']);
      for (const r of rows) {
        if (r.key === 'gmail_user' && r.value) gmailUser = r.value;
        if (r.key === 'gmail_app_password' && r.value) gmailPass = r.value;
      }
    } catch (_) {}
  }

  if (!nodemailer || !gmailUser || !gmailPass) {
    console.log(`[DATA RIGHTS EMAIL] Gmail SMTP not configured (GMAIL_USER / GMAIL_APP_PASSWORD). Request ${requestId} (${requestType}) for ${email} logged in database.`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser.trim(),
        pass: gmailPass.replace(/\s+/g, '')
      }
    });

    const isErasure = String(requestType).toUpperCase() === 'ERASURE';
    const typeLabel = isErasure ? 'Account Deletion (Right to Erasure)' : `Data Rights (${requestType})`;
    const adminRecipients = Array.from(new Set([gmailUser.trim(), process.env.ADMIN_EMAIL, 'skandx.in@gmail.com'].filter(Boolean))).join(', ');

    if (event === 'SUBMITTED') {
      // 1. Send instant alert email to Admin
      const adminHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0e14; color: #ffffff; padding: 32px 16px; margin: 0;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #121721; border-radius: 12px; border: 1px solid #ef4444; overflow: hidden;">
            <tr>
              <td style="padding: 24px 28px; background: rgba(239, 68, 68, 0.12); border-bottom: 1px solid rgba(239, 68, 68, 0.3);">
                <div style="font-size: 12px; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 1.5px;">SkandX Compliance Alert</div>
                <h2 style="margin: 6px 0 0; font-size: 20px; font-weight: 800; color: #ffffff;">${isErasure ? '🗑️ New Account Deletion Request' : `🛡️ New ${typeLabel} Request`}</h2>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px;">
                <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #0a0d14; border: 1px solid #1f2937; border-radius: 8px; font-size: 13.5px; color: #e5e7eb; margin-bottom: 20px;">
                  <tr>
                    <td style="color: #9ca3af; width: 140px;"><strong>Reference ID:</strong></td>
                    <td style="font-family: monospace; color: #10b981; font-weight: 700;">${requestId}</td>
                  </tr>
                  <tr>
                    <td style="color: #9ca3af;"><strong>Client Email:</strong></td>
                    <td><a href="mailto:${email}" style="color: #38bdf8; text-decoration: none; font-weight: 600;">${email}</a></td>
                  </tr>
                  <tr>
                    <td style="color: #9ca3af;"><strong>Request Type:</strong></td>
                    <td style="color: ${isErasure ? '#ef4444' : '#f59e0b'}; font-weight: 700;">${typeLabel}</td>
                  </tr>
                  <tr>
                    <td style="color: #9ca3af;"><strong>Matched Account:</strong></td>
                    <td>${userId ? `User ID #${userId}${username ? ` (${username})` : ''}` : 'No matching registered user found'}</td>
                  </tr>
                  <tr>
                    <td style="color: #9ca3af;"><strong>Reason / Details:</strong></td>
                    <td style="color: #f3f4f6;">${details ? String(details).replace(/</g, '&lt;') : '<em>No reason provided</em>'}</td>
                  </tr>
                  <tr>
                    <td style="color: #9ca3af;"><strong>IP Address:</strong></td>
                    <td style="font-family: monospace; color: #9ca3af;">${clientIp || 'N/A'}</td>
                  </tr>
                </table>
                <div style="text-align: center; margin-top: 24px;">
                  <a href="https://skandx.in/adminpanel" style="display: inline-block; padding: 12px 24px; background-color: #ef4444; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 8px;">
                    Open Admin Panel &rarr; Account Deletions
                  </a>
                </div>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"SkandX Compliance" <${gmailUser}>`,
        to: adminRecipients,
        replyTo: email,
        subject: `🚨 [SkandX Admin] ${isErasure ? 'Account Deletion Request' : typeLabel}: ${email} (${requestId})`,
        text: `New ${typeLabel} Request\nReference ID: ${requestId}\nClient Email: ${email}\nMatched User ID: ${userId || 'None'}\nReason/Details: ${details || 'N/A'}\nManage at: https://skandx.in/adminpanel`,
        html: adminHtml
      });

      // 2. Send acknowledgment email to the requesting client
      const clientHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0e14; color: #ffffff; padding: 32px 16px; margin: 0;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #121721; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden;">
            <tr>
              <td style="padding: 28px 28px 20px; text-align: center; border-bottom: 1px solid #1f2937;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #10b981;">SkandX</h1>
                <p style="margin: 4px 0 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px;">Privacy & Compliance Desk</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px;">
                <h2 style="margin: 0 0 12px; font-size: 18px; color: #f3f4f6;">We Have Received Your Request</h2>
                <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                  Your <strong>${typeLabel}</strong> request for <strong>${email}</strong> has been logged with our Grievance & Privacy Desk.
                </p>
                <div style="background-color: #0a0d14; border: 1px solid #10b981; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 20px;">
                  <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Tracking Reference ID</div>
                  <div style="font-size: 20px; font-weight: 800; color: #10b981; font-family: monospace; margin-top: 4px;">${requestId}</div>
                </div>
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #6b7280;">
                  Our compliance team will verify and process your request within 48 business hours. You will receive a final confirmation email once completed. If you did not submit this request, please reply to this email immediately.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"SkandX Privacy Desk" <${gmailUser}>`,
        to: email,
        replyTo: 'skandx.in@gmail.com',
        subject: `SkandX: ${isErasure ? 'Account Deletion' : 'Data Rights'} Request Received (${requestId})`,
        text: `Your ${typeLabel} request for ${email} has been received (Reference ID: ${requestId}). Our compliance team will process it within 48 business hours.`,
        html: clientHtml
      });

      return true;
    }

    if (event === 'COMPLETED' || event === 'DELETED') {
      const doneHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0e14; color: #ffffff; padding: 32px 16px; margin: 0;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #121721; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden;">
            <tr>
              <td style="padding: 28px 28px 20px; text-align: center; border-bottom: 1px solid #1f2937;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #10b981;">SkandX</h1>
                <p style="margin: 4px 0 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px;">Privacy & Compliance Desk</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px;">
                <h2 style="margin: 0 0 12px; font-size: 18px; color: #10b981;">${event === 'DELETED' ? 'Account Permanently Deleted' : 'Data Rights Request Completed'}</h2>
                <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #d1d5db;">
                  ${event === 'DELETED'
                    ? `In accordance with your erasure request (Reference: <strong>${requestId}</strong>), your SkandX account (<strong>${email}</strong>), profile credentials, and associated personal data have been permanently erased from our active systems.`
                    : `Your data rights request (Reference: <strong>${requestId}</strong>) for <strong>${email}</strong> has been resolved by our compliance team.`}
                </p>
                ${adminNotes ? `<div style="background-color: #0a0d14; border: 1px solid #1f2937; border-radius: 8px; padding: 12px 14px; font-size: 13px; color: #9ca3af; margin-bottom: 16px;"><strong>Compliance Note:</strong> ${String(adminNotes).replace(/</g, '&lt;')}</div>` : ''}
                <p style="margin: 0; font-size: 12.5px; color: #6b7280;">
                  Thank you for using SkandX. For any further privacy inquiries, contact <a href="mailto:skandx.in@gmail.com" style="color: #10b981;">skandx.in@gmail.com</a>.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"SkandX Privacy Desk" <${gmailUser}>`,
        to: email,
        replyTo: 'skandx.in@gmail.com',
        subject: `SkandX: ${event === 'DELETED' ? 'Account Deletion Completed' : 'Data Rights Request Resolved'} (${requestId})`,
        text: `${event === 'DELETED' ? 'Your SkandX account and personal data have been permanently deleted.' : 'Your SkandX data rights request has been completed.'} Reference ID: ${requestId}.`,
        html: doneHtml
      });
      return true;
    }
  } catch (err) {
    console.warn('[DATA RIGHTS EMAIL] Failed to send notification email:', err.message);
  }
  return false;
}

module.exports = {
  getFirebaseAdminAuth,
  ensureFirebaseUser,
  sendFirebasePasswordReset,
  sendFirebaseVerificationEmail,
  syncFirebaseUserPassword,
  sendFirebaseLoginEmail,
  sendEmailOtpViaService,
  sendDataRightsNotificationEmail,
  verifyFirebasePhoneToken,
  verifyFirebasePasswordResetOobCode,
  verifyFirebasePassword
};

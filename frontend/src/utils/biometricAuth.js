// frontend/src/utils/biometricAuth.js
// Client-side Biometric (Face ID / Fingerprint / WebAuthn) & 4-Digit Security PIN Engine

const PIN_STORAGE_KEY_PREFIX = 'skandx_pin_hash_';
const OLD_PIN_KEY_PREFIX = 'shortmarket_pin_hash_';

const BIOMETRIC_CRED_KEY_PREFIX = 'skandx_bio_cred_';
const OLD_BIOMETRIC_KEY_PREFIX = 'shortmarket_bio_cred_';

const LOCK_STATE_KEY = 'skandx_app_locked';
const OLD_LOCK_STATE_KEY = 'shortmarket_app_locked';
const SESSION_UNLOCKED_PREFIX = 'skandx_session_unlocked_';
const LAST_ACTIVE_PREFIX = 'skandx_last_active_';

// Base64URL helper utilities for binary WebAuthn credentials
function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBuffer(base64Url) {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Hash a 4-digit PIN with user-specific salt using browser native Web Crypto (SHA-256)
 */
export async function hashPin(pin, userId = 'default') {
  const encoder = new TextEncoder();
  const salt = `skandx_salt_${userId}_secure`;
  const data = encoder.encode(`${pin}_${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function legacyHashPin(pin, userId = 'default') {
  const encoder = new TextEncoder();
  const salt = `short_edge_salt_${userId}_secure`;
  const data = encoder.encode(`${pin}_${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Save user PIN hash locally
 */
export async function saveUserPin(pin, userId = 'default') {
  if (!pin || pin.length !== 4) throw new Error('PIN must be exactly 4 digits');
  const hashed = await hashPin(pin, userId);
  localStorage.setItem(`${PIN_STORAGE_KEY_PREFIX}${userId}`, hashed);
  try {
    sessionStorage.setItem(`${SESSION_UNLOCKED_PREFIX}${userId}`, 'true');
    localStorage.setItem(`${LAST_ACTIVE_PREFIX}${userId}`, String(Date.now()));
  } catch (e) {}
  return true;
}

/**
 * Check if PIN is configured for user
 */
export function isUserPinEnabled(userId = 'default') {
  return Boolean(
    localStorage.getItem(`${PIN_STORAGE_KEY_PREFIX}${userId}`) ||
    localStorage.getItem(`${OLD_PIN_KEY_PREFIX}${userId}`)
  );
}

/**
 * Verify entered PIN against stored hash
 */
export async function verifyUserPin(pin, userId = 'default') {
  let storedHash = localStorage.getItem(`${PIN_STORAGE_KEY_PREFIX}${userId}`);
  if (!storedHash) {
    storedHash = localStorage.getItem(`${OLD_PIN_KEY_PREFIX}${userId}`);
    if (storedHash) {
      const oldEnteredHash = await legacyHashPin(pin, userId);
      if (storedHash === oldEnteredHash) {
        // Upgrade legacy hash seamlessly to new SkandX hash
        await saveUserPin(pin, userId);
        try { localStorage.removeItem(`${OLD_PIN_KEY_PREFIX}${userId}`); } catch (e) {}
        return true;
      }
      return false;
    }
    return false;
  }
  const enteredHash = await hashPin(pin, userId);
  return storedHash === enteredHash;
}

/**
 * Remove PIN / Disable security lock
 */
export function removeUserPin(userId = 'default') {
  localStorage.removeItem(`${PIN_STORAGE_KEY_PREFIX}${userId}`);
  localStorage.removeItem(`${OLD_PIN_KEY_PREFIX}${userId}`);
  localStorage.removeItem(`${BIOMETRIC_CRED_KEY_PREFIX}${userId}`);
  localStorage.removeItem(`${OLD_BIOMETRIC_KEY_PREFIX}${userId}`);
  localStorage.removeItem(`${LAST_ACTIVE_PREFIX}${userId}`);
  sessionStorage.removeItem(LOCK_STATE_KEY);
  sessionStorage.removeItem(OLD_LOCK_STATE_KEY);
  sessionStorage.removeItem(`${SESSION_UNLOCKED_PREFIX}${userId}`);
}

/**
 * Remove Biometrics only (retaining 4-Digit PIN)
 */
export function removeBiometrics(userId = 'default') {
  localStorage.removeItem(`${BIOMETRIC_CRED_KEY_PREFIX}${userId}`);
  localStorage.removeItem(`${OLD_BIOMETRIC_KEY_PREFIX}${userId}`);
}

/**
 * Check if platform authenticator (TouchID, FaceID, Windows Hello, Fingerprint) is available
 */
export async function isBiometricsAvailable() {
  if (typeof window === 'undefined') return false;
  
  // Must be in a secure context (HTTPS or localhost)
  if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return false;
  }

  if (!window.PublicKeyCredential || !navigator.credentials) {
    return false;
  }

  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (isAvailable) return true;
    }
  } catch (e) {
    // Continue to fallback check
  }

  // Fallback: If PublicKeyCredential is supported by the browser, allow user to trigger the prompt
  return Boolean(window.PublicKeyCredential && navigator.credentials);
}

/**
 * Register Biometrics using WebAuthn Platform Authenticator
 */
export async function registerBiometrics(userId = 'default', username = 'Trader') {
  if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    throw new Error('Biometrics require a secure HTTPS connection.');
  }

  if (!window.PublicKeyCredential || !navigator.credentials) {
    throw new Error('WebAuthn biometrics is not supported by your current browser.');
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userIdBytes = new TextEncoder().encode(String(userId));

  const domain = window.location.hostname;
  const isSkandx = domain.endsWith('skandx.in');
  const rpId = isSkandx ? 'skandx.in' : domain;

  const publicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'SkandX Trading',
      ...(rpId ? { id: rpId } : {})
    },
    user: {
      id: userIdBytes,
      name: username,
      displayName: username
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256
      { alg: -257, type: 'public-key' }  // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
      requireResidentKey: false
    },
    timeout: 60000,
    attestation: 'none'
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });
    if (credential) {
      const rawIdBase64 = bufferToBase64Url(credential.rawId);
      localStorage.setItem(`${BIOMETRIC_CRED_KEY_PREFIX}${userId}`, rawIdBase64);
      return true;
    }
  } catch (err) {
    console.warn('Biometric registration error/cancelled:', err);
    if (err.name === 'NotAllowedError') {
      throw new Error('Biometric setup was cancelled or timed out.');
    } else if (err.name === 'SecurityError' || err.name === 'NotSupportedError') {
      throw new Error('Device / Domain does not allow platform passkeys on this address.');
    }
    throw new Error(err.message || 'Biometric authentication error.');
  }
  return false;
}

/**
 * Check if Biometrics is registered for this user on this browser
 */
export function isBiometricsEnabled(userId = 'default') {
  return Boolean(localStorage.getItem(`${BIOMETRIC_CRED_KEY_PREFIX}${userId}`));
}

/**
 * Verify Biometrics (Touch ID / Face ID / Windows Hello)
 */
export async function verifyBiometrics(userId = 'default') {
  if (!isBiometricsEnabled(userId)) {
    throw new Error('Biometrics not set up on this device.');
  }

  const credIdBase64 = localStorage.getItem(`${BIOMETRIC_CRED_KEY_PREFIX}${userId}`);
  if (!credIdBase64) return false;

  const credBuffer = base64UrlToBuffer(credIdBase64);
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const domain = window.location.hostname;
  const isSkandx = domain.endsWith('skandx.in');
  const rpId = isSkandx ? 'skandx.in' : domain;

  const publicKeyCredentialRequestOptions = {
    challenge,
    ...(rpId ? { rpId } : {}),
    timeout: 60000,
    userVerification: 'preferred',
    allowCredentials: [{
      id: credBuffer,
      type: 'public-key',
      transports: ['internal', 'hybrid']
    }]
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });
    return Boolean(assertion);
  } catch (err) {
    console.warn('Biometric assertion exception:', err);
    if (err.name === 'NotAllowedError') {
      throw new Error('Biometric unlock was cancelled. Please use your 4-Digit PIN.');
    }
    throw err;
  }
}

/**
 * Record user activity timestamp in localStorage
 */
export function recordUserActivity(userId = 'default') {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${LAST_ACTIVE_PREFIX}${userId}`, String(Date.now()));
  } catch (e) {}
}

export function getLastActiveTime(userId = 'default') {
  if (typeof window === 'undefined') return Date.now();
  try {
    const val = localStorage.getItem(`${LAST_ACTIVE_PREFIX}${userId}`);
    return val ? Number(val) : 0;
  } catch (e) {
    return Date.now();
  }
}

/**
 * Lock / Unlock Session Management
 */
export function isAppLocked(userId = 'default') {
  if (typeof window === 'undefined') return false;

  // If user has not enabled a PIN/biometrics, never lock
  if (!isUserPinEnabled(userId)) return false;

  // Explicit lock (e.g. Test Lock button or manual trigger)
  if (sessionStorage.getItem(LOCK_STATE_KEY) === 'true' || sessionStorage.getItem(OLD_LOCK_STATE_KEY) === 'true') {
    return true;
  }

  const lockMinutes = getAutoLockDuration(userId);

  // If Auto-Lock is completely Off (-1), only lock if explicitly locked
  if (lockMinutes === -1) {
    return false;
  }

  // If Auto-Lock is "Immediately on Background / Close" (0 minutes):
  // Any brand new tab, reopened browser, or backgrounded session that isn't unlocked MUST lock!
  if (lockMinutes === 0) {
    const isUnlocked = sessionStorage.getItem(`${SESSION_UNLOCKED_PREFIX}${userId}`) === 'true';
    return !isUnlocked;
  }

  // If timed auto-lock (e.g. 1m, 5m, 10m, 15m, 30m, 1h):
  const isUnlocked = sessionStorage.getItem(`${SESSION_UNLOCKED_PREFIX}${userId}`) === 'true';
  const lastActive = getLastActiveTime(userId);
  const limitMs = lockMinutes * 60 * 1000;

  if (lastActive > 0 && (Date.now() - lastActive) >= limitMs) {
    // Time expired! Invalidate session unlock
    sessionStorage.removeItem(`${SESSION_UNLOCKED_PREFIX}${userId}`);
    return true;
  }

  // If this is a fresh tab / reopened browser and was never unlocked in this session
  if (!isUnlocked) {
    if (lastActive === 0 || (Date.now() - lastActive) >= limitMs) {
      return true;
    }
  }

  return false;
}

export function setAppLocked(locked = true, userId = 'default') {
  if (typeof window === 'undefined') return;
  if (locked) {
    sessionStorage.setItem(LOCK_STATE_KEY, 'true');
    sessionStorage.removeItem(`${SESSION_UNLOCKED_PREFIX}${userId}`);
  } else {
    sessionStorage.removeItem(LOCK_STATE_KEY);
    sessionStorage.removeItem(OLD_LOCK_STATE_KEY);
    sessionStorage.setItem(`${SESSION_UNLOCKED_PREFIX}${userId}`, 'true');
    recordUserActivity(userId);
  }
}

const AUTO_LOCK_STORAGE_KEY_PREFIX = 'skandx_autolock_minutes_';
const OLD_AUTO_LOCK_KEY_PREFIX = 'shortmarket_autolock_minutes_';

export const AUTO_LOCK_OPTIONS = [
  { value: 0, label: '⚡ Immediately' },
  { value: 1, label: '1 Min' },
  { value: 5, label: '5 Mins' },
  { value: 10, label: '10 Mins' },
  { value: 15, label: '15 Mins' },
  { value: 30, label: '30 Mins' },
  { value: 60, label: '1 Hour' },
  { value: -1, label: 'Off' }
];

export function getAutoLockDuration(userId = 'default') {
  try {
    const val = localStorage.getItem(`${AUTO_LOCK_STORAGE_KEY_PREFIX}${userId}`) ?? localStorage.getItem(`${OLD_AUTO_LOCK_KEY_PREFIX}${userId}`);
    if (val !== null && val !== undefined) {
      return Number(val);
    }
  } catch (e) {}
  return 5; // Default 5 minutes
}

export function setAutoLockDuration(durationMinutes, userId = 'default') {
  localStorage.setItem(`${AUTO_LOCK_STORAGE_KEY_PREFIX}${userId}`, String(durationMinutes));
  window.dispatchEvent(new CustomEvent('skandx_autolock_changed', { detail: { duration: durationMinutes } }));
  window.dispatchEvent(new CustomEvent('shortmarket_autolock_changed', { detail: { duration: durationMinutes } }));
}

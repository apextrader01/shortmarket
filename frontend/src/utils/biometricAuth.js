// frontend/src/utils/biometricAuth.js
// Client-side Biometric (Face ID / Fingerprint / WebAuthn) & 4-Digit Security PIN Engine

const PIN_STORAGE_KEY_PREFIX = 'shortmarket_pin_hash_';
const BIOMETRIC_CRED_KEY_PREFIX = 'shortmarket_bio_cred_';
const LOCK_STATE_KEY = 'shortmarket_app_locked';

/**
 * Hash a 4-digit PIN with user-specific salt using browser native Web Crypto (SHA-256)
 */
export async function hashPin(pin, userId = 'default') {
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
  return true;
}

/**
 * Check if PIN is configured for user
 */
export function isUserPinEnabled(userId = 'default') {
  return Boolean(localStorage.getItem(`${PIN_STORAGE_KEY_PREFIX}${userId}`));
}

/**
 * Verify entered PIN against stored hash
 */
export async function verifyUserPin(pin, userId = 'default') {
  const storedHash = localStorage.getItem(`${PIN_STORAGE_KEY_PREFIX}${userId}`);
  if (!storedHash) return false;
  const enteredHash = await hashPin(pin, userId);
  return storedHash === enteredHash;
}

/**
 * Remove PIN / Disable security lock
 */
export function removeUserPin(userId = 'default') {
  localStorage.removeItem(`${PIN_STORAGE_KEY_PREFIX}${userId}`);
  localStorage.removeItem(`${BIOMETRIC_CRED_KEY_PREFIX}${userId}`);
  sessionStorage.removeItem(LOCK_STATE_KEY);
}

/**
 * Check if platform authenticator (TouchID, FaceID, Windows Hello, Fingerprint) is available
 */
export async function isBiometricsAvailable() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (e) {
    return false;
  }
  return false;
}

/**
 * Register Biometrics using WebAuthn Platform Authenticator
 */
export async function registerBiometrics(userId = 'default', username = 'Trader') {
  if (!(await isBiometricsAvailable())) {
    throw new Error('Biometric hardware is not supported or enabled on this device.');
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userIdBytes = new TextEncoder().encode(String(userId));

  const publicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'Short Edge Trading',
      id: window.location.hostname
    },
    user: {
      id: userIdBytes,
      name: username,
      displayName: username
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },
      { alg: -257, type: 'public-key' }
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required'
    },
    timeout: 60000,
    attestation: 'none'
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });
    if (credential) {
      localStorage.setItem(`${BIOMETRIC_CRED_KEY_PREFIX}${userId}`, credential.id);
      return true;
    }
  } catch (err) {
    console.warn('Biometric registration error/cancelled:', err);
    throw err;
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

  const credId = localStorage.getItem(`${BIOMETRIC_CRED_KEY_PREFIX}${userId}`);
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const rawCredId = new TextEncoder().encode(credId);

  const publicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    userVerification: 'required',
    allowCredentials: [{
      id: rawCredId,
      type: 'public-key',
      transports: ['internal']
    }]
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });
    return Boolean(assertion);
  } catch (err) {
    console.warn('Biometric assertion exception:', err);
    throw err;
  }
}

/**
 * Lock / Unlock Session Management
 */
export function isAppLocked() {
  return sessionStorage.getItem(LOCK_STATE_KEY) === 'true';
}

export function setAppLocked(locked = true) {
  if (locked) {
    sessionStorage.setItem(LOCK_STATE_KEY, 'true');
  } else {
    sessionStorage.removeItem(LOCK_STATE_KEY);
  }
}

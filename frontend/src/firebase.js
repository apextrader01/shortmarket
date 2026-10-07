import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// Compute auth domain dynamically:
// When served on production (*skandx.in), use first-party domain to eliminate mobile storage partitioning.
// Otherwise fallback to Firebase default domain for local dev and staging.
const getAuthDomain = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('skandx.in')) {
      return host;
    }
  }
  return import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "skandx-1020f.firebaseapp.com";
};

// Firebase configuration loaded from environment variables (.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: getAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "skandx-1020f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "skandx-1020f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "942129499307",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:942129499307:web:f53e4fe15964389c0bfbee",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-3NQ59H44ZX"
};

let app = null;
let storage = null;
let auth = null;
let analytics = null;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    storage = getStorage(app);
    auth = getAuth(app);

    if (typeof window !== 'undefined') {
      isSupported().then((supported) => {
        if (supported && app) {
          analytics = getAnalytics(app);
          window.__SKANDX_FIREBASE_ANALYTICS__ = analytics;
        }
      }).catch(() => {});
    }
  }
} catch (err) {
  console.warn('[Firebase] Client initialization skipped:', err.message);
}

export { storage, auth, analytics };

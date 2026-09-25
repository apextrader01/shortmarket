import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBc_mR872wmE9jhfjobSHODqA5OlTHrK1I",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "skandx-1020f.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "skandx-1020f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "skandx-1020f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "942129499307",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:942129499307:web:f53e4fe15964389c0bfbee",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-3NQ59H44ZX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export storage to be used in components
export const storage = getStorage(app);

export const auth = getAuth(app);

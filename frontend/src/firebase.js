import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA3MUmCRRKbiXZUc9W37wXoHa_elo2hcUI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "shortmarket-19.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "shortmarket-19",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "shortmarket-19.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "668704051976",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:668704051976:web:05cda2ce2b1b6a2bd992bd",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-SFHSJ6H4HR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export storage to be used in components
export const storage = getStorage(app);

export const auth = getAuth(app);

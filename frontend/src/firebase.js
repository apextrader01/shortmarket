import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA3MUmCRRKbiXZUc9W37wXoHa_elo2hcUI",
  authDomain: "shortmarket-19.firebaseapp.com",
  projectId: "shortmarket-19",
  storageBucket: "shortmarket-19.firebasestorage.app",
  messagingSenderId: "668704051976",
  appId: "1:668704051976:web:05cda2ce2b1b6a2bd992bd",
  measurementId: "G-SFHSJ6H4HR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export storage to be used in components
export const storage = getStorage(app);

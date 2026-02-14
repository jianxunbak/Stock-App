import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// console.log("Firebase Project ID:", firebaseConfig.projectId);
if (!firebaseConfig.apiKey) console.error("Firebase API Key is MISSING!");

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Customizing Firestore to use long polling to bypass some CORS/Access Control issues
// If the "Access Control" error persists, it might be due to browser privacy settings.
// export const db = getFirestore(app); 

// Trying initializeFirestore one more time with a simpler config
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});

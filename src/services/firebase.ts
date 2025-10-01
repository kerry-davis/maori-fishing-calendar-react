// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Check if required Firebase environment variables are available
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !import.meta.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn('Firebase environment variables not configured:', missingEnvVars);
  console.warn('Authentication features will be disabled. Please configure the following environment variables:');
  console.warn(missingEnvVars.map(envVar => `  - ${envVar}`).join('\n'));
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Google OAuth Client ID from environment variables
export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Initialize Firebase with error handling
let app: any = null;
let auth: any = null;
let storage: any = null;
let firestore: any = null;
let authInitPromise: Promise<void> | null = null;

try {
  if (missingEnvVars.length === 0) {
    // Only log verbose configuration details in development to prevent leaking info in production
    if (import.meta.env.DEV) {
      console.log('Initializing Firebase with config (dev):', {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        hasApiKey: !!firebaseConfig.apiKey
      });
    }

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    storage = getStorage(app);
    firestore = getFirestore(app);
    // Ensure persistence is configured before any authentication operations
    authInitPromise = (async () => {
      try {
        // Prefer durable local persistence; fall back gracefully where storage is restricted
        await setPersistence(auth, browserLocalPersistence);
        if (import.meta.env.DEV) console.log('Firebase Auth persistence set: browserLocalPersistence');
      } catch (e1) {
        console.warn('Failed to set browserLocalPersistence, falling back to session:', e1);
        try {
          await setPersistence(auth, browserSessionPersistence);
          if (import.meta.env.DEV) console.log('Firebase Auth persistence set: browserSessionPersistence');
        } catch (e2) {
          console.warn('Failed to set browserSessionPersistence, falling back to inMemory:', e2);
          try {
            await setPersistence(auth, inMemoryPersistence);
            if (import.meta.env.DEV) console.log('Firebase Auth persistence set: inMemoryPersistence');
          } catch (e3) {
            console.error('Failed to set any persistence for Firebase Auth:', e3);
          }
        }
      }
    })();
    if (import.meta.env.DEV) {
      console.log('Firebase initialized successfully');
    }
  } else {
    console.warn('Firebase not initialized due to missing environment variables');
    console.warn('Authentication features will be disabled until environment variables are configured');
    console.warn('Missing variables:', missingEnvVars);
  }
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  console.error('Error details:', error);
  console.warn('Please check your Firebase configuration and environment variables');
  console.warn('Authentication features will be disabled');
}

export { app, auth, storage, firestore };
export { authInitPromise };
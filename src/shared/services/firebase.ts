// Import SDKs at top level (required by ESM) and conditionally initialize below
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirestore, type Firestore } from "firebase/firestore";

// Detect test environment set by Vitest
const isTest = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.TEST;

// Check if required Firebase environment variables are available
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID'
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const missingEnvVars = requiredEnvVars.filter((envVar) => !(import.meta as any).env[envVar]);

if (!isTest && missingEnvVars.length > 0) {
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

// Initialize values (stubs by default; real instances when configured)
let appVar: FirebaseApp = {} as unknown as FirebaseApp;
// minimal auth stub used by tests and when not configured
let authVar: Auth = ({ onAuthStateChanged: () => () => {}, signOut: async () => {} } as unknown) as Auth;
let storageVar: FirebaseStorage = {} as unknown as FirebaseStorage;
let firestoreVar: Firestore = {} as unknown as Firestore;

if (!isTest) {
  try {
    if (missingEnvVars.length === 0) {
      if (import.meta.env.DEV) {
        console.log('Initializing Firebase with config (dev):', {
          projectId: firebaseConfig.projectId,
          authDomain: firebaseConfig.authDomain,
          hasApiKey: !!firebaseConfig.apiKey
        });
      }

      appVar = initializeApp(firebaseConfig);
      authVar = getAuth(appVar);
      storageVar = getStorage(appVar);
      firestoreVar = getFirestore(appVar);

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
    console.warn('Please check your Firebase configuration and environment variables');
  }
}

// Google OAuth Client ID from environment variables
export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export { appVar as app, authVar as auth, storageVar as storage, firestoreVar as firestore };
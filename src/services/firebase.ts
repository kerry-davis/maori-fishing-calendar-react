// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
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

try {
  if (missingEnvVars.length === 0) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    console.log('Firebase initialized successfully');
  } else {
    console.warn('Firebase not initialized due to missing environment variables');
  }
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
}

export { app, auth };
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAX4mfIISk8a_d0Ojxsn7d0Nu2ezeNe0dc",
  authDomain: "maori-fishing-calendar-react.firebaseapp.com",
  projectId: "maori-fishing-calendar-react",
  storageBucket: "maori-fishing-calendar-react.firebasestorage.app",
  messagingSenderId: "632377456958",
  appId: "1:632377456958:web:3ed99f837280db38ded46f",
  measurementId: "G-E2T3760RLV"
};

// Google OAuth Client ID (add this after enabling Google Sign-In in Firebase Console)
export const googleClientId = "632377456958-4caj2mns5u7b4e50s2rjj2kf2oof91k1.apps.googleusercontent.com";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
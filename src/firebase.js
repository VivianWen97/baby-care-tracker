// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBFcmBESbCk5l-3IQ0Q-DLDn5rBtGAX_50",
  authDomain: "baby-care-tracker-a1b41.firebaseapp.com",
  projectId: "baby-care-tracker-a1b41",
  databaseURL: "https://baby-care-tracker-a1b41-default-rtdb.firebaseio.com",
  storageBucket: "baby-care-tracker-a1b41.firebasestorage.app",
  messagingSenderId: "1045478324091",
  appId: "1:1045478324091:web:f6c6b33b226a48f7dd6fde",
  measurementId: "G-3VZYF1E632"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
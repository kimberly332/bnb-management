// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDcC4PJJm91gnOV0joUv_qYEqPGApa_K58",
  authDomain: "bnb-manage.firebaseapp.com",
  projectId: "bnb-manage",
  storageBucket: "bnb-manage.firebasestorage.app",
  messagingSenderId: "160688616493",
  appId: "1:160688616493:web:4956bb50b48b23f01eb4a4",
  measurementId: "G-2WT7K8ZJ8C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore Database
export const db = getFirestore(app);

// Initialize Analytics (optional)
export const analytics = getAnalytics(app);

export default app;
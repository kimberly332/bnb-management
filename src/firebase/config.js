// src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDcC4PJJm91gnOV0joUv_qYEqPGApa_K58",
  authDomain: "bnb-manage.firebaseapp.com",
  projectId: "bnb-manage",
  storageBucket: "bnb-manage.firebasestorage.app",
  messagingSenderId: "160688616493",
  appId: "1:160688616493:web:4956bb50b48b23f01eb4a4",
  measurementId: "G-2WT7K8ZJ8C"
};

// 初始化Firebase
const app = initializeApp(firebaseConfig);

// 初始化Firestore
export const db = getFirestore(app);

export default app;
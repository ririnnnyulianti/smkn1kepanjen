import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyB-BL44u3WOyuPEVseiwRI_eFNrClCw-xE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "absensi-cfb6e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "absensi-cfb6e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "absensi-cfb6e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "850847390698",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:850847390698:web:7dfd6b700ba9a71d843093",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

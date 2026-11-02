import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "yugam-c4c5f.firebaseapp.com",
  projectId: "yugam-c4c5f",
  storageBucket: "yugam-c4c5f.firebasestorage.app",
  messagingSenderId: "496047137605",
  appId: "1:496047137605:web:5f20dea2d8b3d354b4942c",
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export { auth, provider };

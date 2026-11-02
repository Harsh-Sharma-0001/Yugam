import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "yugam-cc86b.firebaseapp.com",
  projectId: "yugam-cc86b",
  storageBucket: "yugam-cc86b.firebasestorage.app",
  messagingSenderId: "160490955347",
  appId: "1:160490955347:web:70b0c1b8f8f06461879ca6"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app)

const provider = new GoogleAuthProvider()

export {auth , provider}
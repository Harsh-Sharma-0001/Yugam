import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "yugaminterviewplatform.firebaseapp.com",
  projectId: "yugaminterviewplatform",
  storageBucket: "yugaminterviewplatform.firebasestorage.app",
  messagingSenderId: "298314443648",
  appId: "1:298314443648:web:89e64b994919ae1b876f65"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export { auth, provider };

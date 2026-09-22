import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCfAZ5ktm2I-ONMQiRDkXsblFKUZ3qD0lw",
  authDomain: "tyremen-system.firebaseapp.com",
  projectId: "tyremen-system",
  storageBucket: "tyremen-system.firebasestorage.app",
  messagingSenderId: "1014637184178",
  appId: "1:1014637184178:web:448db8e949b27bb35235ab",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);


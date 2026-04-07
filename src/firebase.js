import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCppVVtBRa5BP-5bHrR5FmWEDVjTuwDJf0",
  authDomain: "discoapp-f2388.firebaseapp.com",
  projectId: "discoapp-f2388",
  storageBucket: "discoapp-f2388.firebasestorage.app",
  messagingSenderId: "787795639667",
  appId: "1:787795639667:web:048f3b8bb43e1dfa579906"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
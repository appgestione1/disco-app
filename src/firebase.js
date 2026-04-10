import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCppVVtBRa5BP-5bHrR5FmWEDVjTuwDJf0",
  authDomain: "discoapp-f2388.firebaseapp.com",
  projectId: "discoapp-f2388",
  storageBucket: "discoapp-f2388.firebasestorage.app",
  messagingSenderId: "787795639667",
  appId: "1:787795639667:web:048f3b8bb43e1dfa579906"
};

// Inizializza l'app
const app = initializeApp(firebaseConfig);

// Esporta i servizi
export const db = getFirestore(app);
export const storage = getStorage(app);
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDt8jX6BVWa2cdY66zYBlSXP_3LiV8l3QQ",
  authDomain: "billing-f186b.firebaseapp.com",
  projectId: "billing-f186b",
  storageBucket: "billing-f186b.firebasestorage.app",
  messagingSenderId: "487097927220",
  appId: "1:487097927220:web:00d8dc675cc779c7f16c61",
  measurementId: "G-YXM49VRQN0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

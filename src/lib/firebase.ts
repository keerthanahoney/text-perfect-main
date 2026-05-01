import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAODU1qOU2rN2kEzBTuaD6YHopTTPZe2Gs",
  authDomain: "textperfect-app.firebaseapp.com",
  projectId: "textperfect-app",
  storageBucket: "textperfect-app.firebasestorage.app",
  messagingSenderId: "583140528096",
  appId: "1:583140528096:web:c619cdade580a09a9ce585",
  measurementId: "G-0R5L00426L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

// Analytics is optional and can fail in some environments
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (err) {
  console.warn("Firebase Analytics could not be initialized:", err);
}
export { analytics };

// Force account selection on every login
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
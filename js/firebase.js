// =====================
// FIREBASE CONFIGURATION
// =====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA6NwRZfx0vb_IZOJsJwIPkrN6efUgXBDI",
  authDomain: "ataleofchanges-homeschool.firebaseapp.com",
  projectId: "ataleofchanges-homeschool",
  storageBucket: "ataleofchanges-homeschool.firebasestorage.app",
  messagingSenderId: "192724354270",
  appId: "1:192724354270:web:93973ba3913dbdff8b6e4f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =====================
// AUTH HELPERS
// =====================
async function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

async function sendMagicLink(email) {
  const actionCodeSettings = {
    url: window.location.origin,
    handleCodeInApp: true
  };
  return sendSignInLinkToEmail(auth, email, actionCodeSettings);
}

async function completeMagicLinkSignIn(email) {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    return signInWithEmailLink(auth, email, window.location.href);
  }
}

async function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

async function logOut() {
  return signOut(auth);
}

// =====================
// FIRESTORE HELPERS
// =====================
async function saveUserData(userId, data) {
  const ref = doc(db, 'users', userId, 'tracker', 'family');
  await setDoc(ref, data);
}

async function loadUserData(userId) {
  const ref = doc(db, 'users', userId, 'tracker', 'family');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

function subscribeToUserData(userId, callback) {
  const ref = doc(db, 'users', userId, 'tracker', 'family');
  return onSnapshot(ref, snap => {
    if (snap.exists()) callback(snap.data());
  });
}

async function saveSyncSnapshot(userId, childId, snapshot) {
  const ref = doc(db, 'users', userId, 'syncSnapshots', childId);
  await setDoc(ref, snapshot);
}

export {
  auth,
  db,
  signUp,
  signIn,
  sendMagicLink,
  completeMagicLinkSignIn,
  resetPassword,
  logOut,
  saveUserData,
  loadUserData,
  subscribeToUserData,
  onAuthStateChanged
};

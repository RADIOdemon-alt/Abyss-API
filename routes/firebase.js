// routes/firebase.js
import express from 'express';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const router = express.Router();

// Middleware للتحقق من API Key
router.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(403).json({ success: false, message: "❌ API Key غير صحيح" });
  }
  next();
});

// إعدادات Firebase من .env
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);

// توليد ID عشوائي
function generateId() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, country } = req.body;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, 'users', user.uid), {
      id: generateId(),
      name,
      phone,
      email,
      country,
      role: "user"
    });

    res.json({ success: true, message: "✅ تم التسجيل بنجاح" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    await signInWithEmailAndPassword(auth, email, password);
    res.json({ success: true, message: "✅ تم تسجيل الدخول بنجاح" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: "❌ خطأ في تسجيل الدخول" });
  }
});

export default router;

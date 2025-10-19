// routes/firebase.js
import express from 'express';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const router = express.Router();

// Middleware للتحقق من API Key ثابت
const MY_API_KEY = "drk_iARHZmYf0ODK8m3WuDmKl0K9nHSMQZ35Zkwa"; // حط هنا مفتاحك الثابت

router.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== MY_API_KEY) {
    return res.status(403).json({ success: false, message: "❌ API Key غير صحيح" });
  }
  next();
});

// إعدادات Firebase من .env
  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyAb12YNs0qOVF8dWoPJK0jG7mUG-zk-K7w",
    authDomain: "dark-api-f4ec2.firebaseapp.com",
    projectId: "dark-api-f4ec2",
    storageBucket: "dark-api-f4ec2.firebasestorage.app",
    messagingSenderId: "859798996765",
    appId: "1:859798996765:web:c80a13987f0caae69283f4",
    measurementId: "G-NHEWELXPQY"
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

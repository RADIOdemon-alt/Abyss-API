// routes/firebase.js
import express from 'express';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';

const router = express.Router();

// 🔐 API Key ثابت
const MY_API_KEY = "drk_iARHZmYf0ODK8m3WuDmKl0K9nHSMQZ35Zkwa";

router.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== MY_API_KEY) {
    return res.status(403).json({ success: false, message: "❌ API Key غير صحيح" });
  }
  next();
});

// ⚙️ إعداد Firebase
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

// 🎲 توليد ID عشوائي
function generateId() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// 🧾 تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, country } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "❌ البريد أو كلمة المرور ناقصين" });
    }

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

    res.json({ success: true, message: "✅ تم التسجيل بنجاح", uid: user.uid });
  } catch (err) {
    console.error("Register error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// 🔐 تسجيل الدخول
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "❌ البيانات ناقصة" });

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    res.json({
      success: true,
      message: "✅ تم تسجيل الدخول بنجاح",
      uid: user.uid,
      email: user.email
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(400).json({ success: false, message: "❌ خطأ في تسجيل الدخول: " + err.message });
  }
});

// 👤 التحقق من حالة المستخدم (عن طريق UID يتم تمريره)
router.get('/status/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    if (!uid) return res.status(400).json({ success: false, message: "❌ لم يتم تمرير UID" });

    const docRef = doc(db, "users", uid);
    const userSnap = await getDoc(docRef);

    if (!userSnap.exists()) {
      return res.json({ success: false, message: "❌ المستخدم غير موجود في قاعدة البيانات" });
    }

    res.json({ success: true, user: userSnap.data() });
  } catch (err) {
    console.error("Status error:", err);
    res.status(500).json({ success: false, message: "❌ خطأ في التحقق من الحالة" });
  }
});

export default router;

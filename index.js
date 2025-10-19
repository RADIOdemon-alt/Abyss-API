// index.js (Full Auto Multi-Page + API Server + Auth System)
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import compression from 'compression';
import xssClean from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

// 🧩 API Routes
import tools_tr from './routes/tools-tr.js';
import pinterest from './routes/download-pinterest.js';
import tiktok from './routes/download-tiktok.js';
import youtube from './routes/download-youtube.js';
import image_edit from './routes/image-edit.js';
import pinvid from './routes/download-pinvid.js';
import pinvid_dl from './routes/download-pinvid-dl.js';
import cat_art from './routes/Ai-cat-art.js';
import search_applemusic from './routes/search-applemusic.js';
import search_tiktok from './routes/search-tiktok.js';
import download_instagram from './routes/Instagram dl.js';
import suno_ai from './routes/suno ai.js';
import ai_music from './routes/ai-music.js';
import gemini from './routes/AI-Gemini.js';
import deepimg from './routes/Ai-deep_img.js';
import toanime from './routes/Tools-to_anime.js';
import elevenlab from './routes/elevenlab.js';
import checkporn from './routes/Tools-check_porn.js';
import codetest from './routes/Tools-code_test.js';
import anime_voice from './routes/anime-voice.js';
import videogenerate from './routes/Ai_video-generate.js';
import spotify from './routes/download_spotify.js';
import spotify_dl from './routes/Spotify_dl.js';

// 🧩 Firebase Imports (Backend Only)
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

//------------------------------------------------------
// 📍 التهيئة العامة
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

//------------------------------------------------------
// ⚙️ إعداد Body Parser و CORS
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

//------------------------------------------------------
// 🛡️ إعدادات الأمان
app.use(helmet());
app.use(compression());
app.use(xssClean());
app.use(mongoSanitize());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(slowDown({ windowMs: 15 * 60 * 1000, delayAfter: 100, delayMs: 300 }));

//------------------------------------------------------
// 🌍 السماح فقط بـ HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});

//------------------------------------------------------
// 📂 ملفات static (frontend)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { extensions: ['html', 'htm'] }));

//------------------------------------------------------
// 🧭 الصفحات
app.get('/:page?', (req, res) => {
  const page = req.params.page || 'index';
  const folderPath = path.join(publicDir, page);
  const indexPath = path.join(folderPath, 'index.html');
  const rootIndex = path.join(publicDir, 'index.html');

  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  if (page === 'index' && fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
    const files = fs.readdirSync(folderPath);
    const list = files.map(f => `<li><a href="/${page}/${f}">${f}</a></li>`).join('');
    return res.send(`<h2>📂 محتويات المجلد /${page}</h2><ul>${list}</ul>`);
  }

  return res.status(404).send('404 - الصفحة غير موجودة 🚫');
});

//------------------------------------------------------
// 🔹 كل الـ API routes
app.use('/api/tr', tools_tr);
app.use('/api/pinterest', pinterest);
app.use('/api/tiktok', tiktok);
app.use('/api/youtube', youtube);
app.use('/api/nano_banana', image_edit);
app.use('/api/pin_vid', pinvid);
app.use('/api/pinvid_dl', pinvid_dl);
app.use('/api/cat_art', cat_art);
app.use('/api/search_applemusic', search_applemusic);
app.use('/api/search_tiktok', search_tiktok);
app.use('/api/download_instagram', download_instagram);
app.use('/api/suno-ai', suno_ai);
app.use('/api/ai_music', ai_music);
app.use('/api/gemini', gemini);
app.use('/api/deep_img', deepimg);
app.use('/api/to_anime', toanime);
app.use('/api/elevenlab', elevenlab);
app.use('/api/check_porn', checkporn);
app.use('/api/code_test', codetest);
app.use('/api/anime-voice', anime_voice);
app.use('/api/video_generate', videogenerate);
app.use('/api/spotify', spotify);
app.use('/api/spotify_dl', spotify_dl);

//------------------------------------------------------
// 🔐 Firebase Auth API (Backend Only)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

function generateId() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// تسجيل مستخدم جديد
app.post('/api/register', async (req, res) => {
  const { name, phone, email, password, country } = req.body;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;
    await setDoc(doc(db, 'users', user.uid), {
      id: generateId(),
      name,
      phone,
      email,
      country,
      role: 'user',
    });
    res.json({ success: true, message: 'تم التسجيل بنجاح ✅' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    res.json({ success: true, message: 'تم تسجيل الدخول بنجاح ✅' });
  } catch (err) {
    res.status(400).json({ success: false, message: 'البريد أو كلمة السر غير صحيحة ❌' });
  }
});

//------------------------------------------------------
// 🚨 الأخطاء العامة
app.use((err, req, res, next) => {
  console.error('❌ Internal Error:', err.stack);
  res.status(500).json({ error: '🔥 Internal Server Error' });
});

//------------------------------------------------------
// 🚀 التشغيل
app.listen(port, () => {
  console.log(`✅ Server running perfectly on http://localhost:${port}`);
});

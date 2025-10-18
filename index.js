// index.js (Protected Version)
import express from 'express';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// 🧱 أمان وحماية
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import xssClean from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';
import slowDown from 'express-slow-down';

//-------------------------------------------------------
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
import spotify_dl from './routes/spotify_dl.js'; // ✅ التعديل هنا
//-------------------------------------------------------
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
//------------------------------------------------------
const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "my-secret-key";

//------------------------------------------------------
// 🛡️ إعدادات الحماية العامة
app.use(helmet());
app.use(compression());
app.use(xssClean());
app.use(mongoSanitize());

// 🕒 تحديد عدد الطلبات
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 طلب في 15 دقيقة
  message: { error: '🚫 تم تجاوز الحد المسموح من الطلبات، حاول لاحقًا' }
});
app.use('/api', limiter);

// 🐢 إبطاء الطلبات المكررة (ضد DDoS)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: 500
});
app.use('/api', speedLimiter);

// 🔑 تحقق من المفتاح السري للـ API
app.use('/api', (req, res, next) => {
  const key = req.query.key || req.headers['x-api-key'];
  if (key !== API_KEY) return res.status(401).json({ error: '🔑 Invalid API key' });
  next();
});

// 🌍 السماح فقط بالـ HTTPS (على سيرفر خارجي)
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});

//------------------------------------------------------
// 📁 مجلد الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'deny',
  index: false,
  redirect: false
}));

//------------------------------------------------------
// 🔹 الصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔹 صفحة /home (لو موجودة)
const homePagePath = path.join(__dirname, 'public', 'page', 'home', 'index.html');
if (fs.existsSync(homePagePath)) {
  app.get('/home', (req, res) => res.sendFile(homePagePath));
  console.log('✅ صفحة /home متصلة:', homePagePath);
} else {
  console.log('❌ صفحة home غير موجودة:', homePagePath);
}

//------------------------------------------------------
// 🔹 توليد تلقائي لمسارات الصفحات داخل public/page/
const pagesBase = path.join(__dirname, 'public/page');
if (fs.existsSync(pagesBase)) {
  const pageFolders = fs.readdirSync(pagesBase).filter(folder =>
    fs.statSync(path.join(pagesBase, folder)).isDirectory()
  );
  pageFolders.forEach(folder => {
    app.get(`/${folder}`, (req, res) => {
      res.sendFile(path.join(pagesBase, folder, 'index.html'));
    });
  });
}

//------------------------------------------------------
// 🔹 كل الـ API routes هنا
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
app.use('/api/spotify_dl', spotify_dl); // ✅ المسار الصحيح الجديد

//------------------------------------------------------
// 🚨 التعامل مع الأخطاء العامة
app.use((err, req, res, next) => {
  console.error('❌ Internal Error:', err.stack);
  res.status(500).json({ error: '🔥 Internal Server Error' });
});

//------------------------------------------------------
// 🚀 تشغيل السيرفر
app.listen(port, () => {
  console.log(`✅ Server running securely on port ${port}`);
});
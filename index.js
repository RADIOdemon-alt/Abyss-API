import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import xssClean from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import dotenv from 'dotenv';

// 🧩 Import API routes
import firebaseRoute from './routes/firebase.js';
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

// ⚙️ Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🛡️ حماية بسيطة بدون helmet
app.use(compression());
app.use(xssClean());
app.use(mongoSanitize());

// ⚡ Rate limit & SlowDown
app.use(rateLimit({ windowMs: 15*60*1000, max: 100 }));
app.use(slowDown({ windowMs: 15*60*1000, delayAfter: 100, delayMs: 300 }));

// 📂 ملفات static
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir)); // ✅ JS, CSS, images تعمل مباشرة

// 🔹 API routes
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
app.use('/api/firebase', firebaseRoute);

// 🧭 الصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 🧭 صفحات فرعية
app.get('/pages/:page', (req, res, next) => {
  const pagePath = path.join(publicDir, 'pages', req.params.page, 'index.html');
  if (fs.existsSync(pagePath)) return res.sendFile(pagePath);
  next();
});

// 🩸 صفحة 404
app.use((req, res) => {
  const notFoundPath = path.join(publicDir, '404.html');
  if (fs.existsSync(notFoundPath)) res.status(404).sendFile(notFoundPath);
  else res.status(404).send('404 - الصفحة غير موجودة 🚫');
});

// 🚨 Errors
app.use((err, req, res, next) => {
  console.error('❌ Internal Error:', err.stack);
  res.status(500).json({ error: '🔥 Internal Server Error' });
});

// 🚀 تشغيل السيرفر
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});

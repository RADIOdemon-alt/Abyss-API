// index.js
import express from 'express';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

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
import spotifydl from './routes/spotifydl.js'; 
//-------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
//------------------------------------------------------
const app = express();
const port = process.env.PORT || 3000;
//------------------------------------------------------
app.use(express.json());

// 🔹 استخدم مجلد public كجذر لكل الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

//------------------------------------------------------
// 🔹 الصفحة الرئيسية (تسجيل الدخول)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
app.use('/api/spotifydl', spotifydl); 

//------------------------------------------------------
// 🔹 تشغيل السيرفر
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});

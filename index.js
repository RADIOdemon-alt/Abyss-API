import express from 'express';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';
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
//------------------------------------------------------- 
const port = process.env.PORT || 3000;
//------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
//------------------------------------------------------
const app = express();
//------------------------------------------------------
app.use(express.json());
app.use(express.static(__dirname));
//------------------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
//------------------------------------------------------
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
//------------------------------------------------------
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
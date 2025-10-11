import express from 'express';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';

import tools_tr from './routes/tools-tr.js';
import pinterest from './routes/download-pinterest.js';
import tiktok from './routes/download-tiktok.js';
import youtube from './routes/download-youtube.js';
import image_edit from './routes/image-edit.js';

const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.use('/api/tr', tools_tr);
app.use('/api/pinterest', pinterest);
app.use('/api/tiktok', tiktok);
app.use('/api/youtube', youtube);
app.use('/api/image-edit', image_edit);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

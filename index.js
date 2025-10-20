// index.js (Full Auto Multi-Page + 404 Theme)
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
import dotenv from 'dotenv';

// 🧩 API Routes
import firebaseRoute from './routes/firebase.js';
import tools_tr from './routes/tools-tr.js';
import pinterest from './routes/download-pinterest.js';
import tiktok from './routes/download-tiktok.js';
import youtube from './routes/download-youtube.js';
// … ضع باقي الـ routes هنا كما في الكود الأصلي

dotenv.config(); // لازم قبل أي استخدام للـ routes

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

//------------------------------------------------------
// ⚙️ Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

//------------------------------------------------------
// 🛡️ إعدادات الأمان
app.use(helmet());
app.use(compression());
app.use(xssClean());
app.use(mongoSanitize());

//------------------------------------------------------
// ⚡ Rate Limit و SlowDown
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(slowDown({ windowMs: 15 * 60 * 1000, delayAfter: 100, delayMs: 300 }));

//------------------------------------------------------
// 🌍 HTTPS فقط (اختياري)
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});

//------------------------------------------------------
// 📂 ملفات static
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir)); // هنا كل الملفات داخل public تشتغل مباشرة

//------------------------------------------------------
// 🔹 API routes
app.use('/api/tr', tools_tr);
app.use('/api/pinterest', pinterest);
app.use('/api/tiktok', tiktok);
app.use('/api/youtube', youtube);
app.use('/api/firebase', firebaseRoute);
// … ضع باقي الـ API routes هنا كما في كودك الأصلي

//------------------------------------------------------
// 🧭 route للصفحة الرئيسية أو الصفحات الداخلية
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath);
});

// لو عندك صفحات فرعية داخل public/pages
app.get('/pages/:page', (req, res, next) => {
  const pagePath = path.join(publicDir, 'pages', req.params.page, 'index.html');
  if (fs.existsSync(pagePath)) return res.sendFile(pagePath);
  next();
});

//------------------------------------------------------
// 🩸 صفحة 404 مخصصة
app.use((req, res) => {
  const notFoundPath = path.join(publicDir, '404.html');
  if (fs.existsSync(notFoundPath)) res.status(404).sendFile(notFoundPath);
  else res.status(404).send('404 - الصفحة غير موجودة 🚫');
});

//------------------------------------------------------
// 🚨 التعامل مع الأخطاء العامة
app.use((err, req, res, next) => {
  console.error('❌ Internal Error:', err.stack);
  res.status(500).json({ error: '🔥 Internal Server Error' });
});

//------------------------------------------------------
// 🚀 تشغيل السيرفر
app.listen(port, () => {
  console.log(`✅ Server running perfectly on http://localhost:${port}`);
});

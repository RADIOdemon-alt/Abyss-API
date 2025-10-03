import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import tools_tr from './routes/tools-tr.js';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحويل JSON تلقائي
app.use(express.json());

// ملفات static
app.use(express.static(path.join(__dirname, 'public')));

// مسارات API
app.use('/api/tr', tools_tr);

// مسار الهوم بشكل صريح
app.get('/page/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'page', 'home', 'index.html'));
});

// مسار تسجيل الدخول
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// fallback لأي طلب غير API وغير محدد → login
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تشغيل السيرفر
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import tools_tr from './routes/tools-tr.js';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// لتحويل JSON تلقائي
app.use(express.json());

// تقديم الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

// مسارات API
app.use('/api/tr', tools_tr);

// صفحة تسجيل الدخول
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// صفحة الهوم
app.get('/page/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'page', 'home', 'index.html'));
});

// أي مسار تاني يرجع على طول للوجت (login)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تشغيل السيرفر
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

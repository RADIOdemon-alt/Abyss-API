import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import authRoutes from './routes/auth.js';
import tools_tr from './routes/tools_tr.js'; // تأكد من اسم الملف

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحويل JSON تلقائي
app.use(express.json());

// ملفات static
app.use(express.static(path.join(__dirname, 'public')));

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'page', 'login', 'index.html'));
});

// API
app.use('/api/auth', authRoutes);
app.use('/api/tr', tools_tr);

// تشغيل السيرفر
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

import express from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';

const router = express.Router();
const DB_DIR = path.join("./database");

// Middleware
router.use(express.json());

// تسجيل جديد
router.post('/register', async (req, res) => {
    const { name, phone, email, password, confirmPassword, terms } = req.body;
    if (!terms) return res.status(400).send("❌ يجب الموافقة على الشروط والأحكام");
    if (password !== confirmPassword) return res.status(400).send("❌ كلمة المرور وتأكيدها غير متطابقين");

    const userDir = path.join(DB_DIR, phone);
    const userFile = path.join(userDir, "database.json");

    if (fs.existsSync(userFile)) return res.status(400).send("❌ هذا الرقم مسجل بالفعل");

    fs.mkdirSync(userDir, { recursive: true });
    const hashedPassword = await bcrypt.hash(password, 12);
    const userData = { name, phone, email, password: hashedPassword, role: "user", createdAt: new Date() };
    fs.writeFileSync(userFile, JSON.stringify(userData, null, 4));

    res.send("✅ تم إنشاء الحساب بنجاح");
});

// تسجيل دخول
router.post('/login', async (req, res) => {
    const { phone, password } = req.body;
    const userFile = path.join(DB_DIR, phone, "database.json");
    if (!fs.existsSync(userFile)) return res.status(400).send("❌ المستخدم غير موجود");

    const userData = JSON.parse(fs.readFileSync(userFile, 'utf-8'));
    const match = await bcrypt.compare(password, userData.password);
    if (!match) return res.status(400).send("❌ كلمة المرور خاطئة");

    res.send("✅ تم تسجيل الدخول بنجاح");
});

export default router;

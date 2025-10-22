import express from "express";

const router = express.Router();
const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;

// 🔎 GET تحميل
router.get("/", async (req, res) => {
  const url = req.query.url;
  if (!url || !regex.test(url)) return res.status(400).json({ status: false, message: "⚠️ الرابط غير صحيح. أرسل رابط GitHub صالح." });

  try {
    const [_, user, repo] = url.match(regex);
    const zipUrl = `https://api.github.com/repos/${user}/${repo.replace(/.git$/, '')}/zipball`;
    res.json({ status: true, repo: repo.replace(/.git$/, ''), zip_url: zipUrl });
  } catch (err) {
    console.error("❌ خطأ في التحميل:", err.message);
    res.status(500).json({ status: false, message: "⚠️ حدث خطأ أثناء محاولة الحصول على رابط التحميل." });
  }
});

// 🔎 POST تحميل
router.post("/", async (req, res) => {
  const url = req.body.url;
  if (!url || !regex.test(url)) return res.status(400).json({ status: false, message: "⚠️ الرابط غير صحيح. أرسل رابط GitHub صالح." });

  try {
    const [_, user, repo] = url.match(regex);
    const zipUrl = `https://api.github.com/repos/${user}/${repo.replace(/.git$/, '')}/zipball`;
    res.json({ status: true, repo: repo.replace(/.git$/, ''), zip_url: zipUrl });
  } catch (err) {
    console.error("❌ خطأ في التحميل:", err.message);
    res.status(500).json({ status: false, message: "⚠️ حدث خطأ أثناء محاولة الحصول على رابط التحميل." });
  }
});

export default router;

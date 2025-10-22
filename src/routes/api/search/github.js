import express from "express";
import axios from "axios";

const router = express.Router();

// 🔎 البحث عن مستودعات GitHub
const searchGitHub = async (query) => {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=50`;
  const { data } = await axios.get(url);
  if (!data.items || !data.items.length) return [];
  return data.items.map(repo => ({
    name: repo.full_name,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    owner: repo.owner.login,
    html_url: repo.html_url,
    zip_url: `https://api.github.com/repos/${repo.owner.login}/${repo.name}/zipball`
  }));
};

// 🔍 GET بحث
router.get("/", async (req, res) => {
  const query = req.query.text;
  if (!query) return res.status(400).json({ status: false, message: "📌 أرسل نص البحث عن المستودع." });

  try {
    const results = await searchGitHub(query);
    if (!results.length) return res.status(404).json({ status: false, message: `❌ لم يتم العثور على نتائج لـ "${query}"` });
    res.json({ status: true, query, totalResults: results.length, repos: results, message: "✅ تم العثور على المستودعات بنجاح" });
  } catch (err) {
    console.error("❌ خطأ في البحث:", err.message);
    res.status(500).json({ status: false, message: "⚠️ حدث خطأ أثناء البحث، أعد المحاولة لاحقًا." });
  }
});

// 🔎 POST بحث
router.post("/", async (req, res) => {
  const query = req.body.text;
  if (!query) return res.status(400).json({ status: false, message: "📌 أرسل نص البحث عن المستودع." });

  try {
    const results = await searchGitHub(query);
    if (!results.length) return res.status(404).json({ status: false, message: `❌ لم يتم العثور على نتائج لـ "${query}"` });
    res.json({ status: true, query, totalResults: results.length, repos: results, message: "✅ تم العثور على المستودعات بنجاح" });
  } catch (err) {
    console.error("❌ خطأ في البحث:", err.message);
    res.status(500).json({ status: false, message: "⚠️ حدث خطأ أثناء البحث، أعد المحاولة لاحقًا." });
  }
});

export default router;

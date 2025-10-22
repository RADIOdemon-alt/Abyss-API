import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

// 🔎 دالة البحث في ويكيبيديا
const searchWikipedia = async (query) => {
  const url = `https://ar.m.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}&title=خاص:بحث&profile=advanced&fulltext=1&ns0=1`;

  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'ar,en;q=0.9'
    }
  });

  const $ = cheerio.load(res.data);
  let results = [];

  $('.mw-search-result').each((i, el) => {
    if (i < 10) {
      const title = $(el).find('.mw-search-result-heading a').text();
      const link = 'https://ar.m.wikipedia.org' + $(el).find('.mw-search-result-heading a').attr('href');
      const snippet = $(el).find('.searchresult').text().trim().slice(0, 200) + '...';

      let img = $(el).find('img').attr('src');
      if (img && !img.startsWith('http')) img = 'https:' + img;
      if (!img) img = 'https://files.catbox.moe/q75ol7.jpg'; // صورة افتراضية

      results.push({ title, link, snippet, img });
    }
  });

  return results;
};

// 🔍 GET
router.get("/", async (req, res) => {
  const query = req.query.text;
  if (!query) return res.status(400).json({ status: false, message: "📌 أرسل نص البحث." });

  try {
    const results = await searchWikipedia(query);
    if (!results.length) return res.status(404).json({ status: false, message: `❌ لم يتم العثور على نتائج لـ "${query}"` });

    res.json({ status: true, query, totalResults: results.length, results, message: "✅ تم العثور على النتائج بنجاح" });
  } catch (err) {
    console.error("❌ خطأ في البحث:", err.message);
    res.status(500).json({ status: false, message: "⚠️ حدث خطأ أثناء البحث، أعد المحاولة لاحقًا." });
  }
});

// 🔎 POST
router.post("/", async (req, res) => {
  const query = req.body.text;
  if (!query) return res.status(400).json({ status: false, message: "📌 أرسل نص البحث." });

  try {
    const results = await searchWikipedia(query);
    if (!results.length) return res.status(404).json({ status: false, message: `❌ لم يتم العثور على نتائج لـ "${query}"` });

    res.json({ status: true, query, totalResults: results.length, results, message: "✅ تم العثور على النتائج بنجاح" });
  } catch (err) {
    console.error("❌ خطأ في البحث:", err.message);
    res.status(500).json({ status: false, message: "⚠️ حدث خطأ أثناء البحث، أعد المحاولة لاحقًا." });
  }
});

export default router;

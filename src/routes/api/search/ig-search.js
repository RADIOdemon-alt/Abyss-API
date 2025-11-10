// routes/ig-search.js
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

/** 🧩 الفئة المسؤولة عن البحث في إنستغرام عبر Google */
class InstagramSearch {
  constructor() {
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; 22120RN86G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36",
      "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: "https://www.google.com/",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
  }

  /** 🔍 دالة البحث */
  async searchVideos(query) {
    if (!query) throw new Error("العبارة مطلوبة للبحث");

    const encoded = encodeURIComponent(`${query} site:instagram.com`);
    const url = `https://www.google.com/search?q=${encoded}&tbm=vid&hl=en`;

    let links = await this.scrapeLinks(url);

    // كخطة بديلة إذا لم نجد نتائج في تبويب الفيديوهات
    if (links.length === 0) {
      const fallbackUrl = `https://www.google.com/search?q=${encoded}&hl=en`;
      links = await this.scrapeLinks(fallbackUrl);
    }

    if (links.length === 0)
      throw new Error("لم يتم العثور على روابط إنستا في نتائج البحث");

    return links;
  }

  /** 🧠 استخراج الروابط من صفحة Google */
  async scrapeLinks(url) {
    try {
      const { data } = await axios.get(url, {
        headers: this.headers,
        timeout: 20000,
      });

      const $ = cheerio.load(data);
      const found = new Set();

      $("a").each((_, a) => {
        const href = $(a).attr("href") || "";

        try {
          // حالة /url?q=...
          const matchQ = href.match(/[?&](?:q|url)=([^&]+)/i);
          if (matchQ && matchQ[1]) {
            const decoded = decodeURIComponent(matchQ[1]);
            if (/https?:\/\/(www\.)?instagram\.com\//.test(decoded))
              found.add(decoded);
          }

          // حالة رابط مباشر
          if (/https?:\/\/(www\.)?instagram\.com\/[^\s"']+/i.test(href)) {
            const mLink = href.match(
              /https?:\/\/(www\.)?instagram\.com\/[^\s"']+/i
            )[0];
            found.add(mLink);
          }
        } catch {}
      });

      // تنظيف الروابط
      const cleaned = Array.from(found).map((u) => {
        try {
          const cut = u.split("&ved=")[0].split("?ig_cache_key=")[0];
          return cut;
        } catch {
          return u;
        }
      });

      return cleaned;
    } catch (err) {
      console.error("❌ خطأ أثناء الجلب:", err.message);
      return [];
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ يرجى إدخال عبارة البحث (query)" });

    const ig = new InstagramSearch();
    const results = await ig.searchVideos(query);

    res.json({
      status: true,
      message: "✅ تم العثور على نتائج",
      count: results.length,
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث في إنستغرام",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ يرجى إدخال عبارة البحث (query)" });

    const ig = new InstagramSearch();
    const results = await ig.searchVideos(query);

    res.json({
      status: true,
      message: "✅ تم العثور على نتائج",
      count: results.length,
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث في إنستغرام",
      error: err.message,
    });
  }
});

export default router;

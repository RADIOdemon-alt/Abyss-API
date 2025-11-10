// 📦 Import Dependencies
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import qs from "qs";

const router = express.Router();

/** 
 * 📸 Instagram Downloader API
 * ───────────────
 * Scraper by: Shannz
 * Structured & documented by: @noureddine_ouafy
 */
class InstagramDL {
  constructor() {
    this.apiUrl = "https://api.instasave.website/media";
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
      origin: "https://instasave.website",
      referer: "https://instasave.website/",
      "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    };
  }

  /**
   * 📥 تحميل فيديو أو صورة من إنستغرام
   * @param {string} urls - رابط منشور إنستغرام (reel, post, etc)
   * @returns {Promise<{thumbnail: string, downloadUrl: string}>}
   */
  async fetchMedia(urls) {
    try {
      const [baseUrl, paramsString] = urls.split("?");
      const params = new URLSearchParams(paramsString);
      const igsh = params.get("igsh");

      const data = qs.stringify({
        url: baseUrl,
        igsh,
        lang: "en",
      });

      const response = await axios.post(this.apiUrl, data, { headers: this.headers });
      const $ = cheerio.load(response.data);

      const thumbnail = $("img").attr("src")?.replace(/\\"/g, "");
      const downloadUrl = $("a").attr("href")?.replace(/\\"/g, "");

      if (!downloadUrl) throw new Error("لم يتم العثور على رابط التحميل");

      return { thumbnail, downloadUrl };
    } catch (err) {
      console.error("❌ Error fetching media:", err.message);
      return null;
    }
  }
}

/** 🧩 POST Route — لتحميل عبر body */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ يجب إرسال رابط Instagram" });

    const insta = new InstagramDL();
    const result = await insta.fetchMedia(url);

    if (!result)
      return res.status(500).json({ status: false, message: "❌ فشل الحصول على رابط التحميل" });

    res.json({
      status: true,
      message: "✅ تم الحصول على البيانات بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الطلب",
      error: err.message,
    });
  }
});

/** 🧩 GET Route — لتحميل عبر query */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ يجب إرسال رابط Instagram" });

    const insta = new InstagramDL();
    const result = await insta.fetchMedia(url);

    if (!result)
      return res.status(500).json({ status: false, message: "❌ فشل الحصول على رابط التحميل" });

    res.json({
      status: true,
      message: "✅ تم الحصول على البيانات بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الطلب",
      error: err.message,
    });
  }
});

export default router;export default router;

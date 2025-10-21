import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

/** 🎧 SoundCloud API Downloader */
class SoundCloudAPI {
  constructor() {
    this.baseUrl = "https://scdler.com/wp-json/aio-dl/video-data/";
    this.headers = {
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://scdler.com/ar/soundcloud-downloader/",
      Origin: "https://scdler.com",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      Accept: "application/json",
    };
  }

  async download(url) {
    if (!url || !url.includes("soundcloud.com")) {
      throw new Error("رابط SoundCloud غير صالح");
    }

    const form = new FormData();
    form.append("url", url);
    form.append("token", "");

    const response = await axios.post(this.baseUrl, form, {
      headers: { ...this.headers, ...form.getHeaders() },
    });

    const data = response.data;
    if (!data || !data.medias || data.medias.length === 0) {
      throw new Error("لم يتم العثور على ملف صوت صالح");
    }

    const media = data.medias[0];
    return {
      title: data.title || "مقطع صوتي",
      thumbnail: data.thumbnail || null,
      quality: media.quality || "صوت",
      size: media.size || "غير معروف",
      audioUrl: media.url,
    };
  }
}

/** 🧩 POST Route — تحميل صوت */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url)
      return res.status(400).json({
        status: false,
        message: "⚠️ الرابط مطلوب (url)",
      });

    const soundcloud = new SoundCloudAPI();
    const result = await soundcloud.download(url);

    res.json({
      status: true,
      message: "✅ تم جلب الصوت بنجاح من SoundCloud",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحميل الصوت من SoundCloud",
      error: err.message,
    });
  }
});

/** 🧩 GET Route — تحميل صوت عبر رابط مباشرة */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url)
      return res.status(400).json({
        status: false,
        message: "⚠️ الرابط مطلوب (url)",
      });

    const soundcloud = new SoundCloudAPI();
    const result = await soundcloud.download(url);

    res.json({
      status: true,
      message: "✅ تم جلب الصوت بنجاح من SoundCloud",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحميل الصوت من SoundCloud",
      error: err.message,
    });
  }
});

export default router;
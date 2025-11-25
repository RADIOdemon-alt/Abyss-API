import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

class SoundCloudAPI {
  constructor() {
    this.baseUrl = "https://scdler.com/wp-json/aio-dl/video-data/";
    this.headers = {
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://scdler.com/ar/soundcloud-downloader/",
      Origin: "https://scdler.com",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, مثل Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      Accept: "application/json",
    };
  }

  /** ▶ تحليل رابط SoundCloud */
  async fetchData(url) {
    const form = new FormData();
    form.append("url", url);
    form.append("token", "");

    const response = await axios.post(this.baseUrl, form, {
      headers: { ...this.headers, ...form.getHeaders() },
    });

    return response.data;
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !url.includes("soundcloud.com")) {
      return res.status(400).json({
        status: false,
        message: "⚠️ أرسل رابط صالح من SoundCloud (url)",
      });
    }

    const sc = new SoundCloudAPI();
    const data = await sc.fetchData(url);

    if (!data || !data.medias || data.medias.length === 0) {
      return res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على أي ملف صوت للتحميل",
      });
    }

    const media = data.medias[0];

    return res.json({
      status: true,
      message: "✅ تم استخراج تفاصيل الصوت بنجاح",
      result: {
        title: data.title || "مقطع صوتي",
        thumbnail: data.thumbnail || null,
        quality: media.quality || "صوت",
        size: media.size || "غير معروف",
        audioUrl: media.url,
      },
    });
  } catch (err) {
    console.error("SoundCloud API Error:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء استخراج الصوت",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url || !url.includes("soundcloud.com")) {
      return res
        .status(400)
        .json({ status: false, message: "⚠️ رابط SoundCloud مطلوب (url)" });
    }

    const sc = new SoundCloudAPI();
    const data = await sc.fetchData(url);

    if (!data || !data.medias || data.medias.length === 0) {
      return res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على ملف صوت.",
      });
    }

    const media = data.medias[0];

    res.json({
      status: true,
      message: "✅ تم استخراج تفاصيل الصوت",
      result: {
        title: data.title,
        thumbnail: data.thumbnail,
        quality: media.quality,
        size: media.size,
        audioUrl: media.url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ خطأ أثناء الاتصال بالخادم",
      error: err.message,
    });
  }
});

export default router;
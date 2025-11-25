// routes/soundcloud.js
import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

class SoundCloudAPI {
  constructor() {
    this.apiEndpoint = "https://scdler.com/wp-json/aio-dl/video-data/";
    this.pageUrl = "https://scdler.com/ar/soundcloud-downloader/";
    // UA نظيف ومقبول
    this.ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    this.defaultPageHeaders = {
      "User-Agent": this.ua,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
      Referer: this.pageUrl,
      Origin: "https://scdler.com",
    };
    this.defaultApiHeaders = {
      "User-Agent": this.ua,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
      Referer: this.pageUrl,
      Origin: "https://scdler.com",
    };
  }

  /** اجلب الكوكيز من صفحة الموقع (قد تكون مطلوبة لتجاوز بعض الحمايات) */
  async fetchPageCookies() {
    try {
      const pageRes = await axios.get(this.pageUrl, {
        headers: this.defaultPageHeaders,
        validateStatus: () => true, // نريد رؤوس حتى لو رجع 4xx
      });

      const setCookie = pageRes.headers && pageRes.headers["set-cookie"];
      if (!setCookie) return "";
      const cookieHeader = Array.isArray(setCookie)
        ? setCookie.map((c) => c.split(";")[0]).join("; ")
        : typeof setCookie === "string"
        ? setCookie.split(";")[0]
        : "";
      return cookieHeader;
    } catch (err) {
      // لا نهتم بالفشل هنا كثيرًا — نتابع بدون كوكيز
      console.error("fetchPageCookies error:", err?.message || err);
      return "";
    }
  }

  /** اطلب JSON الخاص بالـ medias من نقطة النهاية بعد بناء فورم */
  async fetchMediaInfo(soundcloudUrl) {
    const cookieHeader = await this.fetchPageCookies();

    const form = new FormData();
    form.append("url", soundcloudUrl);
    form.append("token", ""); // يبقى فارغًا عادةً كما في النسخ السابقة

    const headers = {
      ...form.getHeaders(),
      ...this.defaultApiHeaders,
    };
    if (cookieHeader) headers.Cookie = cookieHeader;

    const res = await axios.post(this.apiEndpoint, form, {
      headers,
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });

    return { status: res.status, headers: res.headers, data: res.data };
  }

  /** stream الملف الصوتي للمستعلم عبر response */
  async streamAudioToResponse(audioUrl, res) {
    // ننفذ طلب stream للـ audioUrl ونمرر الرأس والبايتات للمستخدم
    const streamRes = await axios.get(audioUrl, {
      responseType: "stream",
      headers: { "User-Agent": this.ua, Referer: "https://soundcloud.com/" },
      validateStatus: () => true,
    });

    if (streamRes.status >= 400) {
      const errMsg = `Failed to fetch audio file. status=${streamRes.status}`;
      console.error(errMsg);
      res.status(502).json({ status: false, message: "❌ فشل جلب الملف الصوتي", error: errMsg });
      return;
    }

    // تمرير الهيدر المناسب للمستخدم (Content-Type, Content-Length إن وُجد)
    const ct = streamRes.headers["content-type"] || "audio/mpeg";
    if (streamRes.headers["content-length"]) {
      res.setHeader("Content-Length", streamRes.headers["content-length"]);
    }
    res.setHeader("Content-Type", ct);
    // نقل الستريم مباشرة
    streamRes.data.pipe(res);
  }
}

/** POST / => body: { url }  — يعيد JSON بتفاصيل المقطع */
router.post("/", async (req, res) => {
  try {
    const url = (req.body && req.body.url) || "";
    if (!url || !url.includes("soundcloud.com")) {
      return res.status(400).json({
        status: false,
        message: "⚠️ أرسل رابط SoundCloud صالح في الحقل url",
      });
    }

    const sc = new SoundCloudAPI();
    const { status, data, headers } = await sc.fetchMediaInfo(url);

    if (status === 403) {
      console.error("scdler 403 headers:", headers);
      return res.status(403).json({
        status: false,
        message:
          "❌ رفض الخادم (403). الموقع قد يمنع الطلبات من السيرفرات. جرب استخدام proxy أو headless browser (puppeteer).",
      });
    }

    if (!data || typeof data !== "object" || !data.medias || data.medias.length === 0) {
      console.error("Invalid scdler response:", typeof data, data);
      return res.status(502).json({
        status: false,
        message:
          "❌ الاستجابة غير صالحة من المصدر. ربما تغيّرت واجهة الموقع أو لم يتم العثور على ملف صوت.",
        raw: data,
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
        raw: data, // اختياري للاستكشاف — يمكن حذفه لاحقًا
      },
    });
  } catch (err) {
    console.error("POST /soundcloud error:", err?.response?.status, err?.response?.data || err.message || err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء الاتصال بالخادم",
      error: err?.message || String(err),
    });
  }
});

/** GET /?url=...  => نفس وظيفة POST (مفيد للطلبات البسيطة) */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url || "";
    if (!url || !url.includes("soundcloud.com")) {
      return res.status(400).json({
        status: false,
        message: "⚠️ معلمة url المطلوبة لموقع SoundCloud",
      });
    }

    const sc = new SoundCloudAPI();
    const { status, data, headers } = await sc.fetchMediaInfo(url);

    if (status === 403) {
      console.error("scdler 403 headers:", headers);
      return res.status(403).json({
        status: false,
        message:
          "❌ رفض الخادم (403). الموقع قد يمنع الطلبات من السيرفرات. جرب استخدام proxy أو headless browser (puppeteer).",
      });
    }

    if (!data || typeof data !== "object" || !data.medias || data.medias.length === 0) {
      console.error("Invalid scdler response:", typeof data, data);
      return res.status(502).json({
        status: false,
        message:
          "❌ الاستجابة غير صالحة من المصدر. ربما تغيّرت واجهة الموقع أو لم يتم العثور على ملف صوت.",
        raw: data,
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
        raw: data,
      },
    });
  } catch (err) {
    console.error("GET /soundcloud error:", err?.response?.status, err?.response?.data || err.message || err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء الاتصال بالخادم",
      error: err?.message || String(err),
    });
  }
});

/**
 * GET /download?url=... 
 * يقوم بجلب معلومات المقطع أولاً ثم يعيد الملف كـ stream (proxy)
 * مفيد لربط البوت بحيث يطلب من سيرفرك رابط /download?url=...
 */
router.get("/download", async (req, res) => {
  try {
    const url = req.query.url || "";
    if (!url || !url.includes("soundcloud.com")) {
      return res.status(400).json({
        status: false,
        message: "⚠️ معلمة url مطلوبة لتحميل الصوت",
      });
    }

    const sc = new SoundCloudAPI();
    const { status, data, headers } = await sc.fetchMediaInfo(url);

    if (status === 403) {
      console.error("scdler 403 headers:", headers);
      return res.status(403).json({
        status: false,
        message:
          "❌ رفض الخادم (403). الموقع قد يمنع الطلبات من السيرفرات. جرب استخدام proxy أو headless browser (puppeteer).",
      });
    }

    if (!data || !data.medias || data.medias.length === 0) {
      console.error("Invalid scdler response for download:", data);
      return res.status(502).json({
        status: false,
        message: "❌ لم يتم العثور على ملف صوت للتحميل.",
        raw: data,
      });
    }

    const media = data.medias[0];
    const audioUrl = media.url;

    // نستخدم اسم ملف مناسب
    const title = (data.title || "audio").replace(/[\/\\?%*:|"<>]/g, "_") + ".mp3";
    res.setHeader("Content-Disposition", `attachment; filename="${title}"`);

    // Stream audio إلى الاستجابة
    await sc.streamAudioToResponse(audioUrl, res);
  } catch (err) {
    console.error("GET /download error:", err?.response?.status, err?.response?.data || err.message || err);
    if (!res.headersSent) {
      res.status(500).json({
        status: false,
        message: "❌ خطأ أثناء محاولة تنزيل الملف",
        error: err?.message || String(err),
      });
    } else {
      // إذا بدأ البث ثم فشل، نهايته صامتة
      console.error("Stream already sent and failed:", err);
    }
  }
});

export default router;
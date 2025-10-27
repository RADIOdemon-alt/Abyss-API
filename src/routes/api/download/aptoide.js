/**
 * 📦 Aptoide Direct APK Downloader (Fixed)
 * Description: Searches Aptoide and streams the first APK directly (real .apk, not zip)
 * Author: Anas / IZANA ⚔️
 */

import express from "express";
import axios from "axios";

const router = express.Router();

class AptoideAPI {
  constructor() {
    this.baseUrl = "https://ws75.aptoide.com/api/7";
    this.headers = {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 13; AptoideBot) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    };
  }

  /** 🔍 البحث عن أول تطبيق */
  async searchFirstApp(query) {
    const url = `${this.baseUrl}/apps/search?query=${encodeURIComponent(query)}&limit=1`;
    const res = await axios.get(url, { headers: this.headers });
    const app = res.data?.datalist?.list?.[0];
    if (!app) throw new Error("❌ لم يتم العثور على التطبيق المطلوب!");
    return app;
  }
}

/** 🧩 Route GET */
router.get("/", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query)
      return res.status(400).json({
        status: false,
        message: "⚠️ أرسل اسم التطبيق عبر ?query=",
      });

    const aptoide = new AptoideAPI();
    const app = await aptoide.searchFirstApp(query);

    const downloadUrl =
      app.file?.path ||
      app.file?.path_alt ||
      app.file?.url ||
      null;

    if (!downloadUrl)
      return res.status(404).json({
        status: false,
        message: "⚠️ لم يتم العثور على رابط تحميل مباشر",
      });

    // اسم الملف وامتداده .apk دائمًا
    const filename = `${app.name?.replace(/\s+/g, "_") || "app"}_${app.file?.vername || "latest"}.apk`;

    // إعداد الرؤوس
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Cache-Control", "no-cache");

    console.log(`📦 جاري تحميل ${filename} من ${downloadUrl}`);

    // طلب الملف بدون فك ضغط (gzip)
    const response = await axios.get(downloadUrl, {
      responseType: "stream",
      decompress: false, // 🔧 منع التحويل إلى zip/gzip
      headers: {
        "User-Agent": "Aptoide-Downloader/1.0",
        Accept: "*/*",
        Connection: "keep-alive",
      },
    });

    // بث مباشر للملف apk
    response.data.pipe(res);

    response.data.on("end", () => {
      console.log(`✅ تم إرسال ${filename} بنجاح`);
    });

    response.data.on("error", (err) => {
      console.error("❌ خطأ أثناء البث:", err.message);
      res.status(500).end("❌ فشل تحميل الملف");
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحميل التطبيق",
      error: err.message,
    });
  }
});

/** 🧩 Route POST */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query)
      return res.status(400).json({
        status: false,
        message: "⚠️ أرسل حقل 'query' داخل body",
      });

    const aptoide = new AptoideAPI();
    const app = await aptoide.searchFirstApp(query);

    const downloadUrl =
      app.file?.path ||
      app.file?.path_alt ||
      app.file?.url ||
      null;

    if (!downloadUrl)
      return res.status(404).json({
        status: false,
        message: "⚠️ لم يتم العثور على رابط تحميل مباشر",
      });

    const filename = `${app.name?.replace(/\s+/g, "_") || "app"}_${app.file?.vername || "latest"}.apk`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Cache-Control", "no-cache");

    console.log(`📦 جاري تحميل ${filename} من ${downloadUrl}`);

    const response = await axios.get(downloadUrl, {
      responseType: "stream",
      decompress: false,
      headers: {
        "User-Agent": "Aptoide-Downloader/1.0",
        Accept: "*/*",
        Connection: "keep-alive",
      },
    });

    response.data.pipe(res);

    response.data.on("end", () => {
      console.log(`✅ تم إرسال ${filename} بنجاح`);
    });

    response.data.on("error", (err) => {
      console.error("❌ خطأ أثناء البث:", err.message);
      res.status(500).end("❌ فشل تحميل الملف");
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحميل التطبيق",
      error: err.message,
    });
  }
});

export default router;
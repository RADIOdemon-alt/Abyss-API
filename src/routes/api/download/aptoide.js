/**
 * 📦 Aptoide Direct APK Downloader
 * Description: Search for an app in Aptoide and stream the first APK file directly.
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

  /** 🔍 ابحث عن أول تطبيق */
  async searchFirstApp(query) {
    const url = `${this.baseUrl}/apps/search?query=${encodeURIComponent(query)}&limit=1`;
    const res = await axios.get(url, { headers: this.headers });
    const app = res.data?.datalist?.list?.[0];
    if (!app) throw new Error("❌ لم يتم العثور على التطبيق المطلوب!");
    return app;
  }
}

/** 🧩 GET Route - تحميل مباشر */
router.get("/", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query)
      return res.status(400).json({
        status: false,
        message: "⚠️ أرسل اسم التطبيق في المعلمة ?query=",
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

    // إعداد رأس التحميل
    const filename = `${app.name || "app"}_${app.file?.vername || "latest"}.apk`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");

    // 🔁 تحميل الـAPK من مصدره وإرساله للمستخدم
    const response = await axios.get(downloadUrl, {
      responseType: "stream",
      headers: { "User-Agent": "Aptoide-Downloader/1.0" },
    });

    response.data.pipe(res);

    response.data.on("end", () => {
      console.log(`✅ تم تحميل ${filename} بنجاح`);
    });

    response.data.on("error", (err) => {
      console.error("❌ خطأ أثناء التحميل:", err.message);
      res.status(500).end("❌ فشل التحميل");
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التحميل من Aptoide",
      error: err.message,
    });
  }
});

/** 🧩 POST Route - نفس الشيء لكن باستخدام body */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query)
      return res.status(400).json({
        status: false,
        message: "⚠️ أرسل حقل 'query' في body JSON",
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

    const filename = `${app.name || "app"}_${app.file?.vername || "latest"}.apk`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");

    const response = await axios.get(downloadUrl, {
      responseType: "stream",
      headers: { "User-Agent": "Aptoide-Downloader/1.0" },
    });

    response.data.pipe(res);

    response.data.on("end", () => {
      console.log(`✅ تم تحميل ${filename} بنجاح`);
    });

    response.data.on("error", (err) => {
      console.error("❌ خطأ أثناء التحميل:", err.message);
      res.status(500).end("❌ فشل التحميل");
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التحميل من Aptoide",
      error: err.message,
    });
  }
});

export default router;
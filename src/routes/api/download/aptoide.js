import express from "express";
import axios from "axios";
import JSZip from "jszip";

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

/** 🔧 فحص وفك ضغط الملف إذا كان ZIP */
async function extractApkIfZipped(buffer, filename) {
  // فحص signature الملف
  const isPK = buffer[0] === 0x50 && buffer[1] === 0x4B;
  
  if (!isPK) {
    // ليس ZIP ولا APK صالح
    throw new Error("❌ الملف المحمّل ليس APK أو ZIP صالح");
  }

  // فحص إذا كان APK مباشرة (APK هو ZIP يحتوي على AndroidManifest.xml)
  const bufferString = buffer.toString('binary', 0, Math.min(buffer.length, 1000));
  const isDirectApk = bufferString.includes('AndroidManifest') || 
                      bufferString.includes('classes.dex') ||
                      bufferString.includes('META-INF');

  if (isDirectApk) {
    // الملف هو APK مباشرة
    console.log("✅ الملف هو APK مباشر");
    return { buffer, filename };
  }

  // الملف ZIP يحتوي على APK - نحاول فك الضغط
  try {
    console.log("🔄 محاولة فك ضغط ZIP...");
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);
    
    console.log(`📁 الملفات داخل ZIP: ${files.join(', ')}`);
    
    // البحث عن ملف .apk
    const apkFile = files.find(name => /\.apk$/i.test(name) && !zip.files[name].dir);
    
    if (!apkFile) {
      // لا يوجد APK، نرجع الملف الأصلي (ربما هو APK لكن بدون امتداد)
      console.log("⚠️ لم يتم العثور على .apk، إرجاع الملف الأصلي");
      return { buffer, filename };
    }

    console.log(`✅ تم العثور على: ${apkFile}`);
    const apkBuffer = await zip.files[apkFile].async("nodebuffer");
    const apkName = apkFile.split('/').pop();
    
    return { buffer: apkBuffer, filename: apkName };
  } catch (err) {
    // فشل فك الضغط، نرجع الملف الأصلي
    console.log(`⚠️ فشل فك الضغط، إرجاع الملف الأصلي: ${err.message}`);
    return { buffer, filename };
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

    let filename = `${(app.name || "app").replace(/[^a-zA-Z0-9.-]/g, '_')}_${app.file?.vername || "latest"}.apk`;

    console.log(`📥 تحميل من: ${downloadUrl}`);

    // تحميل الملف كـ buffer
    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Aptoide-Downloader/1.0" },
      timeout: 120000,
    });

    const buffer = Buffer.from(response.data);
    console.log(`📦 حجم الملف: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);

    // فحص وفك الضغط إذا كان ZIP
    const { buffer: apkBuffer, filename: apkFilename } = await extractApkIfZipped(buffer, filename);

    // إرسال الـ APK
    res.setHeader("Content-Disposition", `attachment; filename="${apkFilename}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Length", apkBuffer.length);

    res.send(apkBuffer);

    console.log(`✅ تم إرسال ${apkFilename} بنجاح`);
  } catch (err) {
    console.error("❌ خطأ:", err);
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

    let filename = `${(app.name || "app").replace(/[^a-zA-Z0-9.-]/g, '_')}_${app.file?.vername || "latest"}.apk`;

    console.log(`📥 تحميل من: ${downloadUrl}`);

    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Aptoide-Downloader/1.0" },
      timeout: 120000,
    });

    const buffer = Buffer.from(response.data);
    console.log(`📦 حجم الملف: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);

    const { buffer: apkBuffer, filename: apkFilename } = await extractApkIfZipped(buffer, filename);

    res.setHeader("Content-Disposition", `attachment; filename="${apkFilename}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Length", apkBuffer.length);

    res.send(apkBuffer);

    console.log(`✅ تم إرسال ${apkFilename} بنجاح`);
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التحميل من Aptoide",
      error: err.message,
    });
  }
});

export default router;
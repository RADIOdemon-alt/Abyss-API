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
  // فحص إذا كان الملف ZIP (يبدأ بـ PK)
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03;
  
  if (!isZip) {
    // الملف APK مباشرة
    return { buffer, filename };
  }

  try {
    // فك ضغط الـ ZIP
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);
    
    // البحث عن ملف .apk
    const apkFile = files.find(name => /\.apk$/i.test(name) && !zip.files[name].dir);
    
    if (!apkFile) {
      throw new Error("❌ لم يتم العثور على ملف APK داخل الـ ZIP");
    }

    const apkBuffer = await zip.files[apkFile].async("nodebuffer");
    const apkName = apkFile.split('/').pop();
    
    return { buffer: apkBuffer, filename: apkName };
  } catch (err) {
    throw new Error(`❌ فشل فك ضغط الـ ZIP: ${err.message}`);
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

    let filename = `${app.name || "app"}_${app.file?.vername || "latest"}.apk`;

    // تحميل الملف كـ buffer
    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Aptoide-Downloader/1.0" },
    });

    const buffer = Buffer.from(response.data);

    // فحص وفك الضغط إذا كان ZIP
    const { buffer: apkBuffer, filename: apkFilename } = await extractApkIfZipped(buffer, filename);

    // إرسال الـ APK
    res.setHeader("Content-Disposition", `attachment; filename="${apkFilename}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Length", apkBuffer.length);

    res.send(apkBuffer);

    console.log(`✅ تم إرسال ${apkFilename} بنجاح`);
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

    let filename = `${app.name || "app"}_${app.file?.vername || "latest"}.apk`;

    const response = await axios.get(downloadUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Aptoide-Downloader/1.0" },
    });

    const buffer = Buffer.from(response.data);

    // فحص وفك الضغط إذا كان ZIP
    const { buffer: apkBuffer, filename: apkFilename } = await extractApkIfZipped(buffer, filename);

    res.setHeader("Content-Disposition", `attachment; filename="${apkFilename}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Length", apkBuffer.length);

    res.send(apkBuffer);

    console.log(`✅ تم إرسال ${apkFilename} بنجاح`);
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
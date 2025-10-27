import express from "express";
import axios from "axios";

const router = express.Router();

/** 📦 Class AptoideAPI */
class AptoideAPI {
  constructor() {
    this.baseUrl = "https://ws75.aptoide.com/api/7";
    this.headers = {
      accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
    };
  }

  /** 🔍 البحث عن التطبيقات */
  async searchApps(query, limit = 20) {
    if (!query) throw new Error("Query is required");
    const url = `${this.baseUrl}/apps/search?query=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await axios.get(url, { headers: this.headers });
    return res.data?.datalist?.list || [];
  }

  /** 📦 الحصول على تفاصيل تطبيق */
  async getApp(packageName) {
    if (!packageName) throw new Error("Package name is required");
    const url = `${this.baseUrl}/apps/package/${packageName}`;
    const res = await axios.get(url, { headers: this.headers });
    return res.data;
  }
}

/** 🧩 GET Route — بحث التطبيقات */
router.get("/", async (req, res) => {
  try {
    const query = req.query.query;
    const limit = req.query.limit || 20;
    if (!query)
      return res.status(400).json({ status: false, message: "⚠️ اسم التطبيق (query) مطلوب" });

    const aptoide = new AptoideAPI();
    const apps = await aptoide.searchApps(query, limit);

    if (!apps.length)
      return res.status(404).json({ status: false, message: "❌ لم يتم العثور على تطبيقات!" });

    const result = apps.map(app => ({
      name: app.name,
      package: app.package,
      version: app.file?.vername || "N/A",
      size: app.size || "غير معروف",
      downloads: app.stats?.downloads || 0,
      icon: app.icon,
    }));

    res.json({
      status: true,
      count: result.length,
      message: "✅ تم العثور على التطبيقات بنجاح",
      results: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث في Aptoide API",
      error: err.message,
    });
  }
});

/** 🧩 GET Route — تفاصيل تطبيق + تحميل مباشر */
router.get("/details", async (req, res) => {
  try {
    const pkg = req.query.package;
    const download = req.query.download === "true"; // ?download=true

    if (!pkg)
      return res.status(400).json({ status: false, message: "⚠️ اسم الحزمة (package) مطلوب" });

    const aptoide = new AptoideAPI();
    const details = await aptoide.getApp(pkg);

    const data = details?.nodes?.meta?.data;
    if (!data)
      return res.status(404).json({ status: false, message: "❌ لم يتم العثور على التطبيق" });

    const apkUrl = data.file?.path;
    if (!apkUrl)
      return res.status(404).json({ status: false, message: "❌ لم يتم العثور على رابط التحميل" });

    // 🧲 إذا المستخدم طلب تحميل مباشر
    if (download) {
      const filename = `${data.package}_${data.file?.vername || "latest"}.apk`;
      const response = await axios.get(apkUrl, { responseType: "stream" });

      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      // بث الملف مباشرة إلى العميل
      response.data.pipe(res);
      return;
    }

    // 🧩 وإلا نرجع JSON
    res.json({
      status: true,
      message: "✅ تم الحصول على تفاصيل التطبيق",
      result: {
        name: data.name,
        package: data.package,
        version: data.file?.vername,
        size: data.size,
        downloads: data.stats?.downloads,
        developer: data.developer?.name || "غير معروف",
        apkUrl,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب تفاصيل التطبيق",
      error: err.message,
    });
  }
});

export default router;
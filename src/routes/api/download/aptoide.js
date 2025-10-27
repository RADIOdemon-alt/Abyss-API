import express from "express";
import axios from "axios";

const router = express.Router();

class AptoideAPI {
  constructor() {
    this.searchUrl = "https://ws75.aptoide.com/api/7/apps/search";
    this.getUrl = "https://ws75.aptoide.com/api/7/apps/get";
  }

  async search(query, limit = 1) {
    if (!query) throw new Error("Query is required");

    const response = await axios.get(this.searchUrl, {
      params: {
        query: query,
        limit: limit
      }
    });

    const data = response.data?.datalist?.list;
    if (!data || data.length === 0) {
      throw new Error("لم يتم العثور على تطبيقات");
    }

    return data;
  }

  async getAppDetails(packageName) {
    if (!packageName) throw new Error("Package name is required");

    const response = await axios.get(this.getUrl, {
      params: {
        package_name: packageName
      }
    });

    const appData = response.data?.nodes?.meta?.data;
    if (!appData) {
      throw new Error("فشل في الحصول على معلومات التطبيق");
    }

    return appData;
  }

  async downloadApp(query) {
    // البحث عن التطبيق
    const searchResults = await this.search(query, 1);
    const app = searchResults[0];

    // جلب تفاصيل التطبيق
    const appDetails = await this.getAppDetails(app.package);

    return {
      name: appDetails.name || app.name,
      package: appDetails.package || app.package,
      version: appDetails.file?.vername || app.file?.vername || "N/A",
      size: appDetails.size || app.size,
      downloads: appDetails.stats?.downloads || app.stats?.downloads || 0,
      rating: appDetails.stats?.rating?.avg || app.stats?.rating?.avg || 0,
      icon: appDetails.icon || app.icon,
      downloadUrl: appDetails.file?.path || null,
      md5: appDetails.file?.md5sum || null
    };
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        status: false,
        message: "⚠️ اسم التطبيق مطلوب (query)"
      });
    }

    const aptoide = new AptoideAPI();
    const result = await aptoide.downloadApp(query);

    if (!result.downloadUrl) {
      return res.status(500).json({
        status: false,
        message: "⚠️ لم يتم العثور على رابط التحميل"
      });
    }

    res.json({
      status: true,
      message: "✅ تم العثور على التطبيق بنجاح",
      data: result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث عن التطبيق",
      error: err.message
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const query = req.query.query;

    if (!query) {
      return res.status(400).json({
        status: false,
        message: "⚠️ اسم التطبيق مطلوب (query)"
      });
    }

    const aptoide = new AptoideAPI();
    const result = await aptoide.downloadApp(query);

    if (!result.downloadUrl) {
      return res.status(500).json({
        status: false,
        message: "⚠️ لم يتم العثور على رابط التحميل"
      });
    }

    res.json({
      status: true,
      message: "✅ تم العثور على التطبيق بنجاح",
      data: result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث عن التطبيق",
      error: err.message
    });
  }
});

export default router;
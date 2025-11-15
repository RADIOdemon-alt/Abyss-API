import express from "express";
import axios from "axios";

const router = express.Router();

/* ---------------------------------------------------------
   🔧 كلاس للتعامل مع Gofile
--------------------------------------------------------- */
class GofileAPI {
  constructor() {
    this.token = "61GsqPG6GvISx1LSIkt3rwQhkcdXqBFY";
    this.base = "https://api.gofile.io";

    this.headers = {
      "Authorization": `Bearer ${this.token}`,
      "content-type": "application/json; charset=utf-8",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    };
  }

  extractCode(url) {
    try {
      if (url.includes("/d/")) return url.split("/d/")[1].split(/[?#&]/)[0];
      if (url.includes("/folder/")) return url.split("/folder/")[1].split(/[?#&]/)[0];
      return url;
    } catch {
      return null;
    }
  }

  async getFolder(code) {
    const url = `${this.base}/contents/${code}?wt=4fd6sg89d7s6&page=1&pageSize=1000`;
    const res = await axios.get(url, { headers: this.headers });

    if (res.data.status !== "ok")
      throw new Error(res.data.message || "Gofile Error");

    const data = res.data.data;
    const children = Array.isArray(data.children)
      ? data.children
      : Object.values(data.children || {});

    return { ...data, children };
  }

  async download(link) {
    const res = await axios.get(link, {
      responseType: "arraybuffer",
      headers: this.headers,
    });

    return {
      mime: res.headers["content-type"] || "application/octet-stream",
      size: res.data.length,
      base64: Buffer.from(res.data).toString("base64"),
    };
  }
}

/* ---------------------------------------------------------
   📌 GET /gofile  →  يعيد بيانات المجلد
--------------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const { url, code } = req.query;
    const input = code || url;
    if (!input)
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب إرسال رابط أو code",
      });

    const api = new GofileAPI();
    const folderCode = api.extractCode(input);

    if (!folderCode)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ رابط غير صالح" });

    const data = await api.getFolder(folderCode);

    return res.json({
      status: true,
      message: "✅ تم جلب محتوى المجلد بنجاح",
      folder: {
        id: folderCode,
        name: data.name,
        childrenCount: data.children.length,
        totalDownloadCount: data.totalDownloadCount || 0,
        children: data.children.map((f) => ({
          name: f.name,
          size: f.size,
          downloads: f.downloadCount,
          link: f.link,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "❌ فشل في التواصل مع Gofile",
      error: err.message,
    });
  }
});

/* ---------------------------------------------------------
   📌 POST /gofile/download  → تنزيل ملف Base64
--------------------------------------------------------- */
router.post("/download", async (req, res) => {
  try {
    const { link } = req.body;
    if (!link)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ يجب إرسال رابط الملف link" });

    const api = new GofileAPI();
    const file = await api.download(link);

    res.json({
      status: true,
      message: "📥 تم تنزيل الملف بنجاح",
      file,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "❌ فشل في تنزيل الملف",
      error: err.message,
    });
  }
});

/* ---------------------------------------------------------
   📌 GET /gofile/download?link=xxx  → تنزيل ملف Base64
--------------------------------------------------------- */
router.get("/download", async (req, res) => {
  try {
    const { link } = req.query;
    if (!link)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ يجب إرسال link" });

    const api = new GofileAPI();
    const file = await api.download(link);

    res.json({
      status: true,
      message: "📥 تم تنزيل الملف بنجاح",
      file,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "❌ فشل في تنزيل الملف",
      error: err.message,
    });
  }
});

export default router;
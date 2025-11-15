import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";

const router = express.Router();

/* ----------------------------------------------------
 * 🟦 CLASS : GofileAPI
 * ---------------------------------------------------- */
class GofileAPI {
  constructor() {
    this.baseUrl = "https://api.gofile.io/contents";
    this.token = "61GsqPG6GvISx1LSIkt3rwQhkcdXqBFY";

    this.headers = {
      "Authorization": `Bearer ${this.token}`,
      "content-type": "application/json; charset=utf-8",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      origin: "https://gofile.io",
      referer: "https://gofile.io/",
    };
  }

  /** استخراج كود /d/ */
  extractCode(url) {
    if (!url.includes("/d/")) return null;
    return url.split("/d/")[1].split(/[/?#]/)[0];
  }

  /** جلب معلومات الفولدر */
  async getFolder(code) {
    const api = `${this.baseUrl}/${code}?wt=4fd6sg89d7s6&page=1&pageSize=1000&sortField=name&sortDirection=1`;

    const res = await axios.get(api, { headers: this.headers });
    if (res.data.status !== "ok") throw new Error("API Error");

    return res.data.data;
  }

  /** تحميل ملف واحد */
  async downloadFile(url, filename) {
    const dl = await axios.get(url, {
      responseType: "arraybuffer",
      headers: this.headers,
    });

    const filePath = path.join("/tmp", filename);
    fs.writeFileSync(filePath, dl.data);

    return filePath;
  }
}

/* ----------------------------------------------------
 * 🟩 POST /gofile
 * body: { url }
 * ---------------------------------------------------- */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ الرابط مطلوب" });

    const api = new GofileAPI();
    const code = api.extractCode(url);
    if (!code) return res.status(400).json({ status: false, message: "⚠️ رابط غير صالح" });

    const folder = await api.getFolder(code);

    res.json({
      status: true,
      folder: {
        name: folder.name,
        count: folder.childrenCount,
        downloads: folder.totalDownloadCount,
      },
      files: Object.values(folder.children).map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        downloads: f.downloadCount,
        link: f.link,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "❌ حدث خطأ", error: err.message });
  }
});

/* ----------------------------------------------------
 * 🟦 GET /gofile/download?id=FILE_ID&code=FOLDER_CODE
 * → يرجع الملف مباشرة
 * ---------------------------------------------------- */
router.get("/download", async (req, res) => {
  try {
    const { link, name } = req.query;

    if (!link || !name)
      return res.status(400).json({ status: false, message: "⚠️ link و name مطلوبين" });

    const api = new GofileAPI();
    const filePath = await api.downloadFile(link, name);

    res.download(filePath, name, (err) => {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "❌ فشل التحميل", error: err.message });
  }
});

/* ----------------------------------------------------
 * 🟧 GET /gofile?url=...
 * نسخة GET من المسار الأول
 * ---------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ الرابط مطلوب" });

    const api = new GofileAPI();
    const code = api.extractCode(url);
    if (!code) return res.status(400).json({ status: false, message: "⚠️ رابط غير صالح" });

    const folder = await api.getFolder(code);

    res.json({
      status: true,
      folder: {
        name: folder.name,
        count: folder.childrenCount,
        downloads: folder.totalDownloadCount,
      },
      files: Object.values(folder.children).map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        downloads: f.downloadCount,
        link: f.link,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "❌ حدث خطأ", error: err.message });
  }
});

export default router;
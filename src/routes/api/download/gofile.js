import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";

const router = express.Router();

class GofileDL {
  constructor(token = "") {
    this.token = token || "61GsqPG6GvISx1LSIkt3rwQhkcdXqBFY";
    this.headers = {
      "Authorization": `Bearer ${this.token}`,
      "content-type": "application/json; charset=utf-8",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      "accept": "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      "origin": "https://gofile.io",
      "referer": "https://gofile.io/"
    };
  }

  async fetchFolder(code) {
    const api = `https://api.gofile.io/contents/${code}?wt=4fd6sg89d7s6&contentFilter=&page=1&pageSize=1000&sortField=name&sortDirection=1`;
    const res = await axios.get(api, { headers: this.headers });
    if (res.data.status !== "ok") throw new Error("الرابط غير صالح أو حدث خطأ");

    return res.data.data;
  }

  async downloadFile(file) {
    const res = await axios.get(file.link, { responseType: "arraybuffer", headers: this.headers });
    const filepath = path.join("/tmp", file.name);
    fs.writeFileSync(filepath, res.data);
    return filepath;
  }
}

/* ===========================
   POST ROUTE
===========================*/
router.post("/", async (req, res) => {
  try {
    const { url, token } = req.body;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ مطلوب: رابط Gofile" });

    const code = url.split("/d/")[1];
    if (!code) return res.status(400).json({ status: false, message: "الرابط غلط" });

    const gofile = new GofileDL(token);
    const data = await gofile.fetchFolder(code);

    const filesInfo = [];
    for (const f of data.children) {
      const filepath = await gofile.downloadFile(f);
      filesInfo.push({
        name: f.name,
        size: f.size,
        downloads: f.downloadCount,
        downloadPath: filepath
      });
    }

    res.json({
      status: true,
      folderName: data.name,
      totalFiles: data.childrenCount,
      totalDownloads: data.totalDownloadCount,
      files: filesInfo
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "❌ حدث خطأ", error: err.message });
  }
});

/* ===========================
   GET ROUTE
===========================*/
router.get("/", async (req, res) => {
  try {
    const { url, token } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ مطلوب: رابط Gofile" });

    const code = url.split("/d/")[1];
    if (!code) return res.status(400).json({ status: false, message: "الرابط غلط" });

    const gofile = new GofileDL(token);
    const data = await gofile.fetchFolder(code);

    res.json({
      status: true,
      folderName: data.name,
      totalFiles: data.childrenCount,
      totalDownloads: data.totalDownloadCount,
      files: data.children.map(f => ({
        name: f.name,
        size: f.size,
        downloads: f.downloadCount,
        link: f.link
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "❌ حدث خطأ", error: err.message });
  }
});

export default router;

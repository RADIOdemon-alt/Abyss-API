import express from "express";
import * as cheerio from "cheerio";
import { basename, extname } from "path";
import mime from "mime-types";

const router = express.Router();

class MediaFireAPI {
  constructor() {
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1"
    };
  }

  async getFileInfo(url) {
    if (!url || !url.includes("mediafire.com")) {
      throw new Error("Invalid MediaFire URL");
    }

    try {
      const response = await fetch(url.trim(), { headers: this.headers });
      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $("meta[property='og:title']").attr("content")?.trim() || "Unknown";
      const size = /Download\s*\(([\d.]+\s*[KMGT]?B)\)/i.exec(html)?.[1] || "Unknown";
      
      const dl = $("a.popsok[href^='https://download']").attr("href")?.trim() || 
                 $("a.popsok:not([href^='javascript'])").attr("href")?.trim();

      if (!dl) {
        throw new Error("Download URL not found. The file may be unavailable or the link is invalid.");
      }

      const filename = basename(dl);
      const fileType = extname(dl);
      const mimeType = mime.lookup(filename) || "application/octet-stream";

      return {
        status: true,
        name: title,
        filename: filename,
        type: fileType,
        mimetype: mimeType,
        size: size,
        download: dl,
        link: url.trim()
      };

    } catch (error) {
      throw new Error(`Failed to fetch MediaFire data: ${error.message}`);
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط MediaFire مطلوب (url)" 
      });
    }

    const mediafire = new MediaFireAPI();
    const result = await mediafire.getFileInfo(url);

    res.json({ 
      status: true, 
      message: "✅ تم جلب معلومات الملف بنجاح", 
      data: result 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء جلب البيانات من MediaFire", 
      error: err.message 
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط MediaFire مطلوب (url)",
        example: "?url=https://www.mediafire.com/file/example/file.apk"
      });
    }

    const mediafire = new MediaFireAPI();
    const result = await mediafire.getFileInfo(url);

    res.json({ 
      status: true, 
      message: "✅ تم جلب معلومات الملف بنجاح", 
      data: result 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء جلب البيانات من MediaFire", 
      error: err.message 
    });
  }
});

export default router;
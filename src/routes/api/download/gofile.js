import express from "express";
import axios from "axios";

const router = express.Router();

class GofileAPI {
  constructor(opts = {}) {
    this.baseUrl = "https://api.gofile.io";
    this.token = opts.token || process.env.GOFILE_TOKEN || "61GsqPG6GvISx1LSIkt3rwQhkcdXqBFY";
    this.headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json; charset=utf-8",
      origin: "https://gofile.io",
      referer: "https://gofile.io/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      Authorization: `Bearer ${this.token}`,
    };
  }

  extractCode(input) {
    if (!input) return null;
    try {
      if (input.includes("/d/")) return input.split("/d/")[1].split(/[/?#&]/)[0];
      if (input.includes("/folder/")) return input.split("/folder/")[1].split(/[/?#&]/)[0];
      return input;
    } catch {
      return null;
    }
  }

  async getFolderContents(code) {
    if (!code) throw new Error("رمز المجلد مطلوب");
    const url = `${this.baseUrl}/contents/${code}?wt=4fd6sg89d7s6&contentFilter=&page=1&pageSize=1000&sortField=name&sortDirection=1`;
    const res = await axios.get(url, { headers: this.headers, timeout: 20000 });
    if (!res?.data) throw new Error("لم يتم استلام استجابة من Gofile");
    if (res.data.status !== "ok") throw new Error(res.data.message || "خطأ من Gofile API");
    return res.data.data;
  }

  async downloadFile(fileLink) {
    if (!fileLink) throw new Error("رابط الملف مطلوب");
    const res = await axios.get(fileLink, { responseType: "arraybuffer", headers: this.headers, timeout: 60000 });
    const mime = res.headers["content-type"] || "application/octet-stream";
    const b64 = Buffer.from(res.data, "binary").toString("base64");
    return {
      inline_data: { mime_type: mime, data: b64 },
      size: res.data.length,
    };
  }
}

/** Helper: تأخذ data.children سواء كانت مصفوفة أو object، وتعيد مصفوفة */
function childrenToArray(children) {
  if (!children) return [];
  if (Array.isArray(children)) return children;
  if (typeof children === "object") return Object.values(children);
  return [];
}

/** POST Route */
router.post("/", async (req, res) => {
  try {
    const { url, code, fileLink } = req.body || {};
    const go = new GofileAPI({ token: process.env.GOFILE_TOKEN || undefined });

    if (fileLink) {
      const fileData = await go.downloadFile(fileLink);
      return res.json({
        status: true,
        message: "✅ تم تنزيل الملف بنجاح (base64)",
        file: {
          mime_type: fileData.inline_data.mime_type,
          size: fileData.size,
          inline_data: fileData.inline_data,
        },
      });
    }

    const input = code || url;
    if (!input) return res.status(400).json({ status: false, message: "⚠️ أرسل `url` أو `code` أو `fileLink`" });

    const folderCode = go.extractCode(input);
    if (!folderCode) return res.status(400).json({ status: false, message: "⚠️ لم يتم استخراج رمز المجلد (code) من الرابط" });

    const data = await go.getFolderContents(folderCode);

    // تحويل الأطفال إلى مصفوفة بأمان
    const childrenArray = childrenToArray(data.children);

    const children = childrenArray.map((f) => ({
      name: f.name,
      size: f.size,
      downloadCount: f.downloadCount,
      link: f.link,
    }));

    return res.json({
      status: true,
      message: "✅ تم جلب محتوى المجلد بنجاح",
      folder: {
        id: folderCode,
        name: data.name,
        childrenCount: data.childrenCount ?? children.length,
        totalDownloadCount: data.totalDownloadCount ?? 0,
        children,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التواصل مع Gofile", error: err.message });
  }
});

/** GET Route */
router.get("/", async (req, res) => {
  try {
    const { url, code, fileLink } = req.query || {};
    const go = new GofileAPI({ token: process.env.GOFILE_TOKEN || undefined });

    if (fileLink) {
      const fileData = await go.downloadFile(fileLink);
      return res.json({
        status: true,
        message: "✅ تم تنزيل الملف بنجاح (base64)",
        file: {
          mime_type: fileData.inline_data.mime_type,
          size: fileData.size,
          inline_data: fileData.inline_data,
        },
      });
    }

    const input = code || url;
    if (!input) return res.status(400).json({ status: false, message: "⚠️ أرسل `url` أو `code` أو `fileLink` كـ query" });

    const folderCode = go.extractCode(input);
    if (!folderCode) return res.status(400).json({ status: false, message: "⚠️ لم يتم استخراج رمز المجلد (code) من الرابط" });

    const data = await go.getFolderContents(folderCode);
    const childrenArray = childrenToArray(data.children);

    const children = childrenArray.map((f) => ({
      name: f.name,
      size: f.size,
      downloadCount: f.downloadCount,
      link: f.link,
    }));

    return res.json({
      status: true,
      message: "✅ تم جلب محتوى المجلد بنجاح",
      folder: {
        id: folderCode,
        name: data.name,
        childrenCount: data.childrenCount ?? children.length,
        totalDownloadCount: data.totalDownloadCount ?? 0,
        children,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التواصل مع Gofile", error: err.message });
  }
});

export default router;
// gofile-router.js
import express from "express";
import axios from "axios";

const router = express.Router();

class GofileAPI {
  constructor(opts = {}) {
    this.base = opts.base || "https://api.gofile.io";
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

  async getFolder(code) {
    if (!code) throw new Error("رمز المجلد مطلوب");
    const url = `${this.base}/contents/${code}?wt=4fd6sg89d7s6&contentFilter=&page=1&pageSize=1000&sortField=name&sortDirection=1`;
    const res = await axios.get(url, { headers: this.headers, timeout: 20000 });
    if (!res?.data) throw new Error("لم يتم استلام استجابة من Gofile");
    if (res.data.status !== "ok") throw new Error(res.data.message || "خطأ من Gofile API");
    const data = res.data.data;
    // تأكد أن children مصفوفة
    const children = Array.isArray(data.children) ? data.children : Object.values(data.children || {});
    return { ...data, children };
  }

  /**
   * Stream a file by its direct CDN link.
   * Returns axios response (stream) so caller can pipe it.
   */
  async streamFromLink(link) {
    if (!link) throw new Error("رابط الملف مطلوب");
    const res = await axios.get(link, {
      responseType: "stream",
      headers: {
        // لا تُرسل Authorization دائماً إلى CDN، لكن نحتفظ برأس user-agent أحياناً
        "user-agent": this.headers["user-agent"],
        accept: "*/*"
      },
      maxRedirects: 5,
      timeout: 120000
    });
    return res;
  }
}

/* -----------------------------
   GET /        -> folder info
   query: ?url=...  or ?code=...
   ---------------------------- */
router.get("/", async (req, res) => {
  try {
    const { url, code } = req.query;
    const input = code || url;
    if (!input) return res.status(400).json({ status: false, message: "أرسل query `url` أو `code`" });

    const api = new GofileAPI();
    const folderCode = api.extractCode(input);
    if (!folderCode) return res.status(400).json({ status: false, message: "لم أتمكن من استخراج رمز المجلد" });

    const data = await api.getFolder(folderCode);

    // إرسال تفاصيل أبسط للعميل مع روابط التحميل
    const children = (data.children || []).map((f, idx) => ({
      index: idx,
      id: f.id ?? null,
      name: f.name,
      size: f.size,
      downloads: f.downloadCount,
      link: f.link
    }));

    return res.json({
      status: true,
      message: "✅ تم جلب محتوى المجلد بنجاح",
      folder: {
        id: folderCode,
        name: data.name,
        childrenCount: data.childrenCount ?? children.length,
        totalDownloadCount: data.totalDownloadCount ?? 0,
        children
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء جلب المجلد", error: err.message });
  }
});

/* -----------------------------
   GET /stream
   query: ?link=<direct_link>
   streams the file directly to the client (attachment)
   ---------------------------- */
router.get("/stream", async (req, res) => {
  try {
    const { link } = req.query;
    if (!link) return res.status(400).json({ status: false, message: "أرسل query `link` للرابط المباشر للملف" });

    const api = new GofileAPI();
    const streamRes = await api.streamFromLink(link);

    // تمرير الرؤوس المهمة للعميل
    const filename = (link.split("/").pop() || "file").split("?")[0];
    const contentType = streamRes.headers["content-type"] || "application/octet-stream";
    const contentLength = streamRes.headers["content-length"];

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (contentLength) res.setHeader("Content-Length", contentLength);

    // pipe axios stream to express response
    streamRes.data.pipe(res);

    // عندما ينتهي البث نغلق الاستجابة بشكل طبيعي
    streamRes.data.on("end", () => {
      // finalize
    });
    streamRes.data.on("error", (e) => {
      console.error("Stream error:", e);
      if (!res.headersSent) res.status(500).end("Stream error");
      else res.end();
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "❌ فشل في بث الملف", error: err.message });
  }
});

/* -----------------------------
   GET /stream-from-folder
   query: ?code=<folderCode>&index=<0-based index>  OR &name=<filename>
   يجد الملف داخل المجلد ثم يبثه (بدون حفظ على القرص)
   ---------------------------- */
router.get("/stream-from-folder", async (req, res) => {
  try {
    const { code, index, name } = req.query;
    if (!code) return res.status(400).json({ status: false, message: "أرسل query `code` للمجلد" });
    if (typeof index === "undefined" && !name) {
      return res.status(400).json({ status: false, message: "أرسل `index` أو `name` لتحديد الملف داخل المجلد" });
    }

    const api = new GofileAPI();
    const folder = await api.getFolder(code);
    const children = folder.children || [];

    let file = null;
    if (typeof index !== "undefined") {
      const idx = Number(index);
      file = children[idx];
    } else if (name) {
      file = children.find((c) => c.name === name);
    }

    if (!file) {
      return res.status(404).json({ status: false, message: "لم أجد الملف داخل المجلد" });
    }

    if (!file.link) return res.status(500).json({ status: false, message: "الملف لا يحتوي رابط تحميل مباشر" });

    // بث الملف
    const streamRes = await api.streamFromLink(file.link);

    const filename = file.name || (file.link.split("/").pop() || "file").split("?")[0];
    const contentType = streamRes.headers["content-type"] || "application/octet-stream";
    const contentLength = streamRes.headers["content-length"];

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (contentLength) res.setHeader("Content-Length", contentLength);

    streamRes.data.pipe(res);
    streamRes.data.on("error", (e) => {
      console.error("Stream error:", e);
      if (!res.headersSent) res.status(500).end("Stream error");
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "❌ فشل في بث الملف من داخل المجلد", error: err.message });
  }
});

/* -----------------------------
   POST /stream
   body: { link: "https://..." }  -> streams the file
   ---------------------------- */
router.post("/stream", async (req, res) => {
  try {
    const { link } = req.body || {};
    if (!link) return res.status(400).json({ status: false, message: "أرسل body.link" });
    const api = new GofileAPI();
    const streamRes = await api.streamFromLink(link);

    const filename = (link.split("/").pop() || "file").split("?")[0];
    const contentType = streamRes.headers["content-type"] || "application/octet-stream";
    const contentLength = streamRes.headers["content-length"];

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (contentLength) res.setHeader("Content-Length", contentLength);

    streamRes.data.pipe(res);
    streamRes.data.on("error", (e) => {
      console.error("Stream error:", e);
      if (!res.headersSent) res.status(500).end("Stream error");
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "❌ فشل في بث الملف", error: err.message });
  }
});

export default router;
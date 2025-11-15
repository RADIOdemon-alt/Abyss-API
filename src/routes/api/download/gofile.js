import express from "express";
import axios from "axios";

const router = express.Router();

/**
 * GofileAPI - class to interact with gofile.io (folder listing + file download)
 * Usage:
 *   const g = new GofileAPI({ token: "YOUR_TOKEN" })
 *   await g.getFolderContents(code)
 *   await g.downloadFile(fileLink)
 */
class GofileAPI {
  constructor(opts = {}) {
    this.baseUrl = "https://api.gofile.io";
    // يمكنك تمرير التوكن عبر opts أو تغيير القيمة هنا
    this.token = opts.token || "61GsqPG6GvISx1LSIkt3rwQhkcdXqBFY";
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

  /**
   * extractCode - يستخرج رمز المجلد من رابط مثل https://gofile.io/d/abcdEF
   * أو يرجع القيمة نفسها لو كانت رمزًا فقط
   */
  extractCode(input) {
    if (!input) return null;
    // قبول رابط كامل أو رمز فقط
    try {
      if (input.includes("/d/")) {
        const parts = input.split("/d/");
        return parts[1].split(/[/?#&]/)[0];
      }
      // أحيانًا يكون الرابط بصيغة /folder/ أو /?c=code
      if (input.includes("/folder/")) {
        const parts = input.split("/folder/");
        return parts[1].split(/[/?#&]/)[0];
      }
      // لو أرسل المستخدم الكود مباشرة
      return input;
    } catch {
      return null;
    }
  }

  /**
   * getFolderContents - يستدعي API للحصول على بيانات المجلد
   */
  async getFolderContents(code) {
    if (!code) throw new Error("رمز المجلد مطلوب");
    const url = `${this.baseUrl}/contents/${code}?wt=4fd6sg89d7s6&contentFilter=&page=1&pageSize=1000&sortField=name&sortDirection=1`;
    const res = await axios.get(url, { headers: this.headers, timeout: 20000 });
    if (!res?.data) throw new Error("لم يتم استلام استجابة من Gofile");
    if (res.data.status !== "ok") throw new Error(res.data.message || "خطأ من Gofile API");
    return res.data.data;
  }

  /**
   * downloadFile - يقوم بتنزيل الملف من رابط التحميل المباشر ويعيد inline_data (base64 + mime_type)
   * ملاحظة: الملفات الكبيرة ستستهلك ذاكرة السيرفر لأننا نحملها في الذاكرة كـ base64.
   */
  async downloadFile(fileLink) {
    if (!fileLink) throw new Error("رابط الملف مطلوب");
    const res = await axios.get(fileLink, { responseType: "arraybuffer", headers: this.headers, timeout: 60000 });
    const mime = res.headers["content-type"] || "application/octet-stream";
    const b64 = Buffer.from(res.data, "binary").toString("base64");
    return {
      inline_data: {
        mime_type: mime,
        data: b64,
      },
      size: res.data.length,
    };
  }
}

/** 🧩 POST Route
 * body: { url?: string, code?: string, fileLink?: string }
 * - لو أرسلت `url` أو `code` سيُرجع معلومات المجلد (name, children, links)
 * - لو أرسلت `fileLink` سيُرجع inline_data (base64) للملف
 */
router.post("/", async (req, res) => {
  try {
    const { url, code, fileLink } = req.body || {};
    const go = new GofileAPI({ token: process.env.GOFILE_TOKEN || undefined });

    if (fileLink) {
      // تنزيل ملف وإرجاع base64 (inline_data)
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

    // تبسيط المخرجات وتفريغ الحقول المهمة فقط
    const children = (data.children || []).map((f) => ({
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
        childrenCount: data.childrenCount,
        totalDownloadCount: data.totalDownloadCount,
        children,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التواصل مع Gofile", error: err.message });
  }
});

/** 🧩 GET Route
 * query: ?url=...  OR ?code=... OR ?fileLink=...
 * يعمل نفس سلوك POST
 */
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
    const children = (data.children || []).map((f) => ({
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
        childrenCount: data.childrenCount,
        totalDownloadCount: data.totalDownloadCount,
        children,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التواصل مع Gofile", error: err.message });
  }
});

export default router;
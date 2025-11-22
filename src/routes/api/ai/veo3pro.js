// routes/veo3.js
import express from "express";
import axios from "axios";
import FormData from "form-data";
import { fileTypeFromBuffer } from "file-type";

const router = express.Router();

/* -------------------------
   رفع الصورة إلى Uguu
------------------------- */
async function uploadToUguu(buffer) {
  const { ext = "jpg", mime = "image/jpeg" } = (await fileTypeFromBuffer(buffer)) || {};
  const form = new FormData();
  form.append("files[]", buffer, { filename: `image.${ext}`, contentType: mime });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.post("https://uguu.se/upload.php", form, {
        headers: {
          ...form.getHeaders(),
          "User-Agent": "Mozilla/5.0 (Express-Uploader)",
        },
        timeout: 30_000,
        validateStatus: null,
        responseType: "json",
      });

      if (!res.data || !res.data.files || !res.data.files[0] || !res.data.files[0].url) {
        throw new Error(`Invalid Uguu response (status ${res.status})`);
      }
      return res.data.files[0].url;
    } catch (err) {
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
      else throw err;
    }
  }
}

/* -------------------------
   تحقق من وجود رابط فيديو
------------------------- */
async function urlExists(url) {
  try {
    const res = await axios.head(url, { timeout: 10000, validateStatus: null });
    const ct = (res.headers?.["content-type"] || "").toLowerCase();
    return res.status === 200 && ct.startsWith("video");
  } catch {
    return false;
  }
}

/* -------------------------
   كلاس للتعامل مع veo31ai
------------------------- */
class Veo31 {
  constructor() {
    this.base = "https://veo31ai.io/api/pixverse-token";
    this.headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: "https://veo31ai.io",
      Referer: "https://veo31ai.io/",
      "User-Agent": "Mozilla/5.0 (compatible; Express-Server)",
    };
  }

  // إنشاء المهمة (gen)
  async createTask(payload) {
    const res = await axios.post(`${this.base}/gen`, payload, {
      headers: this.headers,
      validateStatus: null,
      responseType: "text",
      timeout: 30000,
    });

    // لوق مفيد
    console.log("createTask status:", res.status);

    let parsed = null;
    try { parsed = JSON.parse(res.data); } catch (e) { parsed = null; }

    // لو استجابة خطأ
    if (res.status >= 400) {
      throw new Error(`createTask failed: status=${res.status} body=${res.data}`);
    }

    const taskId = parsed?.taskId || parsed?.task_id || parsed?.data?.taskId || parsed?.data?.task_id || parsed?.id || parsed?.jobId;
    if (!taskId) {
      console.error("createTask parsed:", parsed);
      throw new Error(`createTask: no task id found. raw=${res.data}`);
    }

    return taskId;
  }

  // متابعة المهمة (get)
  async pollTask(taskId, statusPayload) {
    const maxTries = 80;
    for (let i = 1; i <= maxTries; i++) {
      try {
        const res = await axios.post(`${this.base}/get`, { taskId: Number(taskId), ...statusPayload }, {
          headers: this.headers,
          validateStatus: null,
          responseType: "text",
          timeout: 20000,
        });

        console.log(`[poll ${i}] status=${res.status}`);

        let status = null;
        try { status = JSON.parse(res.data); } catch (e) { status = null; }

        // تحقق الحقول المحتملة
        if (status?.videoUrl) return status.videoUrl;
        if (status?.outputUrl) return status.outputUrl;
        if (status?.data?.videoUrl) return status.data.videoUrl;

        // لو الخادم أعاد حالة فشل
        if (status?.status === "failed" || status?.error) {
          throw new Error("Server reported failure: " + JSON.stringify(status));
        }

        // تجربة روابط CDN مُحتملة
        const cdnCandidates = [
          `https://cdn.veo31ai.io/explore/${taskId}.mp4`,
          `https://cdn.veo31ai.io/${taskId}.mp4`,
        ];
        for (const cand of cdnCandidates) {
          if (await urlExists(cand)) return cand;
        }

      } catch (err) {
        console.warn(`[poll ${i}] error:`, err.message || err);
      }

      // انتظر 5 ثواني قبل المحاولة التالية
      await new Promise((r) => setTimeout(r, 5000));
    }

    throw new Error("Timeout: video not ready after polling");
  }

  // دالة تشغيل كاملة: إنشـاء → متابعة → إرجاع رابط
  async generate({ prompt, ratio = "16:9", imageBuffer = null }) {
    let type = "text-to-video";
    let imageUrl = "";

    if (imageBuffer) {
      if (imageBuffer.length > 10 * 1024 * 1024) throw new Error("Image too large (max 10MB)");
      imageUrl = await uploadToUguu(imageBuffer);
      type = "image-to-video";
    }

    const payload = {
      videoPrompt: prompt,
      videoAspectRatio: ratio,
      videoDuration: 5,
      videoQuality: "360p",
      videoModel: "v4.5",
      videoImageUrl: imageUrl || "",
      videoPublic: false,
    };

    const taskId = await this.createTask(payload);

    const statusPayload = {
      videoPublic: false,
      videoQuality: payload.videoQuality,
      videoAspectRatio: payload.videoAspectRatio,
      videoPrompt: payload.videoPrompt,
    };

    const videoUrl = await this.pollTask(taskId, statusPayload);
    return { type, videoUrl, taskId, imageUrl };
  }
}

/* -------------------------
   POST /veo3
   body JSON:
   { prompt, ratio?, imageBase64? }
------------------------- */
router.post("/", async (req, res) => {
  try {
    const { prompt, ratio = "16:9", imageBase64 } = req.body || {};
    if (!prompt) return res.status(400).json({ status: false, message: "⚠️ النص (prompt) مطلوب" });

    let buffer = null;
    if (imageBase64) {
      try {
        buffer = Buffer.from(imageBase64, "base64");
      } catch (e) {
        return res.status(400).json({ status: false, message: "⚠️ imageBase64 غير صالحة" });
      }
    }

    const veo = new Veo31();
    const result = await veo.generate({ prompt, ratio, imageBuffer: buffer });
    return res.json({ status: true, message: "🎥 تم توليد الفيديو بنجاح", ...result });
  } catch (err) {
    console.error("POST /veo3 error:", err);
    const detail = err.response?.data || err.message || String(err);
    return res.status(500).json({ status: false, message: "❌ فشل توليد الفيديو", error: detail });
  }
});

/* -------------------------
   GET /veo3?prompt=...&ratio=...&imageUrl=...
   imageUrl يمكن أن يكون رابطًا مفصولًا بفواصل لصور متعددة
------------------------- */
router.get("/", async (req, res) => {
  try {
    const prompt = req.query.prompt;
    const ratio = req.query.ratio || "16:9";
    let imageUrl = req.query.imageUrl || null;

    if (!prompt) return res.status(400).json({ status: false, message: "⚠️ النص (prompt) مطلوب" });

    let buffer = null;
    if (imageUrl) {
      // دعم إرسال أكثر من رابط مفصول بفاصلة
      const urls = typeof imageUrl === "string" ? imageUrl.split(",") : imageUrl;
      // نأخذ الصورة الأولى فقط (يمكن توسيعها لاحقاً لدعم عدة صور)
      const first = urls[0].trim();
      const resp = await axios.get(first, { responseType: "arraybuffer", validateStatus: null, timeout: 20000 });
      if (resp.status !== 200) return res.status(400).json({ status: false, message: "⚠️ فشل جلب الصورة من imageUrl" });
      buffer = Buffer.from(resp.data);
    }

    const veo = new Veo31();
    const result = await veo.generate({ prompt, ratio, imageBuffer: buffer });
    return res.json({ status: true, message: "🎥 تم توليد الفيديو بنجاح", ...result });
  } catch (err) {
    console.error("GET /veo3 error:", err);
    const detail = err.response?.data || err.message || String(err);
    return res.status(500).json({ status: false, message: "❌ فشل توليد الفيديو", error: detail });
  }
});

export default router;
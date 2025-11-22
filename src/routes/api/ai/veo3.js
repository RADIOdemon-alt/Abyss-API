// routes/veo3.js
import express from "express";
import axios from "axios";
import FormData from "form-data";
import { fileTypeFromBuffer } from "file-type";

const router = express.Router();

/* -------------------------------------------------
   🧩  رفع الصور إلى Uguu
------------------------------------------------- */
async function uploadToUguu(buffer) {
  const { ext = "jpg", mime = "image/jpeg" } = (await fileTypeFromBuffer(buffer)) || {};

  const form = new FormData();
  form.append("files[]", buffer, { filename: `image.${ext}`, contentType: mime });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.post("https://uguu.se/upload.php", form, {
        headers: form.getHeaders(),
      });

      if (!res.data?.files?.[0]?.url) throw new Error("Invalid Uguu response");
      return res.data.files[0].url;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/* -------------------------------------------------
   🧩 التحقق من وجود فيديو (HEAD)
------------------------------------------------- */
async function urlExists(url) {
  try {
    const res = await axios.head(url);
    const type = res.headers["content-type"] || "";
    return type.startsWith("video");
  } catch {
    return false;
  }
}

/* -------------------------------------------------
   🧩 كلاس VEO 3.1
------------------------------------------------- */
class Veo31 {
  constructor() {
    this.base = "https://veo31ai.io/api/pixverse-token";
    this.headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://veo31ai.io",
      Referer: "https://veo31ai.io/",
      "User-Agent": "Mozilla/5.0 (compatible; Express-Server)",
    };
  }

  /* 🔹 إنشاء مهمة */
  async createTask(payload) {
    const res = await axios.post(`${this.base}/gen`, payload, {
      headers: this.headers,
    });

    const data = res.data;

    return (
      data.taskId ||
      data.task_id ||
      data.data?.taskId ||
      data.data?.task_id ||
      data.id ||
      data.jobId
    );
  }

  /* 🔹 متابعة المهمة */
  async pollTask(taskId, payload) {
    let tries = 0;

    while (tries < 80) {
      tries++;

      let status = {};
      try {
        const res = await axios.post(
          `${this.base}/get`,
          {
            taskId: Number(taskId),
            ...payload,
          },
          { headers: this.headers }
        );
        status = res.data || {};
      } catch (e) {}

      // روابط محتملة مباشرة
      const candidates = [
        status.videoUrl,
        status.outputUrl,
        status?.data?.videoUrl,
      ].filter((x) => x);

      if (candidates.length) return candidates[0];

      // تجربة CDN من الـ taskId
      const cdnList = [
        `https://cdn.veo31ai.io/explore/${taskId}.mp4`,
        `https://cdn.veo31ai.io/${taskId}.mp4`,
      ];

      for (const url of cdnList) {
        if (await urlExists(url)) return url;
      }

      if (status?.status === "failed") {
        throw new Error("Server reported failure");
      }

      await new Promise((r) => setTimeout(r, 5000));
    }

    throw new Error("Timeout: No video generated");
  }

  /* 🔹 تشغيل كامل */
  async generate({ prompt, ratio, imageBuffer }) {
    let type = "text-to-video";
    let imageUrl = "";

    if (imageBuffer) {
      if (imageBuffer.length > 10 * 1024 * 1024) {
        throw new Error("Image too large (max 10MB)");
      }

      imageUrl = await uploadToUguu(imageBuffer);
      type = "image-to-video";
    }

    const payload = {
      videoPrompt: prompt,
      videoAspectRatio: ratio,
      videoDuration: 5,
      videoQuality: "360p",
      videoModel: "v4.5",
      videoImageUrl: imageUrl,
      videoPublic: false,
    };

    const taskId = await this.createTask(payload);

    const videoUrl = await this.pollTask(taskId, {
      videoPrompt: prompt,
      videoAspectRatio: ratio,
      videoQuality: "360p",
      videoPublic: false,
    });

    return { type, videoUrl, taskId, imageUrl };
  }
}

/* -------------------------------------------------
   🧩  POST /veo3
------------------------------------------------- */
router.post("/", async (req, res) => {
  try {
    const { prompt, ratio = "16:9" } = req.body;

    if (!prompt)
      return res.status(400).json({
        status: false,
        message: "⚠️ الوصف (prompt) مطلوب",
      });

    let buffer = null;

    if (req.body.imageBase64) {
      buffer = Buffer.from(req.body.imageBase64, "base64");
    }

    const veo = new Veo31();
    const data = await veo.generate({
      prompt,
      ratio,
      imageBuffer: buffer,
    });

    res.json({
      status: true,
      message: "🎥 تم توليد الفيديو بنجاح",
      ...data,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "❌ فشل توليد الفيديو",
      error: err.message,
    });
  }
});

/* -------------------------------------------------
   🧩  GET /veo3
------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const prompt = req.query.prompt;
    const ratio = req.query.ratio || "16:9";
    const imageUrl = req.query.imageUrl;

    if (!prompt)
      return res.status(400).json({
        status: false,
        message: "⚠️ الوصف (prompt) مطلوب",
      });

    let buffer = null;

    if (imageUrl) {
      const img = await axios.get(imageUrl, { responseType: "arraybuffer" });
      buffer = Buffer.from(img.data);
    }

    const veo = new Veo31();
    const data = await veo.generate({
      prompt,
      ratio,
      imageBuffer: buffer,
    });

    res.json({
      status: true,
      message: "🎥 تم توليد الفيديو بنجاح",
      ...data,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "❌ فشل توليد الفيديو",
      error: err.message,
    });
  }
});

export default router;
// gridplus-router.js
import express from "express";
import axios from "axios";
import crypto from "crypto";
import FormData from "form-data";
import { fileTypeFromBuffer } from "file-type";

const router = express.Router();

/* 🧩 GridPlus API Client */
class GridPlusAPI {
  constructor() {
    this.api = axios.create({
      baseURL: "https://api.grid.plus/v1",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0",
        "X-AppID": "808645",
        "X-Platform": "h5",
        "X-Version": "8.9.7",
        "X-SessionToken": "",
        "X-UniqueID": this.uid(),
        "X-GhostID": this.uid(),
        "X-DeviceID": this.uid(),
        "X-MCC": "id-ID",
        sig: `XX${this.uid() + this.uid()}`,
      },
    });
  }

  uid() {
    return crypto.randomUUID().replace(/-/g, "");
  }

  form(data) {
    const form = new FormData();
    Object.entries(data).forEach(([key, value]) => form.append(key, String(value)));
    return form;
  }

  async upload(buffer, method = "wn_aistyle_nano") {
    if (!Buffer.isBuffer(buffer)) throw new Error("❌ Invalid buffer data");

    const { mime, ext } = (await fileTypeFromBuffer(buffer)) || {};
    if (!ext || !mime) throw new Error("❌ Could not detect file type");

    const response = await this.api.post(
      "/ai/web/nologin/getuploadurl",
      this.form({ ext, method })
    );
    const uploadData = response.data?.data;

    await axios.put(uploadData.upload_url, buffer, {
      headers: { "content-type": mime },
    });

    return uploadData.img_url;
  }

  async pollTask({ path, data, successCheck }) {
    const start = Date.now();
    const interval = 3000;
    const timeout = 60000;

    return new Promise((resolve, reject) => {
      const loop = async () => {
        if (Date.now() - start > timeout) {
          return reject(new Error("⏰ Polling timed out"));
        }
        try {
          const res = await this.api({
            url: path,
            method: data ? "POST" : "GET",
            ...(data ? { data } : {}),
          });
          const dt = res.data;

          if (dt.errmsg) return reject(new Error(`⚠️ ${dt.errmsg}`));
          if (successCheck(dt.data)) return resolve(dt.data);

          setTimeout(loop, interval);
        } catch (err) {
          reject(err);
        }
      };
      loop();
    });
  }

  async editImage(buffer, prompt) {
    const uploaded = await this.upload(buffer);
    const task = await this.api.post(
      "/ai/nano/upload",
      this.form({ prompt, url: uploaded })
    );

    const taskId = task.data?.task_id;
    if (!taskId) throw new Error("❌ task_id not found");

    const result = await this.pollTask({
      path: `/ai/nano/get_result/${taskId}`,
      successCheck: (d) => d.code === 0 && !!d.image_url,
    });

    return result.image_url;
  }
}

/* 🧩 Helper to fetch image as Buffer */
async function fetchImageAsBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

/* ------------------- 🧠 ROUTES ------------------- */

/** 🧩 POST /gridplus
 * Body: { prompt: "وصف الصورة", imageUrl: "https://..." }
 */
router.post("/", async (req, res) => {
  try {
    const { prompt, imageUrl } = req.body;
    if (!prompt) {
      return res.status(400).json({ status: false, message: "⚠️ النص مطلوب (prompt)" });
    }
    if (!imageUrl) {
      return res.status(400).json({ status: false, message: "⚠️ رابط الصورة مطلوب (imageUrl)" });
    }

    const buffer = await fetchImageAsBuffer(imageUrl);
    const grid = new GridPlusAPI();
    const resultUrl = await grid.editImage(buffer, prompt);

    res.json({
      status: true,
      message: "✅ تم تعديل الصورة بنجاح",
      result: resultUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الصورة",
      error: err.message,
    });
  }
});

/** 🧩 GET /gridplus?prompt=...&imageUrl=...
 * Supports multiple image URLs separated by comma
 */
router.get("/", async (req, res) => {
  try {
    const prompt = req.query.prompt;
    let imageUrl = req.query.imageUrl;

    if (!prompt)
      return res.status(400).json({ status: false, message: "⚠️ النص مطلوب (prompt)" });

    if (!imageUrl)
      return res.status(400).json({ status: false, message: "⚠️ رابط الصورة مطلوب (imageUrl)" });

    if (typeof imageUrl === "string") imageUrl = imageUrl.split(",");

    const grid = new GridPlusAPI();

    const results = [];
    for (const url of imageUrl) {
      const buffer = await fetchImageAsBuffer(url);
      const edited = await grid.editImage(buffer, prompt);
      results.push(edited);
    }

    res.json({
      status: true,
      message: "✅ تم تعديل الصور بنجاح",
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الصورة",
      error: err.message,
    });
  }
});

export default router;

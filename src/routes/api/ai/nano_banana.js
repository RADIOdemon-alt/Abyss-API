import express from "express";
import axios from "axios";
import { fileTypeFromBuffer } from "file-type";

const router = express.Router();

/* 🧩 نفس الدالة اللي عطيتها — بدون تغيير حرف */
async function gptimage(prompt, buffer) {
  try {
    if (!prompt) throw new Error("Prompt is required.");
    if (!Buffer.isBuffer(buffer)) throw new Error("Image must be a buffer.");

    const { data } = await axios.post(
      "https://ghibli-proxy.netlify.app/.netlify/functions/ghibli-proxy",
      {
        image: "data:image/png;base64," + buffer.toString("base64"),
        prompt: prompt,
        model: "gpt-image-1",
        n: 1,
        size: "auto",
        quality: "low",
      },
      {
        headers: {
          origin: "https://overchat.ai",
          referer: "https://overchat.ai/",
          "user-agent": "Mozilla/5.0",
        },
      }
    );

    const result = data?.data?.[0]?.b64_json;
    if (!result) throw new Error("No result found.");

    return Buffer.from(result, "base64");
  } catch (error) {
    throw new Error(error.message);
  }
}

/* ------------------- 🧩 Helper لتحميل الصور ------------------- */
async function fetchBuffer(url) {
  const r = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(r.data);
}

/* ------------------- 🧠 ROUTES ------------------- */

/**
 * 🧩 POST /gptimg
 * body: { prompt: "اجعلها انمي", imageUrl: "https://xxx.jpg" }
 */
router.post("/", async (req, res) => {
  try {
    const { prompt, imageUrl } = req.body;

    if (!prompt)
      return res.status(400).json({
        status: false,
        message: "⚠️ النص مطلوب (prompt)",
      });

    if (!imageUrl)
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الصورة مطلوب (imageUrl)",
      });

    const buffer = await fetchBuffer(imageUrl);

    const resultBuffer = await gptimage(prompt, buffer);

    const base64 = resultBuffer.toString("base64");

    res.json({
      status: true,
      message: "✅ تم تعديل الصورة بنجاح",
      result: `data:image/jpeg;base64,${base64}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ خطأ أثناء معالجة الصورة",
      error: err.message,
    });
  }
});

/**
 * 🧩 GET /gptimg?prompt=اجعلها انمي&imageUrl=https://xx.jpg,https://yy.jpg
 */
router.get("/", async (req, res) => {
  try {
    const prompt = req.query.prompt;
    let imageUrl = req.query.imageUrl;

    if (!prompt)
      return res.status(400).json({ status: false, message: "⚠️ النص مطلوب (prompt)" });

    if (!imageUrl)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ رابط الصورة مطلوب (imageUrl)" });

    if (typeof imageUrl === "string") imageUrl = imageUrl.split(",");

    const results = [];

    for (const url of imageUrl) {
      const buffer = await fetchBuffer(url);
      const edited = await gptimage(prompt, buffer);
      results.push("data:image/jpeg;base64," + edited.toString("base64"));
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
      message: "❌ خطأ أثناء معالجة الصورة",
      error: err.message,
    });
  }
});

export default router;

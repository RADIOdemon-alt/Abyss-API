import express from "express";
import axios from "axios";
import crypto from "crypto";
import multer from "multer";
import uploadImage from "../lib/uploadImage.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 🧠 دالة الذكاء الاصطناعي (نفس منطق الاسكراب الأصلي)
async function processAIEdit(imageInput, prompt) {
  const visitorId = crypto.randomUUID();
  let imageUrl;

  // لو الصورة رابط مباشر
  if (/^https?:\/\//.test(imageInput)) {
    imageUrl = imageInput;
  } else {
    // لو الصورة مرفوعة (Buffer)
    imageUrl = await uploadImage(imageInput);
  }

  // 🔸 إنشاء المهمة (تم تصحيح صيغة البيانات)
  const createTask = await axios.post(
    "https://ai-image-editor.com/api/trpc/ai.createNanoBananaTask?batch=1",
    {
      0: {
        json: {
          imageUrls: [imageUrl],
          prompt,
          outputFormat: "png",
          imageSize: "auto",
          nVariants: 1,
        },
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    }
  );

  const taskId = createTask.data?.[0]?.result?.data?.json?.data?.taskId;
  if (!taskId) throw new Error("❌ فشل إنشاء المهمة.");

  // 🔁 متابعة النتيجة
  let resultUrl = null;
  while (!resultUrl) {
    const check = await axios.get(
      `https://ai-image-editor.com/api/trpc/ai.queryNanoBananaTask?batch=1&input=${encodeURIComponent(
        JSON.stringify({ 0: { json: { taskId, visitorId } } })
      )}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );

    const data = check.data?.[0]?.result?.data?.json?.data;
    if (data?.state === "success" && data?.resultUrls?.length) {
      resultUrl = data.resultUrls[0];
    } else if (data?.state === "failed") {
      throw new Error("❌ فشل في معالجة الصورة.");
    } else {
      await new Promise((r) => setTimeout(r, 2500));
    }
  }

  return resultUrl;
}

// 🌐 GET — معالجة عبر رابط مباشر
router.get("/", async (req, res) => {
  try {
    const { image, prompt } = req.query;
    if (!image || !prompt)
      return res.status(400).json({
        status: false,
        error: "⚠️ أرسل الصورة والوصف عبر ?image=الرابط&prompt=الوصف",
      });

    const result = await processAIEdit(image, prompt);
    res.json({
      status: true,
      creator: "Dark Team",
      data: { input: image, prompt, result },
    });
  } catch (err) {
    console.error("❌", err.message);
    res.status(500).json({ status: false, error: err.message });
  }
});

// 🌐 POST — معالجة عبر رفع الصورة (Form-Data)
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!req.file || !prompt)
      return res.status(400).json({
        status: false,
        error: "⚠️ أرسل الصورة مع الوصف في Form-Data (image, prompt)",
      });

    const result = await processAIEdit(req.file.buffer, prompt);
    res.json({
      status: true,
      creator: "Dark Team",
      data: { prompt, result },
    });
  } catch (err) {
    console.error("❌", err.message);
    res.status(500).json({ status: false, error: err.message });
  }
});

export default router;

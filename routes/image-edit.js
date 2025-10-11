import express from "express";
import axios from "axios";
import crypto from "crypto";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// 🧠 نفس منطق الاسكراب المستخدم في البوت
async function generateAIImage(imageInput, prompt) {
  const visitorId = crypto.randomUUID();
  let imageUrl;

  // 🔹 لو الصورة من رابط مباشر
  if (/^https?:\/\//.test(imageInput)) {
    imageUrl = imageInput;
  } else {
    // 🔹 لو الصورة مرفوعة (Buffer)
    const fileName = `${crypto.randomUUID()}.jpg`;
    const bucket = "ai-image-editor";
    const pathName = `original/${fileName}`;

    const signed = await axios.post(
      "https://ai-image-editor.com/api/trpc/uploads.signedUploadUrl?batch=1",
      [{ json: { bucket, path: pathName } }],
      { headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" } }
    );

    // ✅ استخراج رابط الرفع الصحيح
    const uploadUrl =
      signed.data?.[0]?.result?.data?.json?.data?.url ||
      signed.data?.[0]?.result?.data?.json?.url;
    if (!uploadUrl) throw new Error("❌ لم يتم الحصول على رابط الرفع.");

    await axios.put(uploadUrl, imageInput, {
      headers: { "Content-Type": "image/jpeg" },
    });

    imageUrl = `https://files.ai-image-editor.com/${pathName}`;
  }

  // 🔹 إنشاء المهمة
  const task = await axios.post(
    "https://ai-image-editor.com/api/trpc/ai.createNanoBananaTask?batch=1",
    [
      {
        json: {
          imageUrls: [imageUrl],
          prompt,
          outputFormat: "png",
          imageSize: "auto",
          nVariants: 1,
        },
      },
    ],
    { headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" } }
  );

  const taskId = task.data?.[0]?.result?.data?.json?.data?.taskId;
  if (!taskId) throw new Error("❌ لم يتم إنشاء المهمة.");

  // 🔁 الانتظار حتى النتيجة
  let resultUrl = null;
  while (!resultUrl) {
    const check = await axios.get(
      `https://ai-image-editor.com/api/trpc/ai.queryNanoBananaTask?batch=1&input=${encodeURIComponent(
        JSON.stringify([{ json: { taskId, visitorId } }])
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

// 🌐 GET — بالأسلوب: ?image=رابط&prompt=الوصف
router.get("/", async (req, res) => {
  try {
    const { image, prompt } = req.query;
    if (!image || !prompt)
      return res.status(400).json({
        status: false,
        error: "⚠️ أرسل الصورة والوصف: ?image=رابط&prompt=الوصف",
      });

    const result = await generateAIImage(image, prompt);
    res.json({
      status: true,
      creator: "Dark Team",
      data: { prompt, input: image, result },
    });
  } catch (err) {
    console.error("❌", err);
    res.status(500).json({ status: false, error: err.message });
  }
});

// 🌐 POST — لرفع الصورة مباشرة
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (!req.file || !prompt)
      return res.status(400).json({
        status: false,
        error: "⚠️ أرسل الصورة مع الوصف.",
      });

    const result = await generateAIImage(req.file.buffer, prompt);
    res.json({
      status: true,
      creator: "Dark Team",
      data: { prompt, result },
    });
  } catch (err) {
    console.error("❌", err);
    res.status(500).json({ status: false, error: err.message });
  }
});

export default router;

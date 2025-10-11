import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "tmp/" });

// 🧠 دالة إنشاء الصورة بالذكاء الاصطناعي
async function generateAIImage(imageInput, prompt) {
  const visitorId = crypto.randomUUID();
  let imageUrl;

  // إذا كانت الصورة رابط مباشر
  if (/^https?:\/\//.test(imageInput)) {
    imageUrl = imageInput;
  } else {
    // رفع الصورة أولاً إلى السيرفر الخارجي
    const filePath = path.resolve(imageInput);
    if (!fs.existsSync(filePath)) throw new Error("❌ لم يتم العثور على ملف الصورة.");

    const fileName = `${crypto.randomUUID()}.jpg`;
    const bucket = "ai-image-editor";
    const pathName = `original/${fileName}`;

    const signed = await axios.post(
      "https://ai-image-editor.com/api/trpc/uploads.signedUploadUrl?batch=1",
      [{ json: { bucket, path: pathName } }],
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    const uploadUrl = signed.data[0].result.data.json.url;
    const imgBuffer = fs.readFileSync(filePath);
    await axios.put(uploadUrl, imgBuffer, { headers: { "Content-Type": "image/jpeg" } });
    imageUrl = `https://files.ai-image-editor.com/${pathName}`;
  }

  // إنشاء المهمة
  const task = await axios.post(
    "https://ai-image-editor.com/api/trpc/ai.createNanoBananaTask?batch=1",
    [{ json: { imageUrls: [imageUrl], prompt, outputFormat: "png", imageSize: "auto", nVariants: 1 } }],
    { headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" } }
  );

  const taskId = task.data[0].result.data.json.data.taskId;
  let resultUrl = null;

  // الانتظار حتى تكتمل المهمة
  while (!resultUrl) {
    const check = await axios.get(
      `https://ai-image-editor.com/api/trpc/ai.queryNanoBananaTask?batch=1&input=${encodeURIComponent(
        JSON.stringify([{ json: { taskId, visitorId } }])
      )}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );

    const data = check.data[0].result.data.json.data;
    if (data.state === "success" && data.resultUrls?.length) {
      resultUrl = data.resultUrls[0];
    } else {
      await new Promise((r) => setTimeout(r, 2500));
    }
  }

  return resultUrl;
}

// ⬇️ مسار GET (رابط مباشر)
router.get("/", async (req, res) => {
  try {
    const { image, prompt } = req.query;
    if (!image || !prompt)
      return res.status(400).json({
        status: false,
        error: "⚠️ يجب إرسال الصورة والوصف، مثال: ?image=رابط&prompt=اجعلها أنمي",
      });

    const result = await generateAIImage(image, prompt);
    if (!result)
      return res.status(500).json({ status: false, error: "❌ لم يتم الحصول على نتيجة." });

    res.json({
      status: true,
      creator: "Dark Team",
      data: { prompt, input: image, result },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: err.message });
  }
});

// ⬇️ مسار POST (رفع ملف من الجهاز)
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const prompt = req.body.prompt;
    if (!req.file || !prompt)
      return res.status(400).json({ status: false, error: "⚠️ أرسل الصورة مع الوصف." });

    const result = await generateAIImage(req.file.path, prompt);
    fs.unlinkSync(req.file.path); // حذف الملف المؤقت بعد المعالجة

    res.json({
      status: true,
      creator: "Dark Team",
      data: { prompt, result },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, error: err.message });
  }
});

export default router;

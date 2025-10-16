import express from "express";
import axios from "axios";

const router = express.Router();

/* 🧩 قائمة الموديلات المدعومة */
const modelsMap = {
  "img": "flux-1-dev",
  "realistic": "flux-1-realistic",
  "fantasy": "flux-1-fantasy",
  "cyberpunk": "flux-1-cyberpunk",
  "anime": "flux-1-anime",
  "cartoon": "flux-1-cartoon",
  "cinematic": "flux-1-cinematic",
  "pixels": "flux-1-pixel",
  "artistic": "flux-1-artistic",
  "vintage": "flux-1-vintage",
  "portrait": "flux-1-portrait",
  "modern": "flux-1-modern",
  "surreal": "flux-1-surreal",
  "sketch": "flux-1-sketch",
  "watercolor": "flux-1-watercolor"
};

/* 🌍 الترجمة التلقائية للعربية → الإنجليزية */
const translateText = async (text) => {
  try {
    const res = await axios.get(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|en`
    );
    return res.data.responseData.translatedText;
  } catch {
    return text;
  }
};

/* 🎨 دالة توليد الصورة */
async function generateImage(prompt, model) {
  // ترجم النص إذا كان عربيًا
  if (/[\u0600-\u06FF]/.test(prompt)) {
    prompt = await translateText(prompt);
  }

  const deviceId = `dev-${Math.floor(Math.random() * 1000000)}`;
  const modelName = modelsMap[model] || modelsMap["img"];

  const response = await axios.post(
    `https://api-preview.chatgot.io/api/v1/deepimg/${modelName}`,
    {
      prompt,
      size: "1024x1024",
      device_id: deviceId
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://deepimg.ai",
        "Referer": "https://deepimg.ai/"
      }
    }
  );

  const data = response.data;
  if (data?.data?.images?.length > 0) {
    return data.data.images[0].url;
  } else {
    throw new Error("فشل في توليد الصورة.");
  }
}

/* 🚀 GET Route */
router.get("/", async (req, res) => {
  try {
    const { prompt, model = "img" } = req.query;
    if (!prompt)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ النص المطلوب (prompt) مفقود" });

    const imageUrl = await generateImage(prompt, model);

    res.json({
      status: true,
      message: "✅ تم توليد الصورة بنجاح",
      model,
      prompt,
      imageUrl
    });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res
      .status(500)
      .json({
        status: false,
        message: "❌ حدث خطأ أثناء توليد الصورة",
        error: err.message
      });
  }
});

/* 🚀 POST Route */
router.post("/", async (req, res) => {
  try {
    const { prompt, model = "img" } = req.body;
    if (!prompt)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ النص المطلوب (prompt) مفقود" });

    const imageUrl = await generateImage(prompt, model);

    res.json({
      status: true,
      message: "✅ تم توليد الصورة بنجاح",
      model,
      prompt,
      imageUrl
    });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res
      .status(500)
      .json({
        status: false,
        message: "❌ حدث خطأ أثناء توليد الصورة",
        error: err.message
      });
  }
});

export default router;
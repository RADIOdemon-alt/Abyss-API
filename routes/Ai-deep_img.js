import express from "express";
import axios from "axios";

const router = express.Router();

// قائمة الأنماط
let stylesMap = {
  "1": "realistic", "2": "fantasy", "3": "cyberpunk", "4": "anime", "5": "cartoon",
  "6": "photorealistic", "7": "cinematic", "8": "artistic", "9": "vintage", "10": "futuristic",
  "11": "dark", "12": "minimalist", "13": "concept art", "14": "portrait", "15": "steampunk",
  "16": "surreal", "17": "impressionist", "18": "expressionist", "19": "modern", "20": "baroque",
  "21": "pixel art", "22": "sketch", "23": "watercolor"
};

// دالة الترجمة
const translateText = async (text) => {
  try {
    const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|en`);
    return res.data.responseData.translatedText;
  } catch (error) {
    console.error('خطأ أثناء الترجمة:', error);
    return text;
  }
};

async function generateImage(prompt, style) {
  // إذا النص بالعربية يتم ترجمته
  if (/[\u0600-\u06FF]/.test(prompt)) {
    prompt = await translateText(prompt);
  }

  const deviceId = `dev-${Math.floor(Math.random() * 1000000)}`;

  const response = await axios.post('https://api-preview.chatgot.io/api/v1/deepimg/flux-1-dev', {
    prompt: `${prompt} -style ${style}`,
    size: "1024x1024",
    device_id: deviceId
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://deepimg.ai',
      'Referer': 'https://deepimg.ai/',
    }
  });

  const data = response.data;
  if (data?.data?.images?.length > 0) {
    return data.data.images[0].url;
  } else {
    throw new Error('فشل في توليد الصورة.');
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    let { prompt, styleNumber } = req.body;
    if (!prompt) return res.status(400).json({ status: false, message: "⚠️ النص المطلوب (prompt)" });

    let style = stylesMap[styleNumber] || "realistic";

    const imageUrl = await generateImage(prompt, style);

    res.json({ status: true, message: "✅ تم توليد الصورة بنجاح", prompt, style, imageUrl });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء توليد الصورة", error: err.message });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    let { prompt, styleNumber } = req.query;
    if (!prompt) return res.status(400).json({ status: false, message: "⚠️ النص المطلوب (prompt)" });

    let style = stylesMap[styleNumber] || "realistic";

    const imageUrl = await generateImage(prompt, style);

    res.json({ status: true, message: "✅ تم توليد الصورة بنجاح", prompt, style, imageUrl });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء توليد الصورة", error: err.message });
  }
});

export default router;
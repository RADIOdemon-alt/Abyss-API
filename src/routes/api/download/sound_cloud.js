import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const router = express.Router();

// 🔊 دالة تحميل الصوت من SoundCloud
async function fetchSoundCloud(url) {
  if (!url || !url.includes("soundcloud.com")) {
    throw new Error("⚠️ الرابط غير صالح. أرسل رابط SoundCloud صحيح مع الباراميتر url.");
  }

  const form = new FormData();
  form.append("url", url);
  form.append("token", "");

  const response = await fetch("https://scdler.com/wp-json/aio-dl/video-data/", {
    method: "POST",
    body: form,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Referer": "https://scdler.com/ar/soundcloud-downloader/",
      "Origin": "https://scdler.com",
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
    },
  });

  const json = await response.json();

  if (!json || !json.medias || json.medias.length === 0) {
    throw new Error("❌ فشل التحميل، لم يتم العثور على ملف صوت.");
  }

  const media = json.medias[0];
  return {
    title: json.title || "مقطع صوتي",
    quality: media.quality || "صوت",
    size: media.size || "غير معروف",
    audioUrl: media.url,
    thumbnail: json.thumbnail || null,
  };
}

// 🔹 GET 
router.get("/", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({
    status: false,
    message: "ارسل رابط ساوند كلاوند مع url=\nمثل\n\nhttps://dark-api-x.vercel.app/api/v1/download/sound_cloud?url=https://soundcloud.com/scythermane/funk-de-beleza-slowedbelezaslowed"
  });

  try {
    const result = await fetchSoundCloud(url);
    res.json({ status: true, ...result, message: "✅ تم العثور على الصوت بنجاح" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

// 🔹 POST 
router.post("/", async (req, res) => {
  const url = req.body.url;
  if (!url) return res.status(400).json({
    status: false,
    message: "📌 أرسل رابط SoundCloud في body: { url: '...' }"
  });

  try {
    const result = await fetchSoundCloud(url);
    res.json({ status: true, ...result, message: "✅ تم العثور على الصوت بنجاح" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

export default router;

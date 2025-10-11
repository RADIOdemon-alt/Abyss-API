import express from "express";
import axios from "axios";
import crypto from "crypto";

const router = express.Router();

// 🧠 كاش بسيط في الذاكرة
const cache = new Map();
const CACHE_TIME = 1000 * 60 * 10; // 10 دقائق

const savetube = {
  api: {
    base: "https://media.savetube.me/api",
    cdn: "/random-cdn",
    info: "/v2/info",
    download: "/download",
  },
  headers: {
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://yt.savetube.me",
    referer: "https://yt.savetube.me/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },

  // 🎬 الجودات الافتراضية
  formats: {
    video: ["144", "240", "360", "480", "720", "1080", "1440", "2160"],
    audio: ["mp3", "m4a", "webm"],
  },

  crypto: {
    hexToBuffer: (hexString) => {
      const matches = hexString.match(/.{1,2}/g);
      return Buffer.from(matches.join(""), "hex");
    },
    decrypt: async (enc) => {
      const secretKey = "C5D58EF67A7584E4A29F6C35BBC4EB12";
      const data = Buffer.from(enc, "base64");
      const iv = data.slice(0, 16);
      const content = data.slice(16);
      const key = savetube.crypto.hexToBuffer(secretKey);
      const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
      let decrypted = decipher.update(content);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return JSON.parse(decrypted.toString());
    },
  },

  youtube: (url) => {
    const patterns = [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    ];
    for (let pattern of patterns) {
      if (pattern.test(url)) return url.match(pattern)[1];
    }
    return null;
  },

  request: async (endpoint, data = {}, method = "post") => {
    const { data: response } = await axios({
      method,
      url: `${endpoint.startsWith("http") ? "" : savetube.api.base}${endpoint}`,
      data: method === "post" ? data : undefined,
      params: method === "get" ? data : undefined,
      headers: savetube.headers,
    });
    return response;
  },

  getCDN: async () => {
    const { data } = await axios.get(`${savetube.api.base}${savetube.api.cdn}`, {
      headers: savetube.headers,
    });
    return data.cdn;
  },

  download: async (link, format = "720") => {
    if (!link) throw new Error("❌ يرجى إدخال رابط الفيديو.");
    const id = savetube.youtube(link);
    if (!id) throw new Error("❌ تعذر استخراج معرف الفيديو.");

    // 🔁 تحقق من الكاش
    const cacheKey = `${id}_${format}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TIME) {
      return { ...cached.data, cached: true };
    }

    const cdn = await savetube.getCDN();

    const info = await savetube.request(`https://${cdn}${savetube.api.info}`, {
      url: `https://www.youtube.com/watch?v=${id}`,
    });
    const decrypted = await savetube.crypto.decrypt(info.data);

    // 🧩 استخراج الجودات المتاحة فعلاً
    const available = decrypted?.links
      ? decrypted.links.map((v) => ({
          quality: v.quality,
          type: v.mimeType.includes("audio") ? "audio" : "video",
        }))
      : [];

    const isAudio = savetube.formats.audio.includes(format.toLowerCase());

    // 🔍 البحث عن أقرب جودة متاحة
    let targetQuality = format;
    if (!isAudio) {
      const availableQualities = available
        .filter((v) => v.type === "video")
        .map((v) => parseInt(v.quality));
      const requested = parseInt(format);
      if (availableQualities.length > 0 && !availableQualities.includes(requested)) {
        const fallback = [...availableQualities].sort((a, b) => a - b).filter((q) => q <= requested);
        targetQuality = fallback.length ? fallback.pop().toString() : availableQualities[0].toString();
      }
    }

    const dl = await savetube.request(`https://${cdn}${savetube.api.download}`, {
      id: id,
      downloadType: isAudio ? "audio" : "video",
      quality: isAudio ? "128" : targetQuality,
      key: decrypted.key,
    });

    const result = {
      title: decrypted.title,
      thumbnail: decrypted.thumbnail || `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
      download: dl.data.data.downloadUrl,
      format: targetQuality,
      type: isAudio ? "audio" : "video",
      duration: decrypted.duration,
      id,
      quality_selected: targetQuality,
      available_qualities: available.length ? available : "لم تُكتشف جودات من المصدر",
    };

    // 💾 تخزين في الكاش
    cache.set(cacheKey, { time: Date.now(), data: result });

    return result;
  },
};

// ✅ POST /api/youtube
router.post("/", async (req, res) => {
  try {
    const { url, format = "720" } = req.body;
    if (!url)
      return res.status(400).json({
        status: false,
        creator: "Anas radio",
        message: "⚠️ أرسل الرابط في body مثل { url: '...', format: '720' }",
      });

    const result = await savetube.download(url, format);
    res.status(200).json({
      status: true,
      creator: "Anas radio",
      result,
      default_formats: savetube.formats,
    });
  } catch (err) {
    res.status(500).json({ status: false, creator: "Anas radio", error: err.message });
  }
});

// ✅ GET /api/youtube
router.get("/", async (req, res) => {
  const { url, format = "720" } = req.query;
  if (url) {
    try {
      const result = await savetube.download(url, format);
      return res.status(200).json({
        status: true,
        creator: "Anas radio",
        result,
        default_formats: savetube.formats,
      });
    } catch (err) {
      return res.status(500).json({ status: false, creator: "Anas radio", error: err.message });
    }
  }

  // لو مفيش url
  res.json({
    status: true,
    creator: "Anas radio",
    message:
      "🎥 أرسل POST إلى هذا الرابط مع { url: 'رابط الفيديو', format: '720' } أو استخدم GET بـ ?url=",
    default_formats: savetube.formats,
  });
});

export default router;

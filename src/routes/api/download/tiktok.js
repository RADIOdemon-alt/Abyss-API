import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

const ttsave = {
  api: {
    base: "https://ttsave.app",
    endpoint: "/download",
  },
  headers: {
    authority: "ttsave.app",
    accept: "application/json, text/plain, */*",
    origin: "https://ttsave.app",
    referer: "https://ttsave.app/en",
    "user-agent": "Postify/1.0.0",
  },

  isUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  expandURL: async (url) => {
    try {
      const res = await axios.head(url, { maxRedirects: 5 });
      return res.request.res.responseUrl || url;
    } catch (e) {
      console.warn("⚠️ فشل في توسيع الرابط:", e.message);
      return url;
    }
  },

  request: async (url, data) => {
    try {
      const response = await axios.post(url, data, { headers: ttsave.headers });
      return { status: true, data: response.data };
    } catch (e) {
      return {
        status: false,
        error: e.response?.statusText || e.message || "خطأ أثناء الاتصال",
      };
    }
  },

  parseHTML: ($) => {
    const nickname = $("h2.font-extrabold").text() || "-";
    const username = $("a.font-extrabold.text-blue-400").text() || "-";
    const description = $("p.text-gray-600").text() || "-";

    const nowm = $("a.w-full.text-white.font-bold").first().attr("href");
    const wm = $("a.w-full.text-white.font-bold").eq(1).attr("href");
    const audio = $("a[type='audio']").attr("href");
    const slides = $("a[type='slide']")
      .map((i, el) => $(el).attr("href"))
      .get();

    return {
      nickname,
      username,
      description,
      nowm,
      wm,
      audio,
      slides,
    };
  },

  download: async (url) => {
    if (!ttsave.isUrl(url))
      return { status: false, error: "الرابط غير صالح." };

    try {
      const expanded = await ttsave.expandURL(url);
      const fullUrl = `${ttsave.api.base}${ttsave.api.endpoint}`;
      const response = await ttsave.request(fullUrl, {
        query: expanded,
        language_id: "1",
      });

      if (!response.status)
        return { status: false, error: "تعذر الاتصال بالموقع." };

      const $ = cheerio.load(response.data);
      const parsed = ttsave.parseHTML($);

      const type = parsed.slides?.length ? "slide" : "video";

      return {
        status: true,
        data: {
          type,
          title: parsed.description || "-",
          author: `${parsed.nickname} (${parsed.username})`,
          thumbnail:
            parsed.nowm || parsed.wm
              ? parsed.nowm
              : "https://ttsave.app/static/favicon.ico",
          download: parsed.nowm || parsed.wm || null,
          audio: parsed.audio || null,
          slides: parsed.slides || [],
        },
      };
    } catch (error) {
      return {
        status: false,
        error: error.message || "حدث خطأ غير متوقع أثناء التحميل.",
      };
    }
  },
};

// ⚙️ API Endpoint
router.get("/", async (req, res) => {
  const url = req.query.url;
  if (!url)
    return res.status(400).json({
      status: false,
      error: "📌 أرسل رابط فيديو من TikTok مثل:\n/api/tiktok?url=https://www.tiktok.com/@user/video/1234567890",
    });

  try {
    const result = await ttsave.download(url);
    if (!result.status) return res.status(500).json(result);

    res.json({
      status: true,
      creator: "Dark-Team",
      data: result.data,
    });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

export default router;

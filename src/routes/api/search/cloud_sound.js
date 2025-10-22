import express from "express";
import axios from "axios";

const router = express.Router();

class SoundCloudAPI {
  constructor() {
    this.clientId = "KKzJxmw11tYpCs6T24P4uUYhqmjalG6M";
    this.baseURL = "https://api-mobi.soundcloud.com";
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; 22120RN86G Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.155 Mobile Safari/537.36",
      Accept: "application/json, text/javascript, */*; q=0.1",
      "Content-Type": "application/json",
      Origin: "https://m.soundcloud.com",
      Referer: "https://m.soundcloud.com/",
      "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
    };
  }

  /** 🔍 البحث عن مقاطع صوتية */
  async search(query, limit = 10) {
    const url = `${this.baseURL}/search`;
    const params = {
      q: query,
      client_id: this.clientId,
      limit: limit,
      stage: "",
    };
    const { data } = await axios.get(url, {
      params,
      headers: this.headers,
    });
    return this.formatResults(data);
  }

  /** 🧩 تنسيق نتائج البحث */
  formatResults(data) {
    if (!data.collection || data.collection.length === 0) return [];

    return data.collection
      .filter((item) => item.kind === "track")
      .map((track) => ({
        id: track.id,
        title: track.title,
        genre: track.genre,
        duration: this.formatDuration(track.duration),
        likes: this.formatNumber(track.likes_count),
        plays: this.formatNumber(track.playback_count),
        artist: track.user?.username || "مجهول",
        artwork: track.artwork_url?.replace("large", "t500x500") || null,
        link: track.permalink_url,
      }));
  }

  /** 🕒 تحويل المدة */
  formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  /** 🔢 تنسيق الأرقام */
  formatNumber(num) {
    if (!num) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ يجب إدخال كلمة البحث (query)" });

    const soundcloud = new SoundCloudAPI();
    const results = await soundcloud.search(query, 10);

    if (!results.length)
      return res.json({
        status: false,
        message: "❌ لم يتم العثور على نتائج في SoundCloud",
      });

    res.json({
      status: true,
      message: "✅ تم العثور على النتائج بنجاح",
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث في SoundCloud",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ يجب إدخال كلمة البحث (query)" });

    const soundcloud = new SoundCloudAPI();
    const results = await soundcloud.search(query, 10);

    if (!results.length)
      return res.json({
        status: false,
        message: "❌ لم يتم العثور على نتائج في SoundCloud",
      });

    res.json({
      status: true,
      message: "✅ تم العثور على النتائج بنجاح",
      results,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث في SoundCloud",
      error: err.message,
    });
  }
});

export default router;

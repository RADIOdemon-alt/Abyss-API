// routes/spotify.js
import express from "express";
import axios from "axios";

const router = express.Router();

class SpotifyAPI {
  constructor() {
    this.clientId = "cda875b7ec6a4aeea0c8357bfdbab9c2";
    this.clientSecret = "c2859b35c5164ff7be4f979e19224dbe";
    this.tokenUrl = "https://accounts.spotify.com/api/token";
    this.searchUrl = "https://api.spotify.com/v1/search";
    this.downloadUrl = "https://dark-api-one.vercel.app/api/spotifydl";
  }

  /** 🪙 الحصول على توكن Spotify */
  async getToken() {
    const encoded = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");

    const res = await axios.post(this.tokenUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${encoded}`,
      },
    });

    return res.data.access_token;
  }

  /** 🔍 البحث عن أغنية */
  async searchTrack(query) {
    const token = await this.getToken();
    const res = await axios.get(this.searchUrl, {
      params: {
        q: query,
        type: "track",
        limit: 1,
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const track = res.data.tracks.items[0];
    if (!track) throw new Error("⚠️ لم يتم العثور على أي نتائج.");
    return track.external_urls.spotify;
  }

  /** 🎵 تحميل الأغنية من API خارجي */
  async downloadTrack(queryOrLink) {
    const res = await axios.get(this.downloadUrl, {
      params: { query: queryOrLink },
    });
    return res.data;
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query)
      return res.status(400).json({ status: false, message: "⚠️ أرسل اسم الأغنية أو رابط Spotify." });

    const spotify = new SpotifyAPI();
    const data = await spotify.downloadTrack(query);
    const { status, result, message, error } = data;

    if (!status)
      return res.status(500).json({ status: false, message: error || message || "❌ فشل التحميل." });

    res.json({
      status: true,
      message: "✅ تم التحميل بنجاح",
      result: {
        title: result.title,
        artist: result.artist,
        album: result.album,
        duration: result.duration,
        image: result.image,
        link: result.link,
        download: result.download,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الطلب.",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query)
      return res.status(400).json({ status: false, message: "⚠️ أرسل اسم الأغنية أو رابط Spotify." });

    const spotify = new SpotifyAPI();
    const data = await spotify.downloadTrack(query);
    const { status, result, message, error } = data;

    if (!status)
      return res.status(500).json({ status: false, message: error || message || "❌ فشل التحميل." });

    res.json({
      status: true,
      message: "✅ تم التحميل بنجاح",
      result: {
        title: result.title,
        artist: result.artist,
        album: result.album,
        duration: result.duration,
        image: result.image,
        link: result.link,
        download: result.download,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الطلب.",
      error: err.message,
    });
  }
});

export default router;
// routes/spotify.js
import express from "express";
import axios from "axios";

const router = express.Router();

class SpotifyAPI {
  constructor() {
    // أنصح بنقل هذه القيم إلى متغيرات بيئة (process.env)
    this.clientId = process.env.SPOTIFY_CLIENT_ID || "cda875b7ec6a4aeea0c8357bfdbab9c2";
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "c2859b35c5164ff7be4f979e19224dbe";
    this.tokenUrl = "https://accounts.spotify.com/api/token";
    this.trackUrl = "https://api.spotify.com/v1/tracks";
    this.downloadUrl = "https://dark-api-one.vercel.app/api/spotifydl"; // واجهة خارجية لتحويل الرابط إلى ملف
    this.axiosOptions = { timeout: 15000 };
  }

  // استخراج معرف الـ track من رابط Spotify
  extractTrackId(input) {
    if (!input) return null;
    const url = input.trim();
    // رابط web
    let m = url.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
    if (m) return m[1];
    // URI
    m = url.match(/spotify:track:([A-Za-z0-9]+)/);
    if (m) return m[1];
    // احتمالات أخرى (query param)
    m = url.match(/track=([A-Za-z0-9]+)/);
    if (m) return m[1];
    return null;
  }

  async getToken() {
    const encoded = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");

    const res = await axios.post(this.tokenUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${encoded}`,
      },
      ...this.axiosOptions,
    });
    return res.data.access_token;
  }

  async fetchTrackMetadata(trackId) {
    const token = await this.getToken();
    const res = await axios.get(`${this.trackUrl}/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` },
      ...this.axiosOptions,
    });
    return res.data; // يحتوي على name, artists, album, images, duration_ms ...
  }

  // طلب الـ downloader الخارجي باستخدام رابط كامل إلى track
  async downloadTrackByUrl(trackUrl) {
    const res = await axios.get(this.downloadUrl, {
      params: { url: trackUrl },
      ...this.axiosOptions,
    });

    if (res.status !== 200) {
      throw new Error(`Downloader returned status ${res.status}`);
    }
    const data = res.data;
    if (!data || data.status !== true) {
      throw new Error(data?.error || data?.message || "الـ downloader لم يعد بنجاح.");
    }
    return data;
  }
}

/** POST */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ status: false, message: "⚠️ أرسل رابط أغنية Spotify مباشر في الحقل 'query'." });
    }

    const api = new SpotifyAPI();
    const trackId = api.extractTrackId(query);
    if (!trackId) {
      return res.status(400).json({ status: false, message: "⚠️ الرابط غير صحيح. أرسل رابطًا مثل:\nhttps://open.spotify.com/track/{trackId}" });
    }

    const trackUrl = `https://open.spotify.com/track/${trackId}`;

    // metadata (اختياري — مفيد للرد بالبيانات)
    let metadata = null;
    try {
      metadata = await api.fetchTrackMetadata(trackId);
    } catch (e) {
      // لا نفشل العملية بالكامل إن فشل جلب الميتاداتا — لكن نسجل الخطأ
      console.warn("Failed to fetch Spotify metadata:", e.message);
    }

    // استدعاء الـ downloader الخارجي
    const dl = await api.downloadTrackByUrl(trackUrl);
    const result = dl.result || dl.data || {};

    res.json({
      status: true,
      message: "✅ تم تجهيز بيانات الأغنية بنجاح",
      result: {
        title: result.title || metadata?.name || null,
        artist: result.artist || (metadata?.artists?.map(a => a.name).join(", ") || null),
        album: result.album || metadata?.album?.name || null,
        duration: result.duration || metadata?.duration_ms || null,
        image: result.image || metadata?.album?.images?.[0]?.url || null,
        link: trackUrl,
        download: result.download || result.url || null,
        raw: result,
      },
    });
  } catch (err) {
    console.error("routes/spotify error:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الطلب.",
      error: err.message || String(err),
    });
  }
});

/** GET */
router.get("/", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ status: false, message: "⚠️ أرسل رابط أغنية Spotify في باراميتر 'query'." });
    }

    const api = new SpotifyAPI();
    const trackId = api.extractTrackId(query);
    if (!trackId) {
      return res.status(400).json({ status: false, message: "⚠️ الرابط غير صحيح. أرسل رابطًا مثل:\nhttps://open.spotify.com/track/{trackId}" });
    }

    const trackUrl = `https://open.spotify.com/track/${trackId}`;

    let metadata = null;
    try {
      metadata = await api.fetchTrackMetadata(trackId);
    } catch (e) {
      console.warn("Failed to fetch Spotify metadata:", e.message);
    }

    const dl = await api.downloadTrackByUrl(trackUrl);
    const result = dl.result || dl.data || {};

    res.json({
      status: true,
      message: "✅ تم تجهيز بيانات الأغنية بنجاح",
      result: {
        title: result.title || metadata?.name || null,
        artist: result.artist || (metadata?.artists?.map(a => a.name).join(", ") || null),
        album: result.album || metadata?.album?.name || null,
        duration: result.duration || metadata?.duration_ms || null,
        image: result.image || metadata?.album?.images?.[0]?.url || null,
        link: trackUrl,
        download: result.download || result.url || null,
        raw: result,
      },
    });
  } catch (err) {
    console.error("routes/spotify GET error:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الطلب.",
      error: err.message || String(err),
    });
  }
});

export default router;
// routes/spotifydl.js
import express from "express";
import axios from "axios";

const router = express.Router();

class SpotifyAPI {
  constructor() {
    this.clientId = "cda875b7ec6a4aeea0c8357bfdbab9c2";
    this.clientSecret = "c2859b35c5164ff7be4f979e19224dbe";
    this.tokenUrl = "https://accounts.spotify.com/api/token";
    this.searchUrl = "https://api.spotify.com/v1/search";
    this.trackUrl = "https://api.spotify.com/v1/tracks";
    // نستخدم parsevideoapi.videosolo.com فقط
    this.parseApi = "https://parsevideoapi.videosolo.com/spotify-api/";
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  /** احصل على توكن Spotify مع caching بسيط */
  async getToken() {
    const now = Date.now();
    if (this._token && now < this._tokenExpiresAt) return this._token;

    const encoded = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await axios.post(
      this.tokenUrl,
      "grant_type=client_credentials",
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${encoded}`,
        },
        timeout: 10000,
      }
    );

    const token = res.data.access_token;
    const expiresIn = res.data.expires_in || 3600;
    this._token = token;
    this._tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
    return token;
  }

  /** استخراج id من رابط أو من input */
  static extractId(input) {
    if (!input) return null;
    const patterns = [
      /open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/,
      /spotify\.com\/track\/([a-zA-Z0-9]{22})/,
      /spotify:track:([a-zA-Z0-9]{22})/,
      /^([a-zA-Z0-9]{22})$/
    ];
    for (const p of patterns) {
      const m = input.match(p);
      if (m) return m[1];
    }
    return null;
  }

  /** ابحث عن مسار — أو أعد الرابط لو هو track link / id */
  async searchTrack(query) {
    if (!query) throw new Error("No query provided");
    if (query.includes("spotify.com/track") || SpotifyAPI.extractId(query)) {
      return query.trim();
    }

    const token = await this.getToken();
    const res = await axios.get(`${this.searchUrl}?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    const track = res.data.tracks?.items?.[0];
    if (!track) throw new Error("⚠️ لم يتم العثور على أي نتائج.");
    return track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
  }

  /**
   * استخلاص بيانات التحميل من parsevideoapi.videosolo.com
   * ترجع بنية موحدة: { status: true|false, result?, error? }
   */
  async downloadTrack(link) {
    if (!link) throw new Error("No link provided");

    const maybeId = SpotifyAPI.extractId(link);
    const fullLink = maybeId ? `https://open.spotify.com/track/${maybeId}` : link;

    try {
      const resp = await axios.post(
        this.parseApi,
        { format: 'web', url: fullLink },
        {
          headers: {
            'authority': 'parsevideoapi.videosolo.com',
            'user-agent': 'Postify/1.0.0',
            'referer': 'https://spotidown.online/',
            'origin': 'https://spotidown.online',
            'content-type': 'application/json'
          },
          timeout: 20000
        }
      );

      const body = resp.data;
      if (!body) {
        return { status: false, code: 502, error: "فشل في استلام استجابة من خدمة التحويل" };
      }

      if (body.status === "-4") {
        return { status: false, code: 400, error: "الرابط غير مدعوم. فقط المسارات (Tracks) مسموحة" };
      }

      const metadata = body.data?.metadata;
      if (!metadata) {
        return { status: false, code: 404, error: "لم يتم العثور على معلومات عن المسار في خدمة التحويل" };
      }

      if (!metadata.download) {
        return { status: false, code: 422, error: "الخدمة لم ترجع رابط تحميل مباشر" };
      }

      return {
        status: true,
        code: 200,
        result: {
          title: metadata.name,
          artist: metadata.artist,
          album: metadata.album,
          duration: metadata.duration,
          image: metadata.image,
          download: metadata.download,
          trackId: maybeId || metadata.id || null
        }
      };
    } catch (err) {
      console.error("parsevideoapi error:", err?.message || err);
      return {
        status: false,
        code: err.response?.status || 500,
        error: "❗ فشل في استخراج رابط التحميل من الخدمة الخارجية"
      };
    }
  }
}

/** POST route */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ status: false, message: "⚠️ أرسل اسم الأغنية أو رابط Spotify." });

    const spotify = new SpotifyAPI();
    const link = query.includes("spotify.com/track") || SpotifyAPI.extractId(query)
      ? query.trim()
      : await spotify.searchTrack(query);

    const data = await spotify.downloadTrack(link);
    if (!data || data.status !== true) {
      // إرجاع رسالة موحدة كما طلبت
      return res.status(502).json({ success: false, message: data?.error || '❗ فشل في استخراج رابط التحميل من الخدمة الخارجية' });
    }

    const r = data.result;
    res.json({
      status: true,
      message: "✅ تم التحميل بنجاح",
      result: {
        title: r.title,
        artist: r.artist,
        album: r.album,
        duration: r.duration,
        image: r.image,
        link,
        download: r.download,
        trackId: r.trackId
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الطلب.",
      error: err.message
    });
  }
});

/** GET route (query param) */
router.get("/", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ status: false, message: "⚠️ أرسل اسم الأغنية أو رابط Spotify." });

    const spotify = new SpotifyAPI();
    const link = query.includes("spotify.com/track") || SpotifyAPI.extractId(query)
      ? query.trim()
      : await spotify.searchTrack(query);

    const data = await spotify.downloadTrack(link);
    if (!data || data.status !== true) {
      return res.status(502).json({ success: false, message: data?.error || '❗ فشل في استخراج رابط التحميل من الخدمة الخارجية' });
    }

    const r = data.result;
    res.json({
      status: true,
      message: "✅ تم التحميل بنجاح",
      result: {
        title: r.title,
        artist: r.artist,
        album: r.album,
        duration: r.duration,
        image: r.image,
        link,
        download: r.download,
        trackId: r.trackId
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الطلب.",
      error: err.message
    });
  }
});

export default router;
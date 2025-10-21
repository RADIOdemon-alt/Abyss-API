mport express from "express";
import axios from "axios";

const router = express.Router();

class SpotifyAPI {
  constructor() {
    this.base = "https://spotisaver.net";
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      Accept: "application/json",
    };
  }

  parseUrl(input) {
    if (!input) throw new Error("⚠️ رابط Spotify مفقود");
    const url = input.trim();

    console.log("🔍 تحليل الرابط:", url);

    if (url.includes("spotify.link")) {
      throw new Error(
        "⚠️ الروابط المختصرة (spotify.link) غير مدعومة حالياً. استخدم open.spotify.com"
      );
    }

    const trackMatch = url.match(/\/track\/([a-zA-Z0-9]+)/);
    if (trackMatch) {
      const id = trackMatch[1];
      console.log("✅ Track ID:", id);
      return { id, type: "track", referer: `${this.base}/en/track/${id}/` };
    }

    const playlistMatch = url.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (playlistMatch) {
      const id = playlistMatch[1];
      console.log("✅ Playlist ID:", id);
      return { id, type: "playlist", referer: `${this.base}/en/playlist/${id}/` };
    }

    const albumMatch = url.match(/\/album\/([a-zA-Z0-9]+)/);
    if (albumMatch) {
      const id = albumMatch[1];
      console.log("✅ Album ID (treated as playlist):", id);
      return { id, type: "playlist", referer: `${this.base}/en/playlist/${id}/` };
    }

    throw new Error(
      "❌ رابط Spotify غير صالح. الروابط المدعومة: /track/, /playlist/, /album/"
    );
  }

  async getInfo(url) {
    console.log("🔄 جلب معلومات من spotisaver...");
    const { id, type, referer } = this.parseUrl(url);
    const apiUrl = `${this.base}/api/get_playlist.php?id=${id}&type=${type}&lang=en`;
    console.log("📡 API URL:", apiUrl);
    try {
      const res = await axios.get(apiUrl, {
        headers: { ...this.headers, Referer: referer },
        timeout: 20000,
      });

      console.log("📥 status:", res.status);
      // console.log("📊 data:", JSON.stringify(res.data, null, 2));

      if (!res.data || res.data.error) {
        throw new Error(res.data?.error || "فشل الحصول على بيانات من spotisaver");
      }

      const tracks = res.data.tracks || [];
      if (!tracks.length) throw new Error("لم يتم العثور على مسارات في الرابط.");

      console.log("✅ عدد المسارات:", tracks.length);
      return { tracks, type, id };
    } catch (err) {
      if (err.response) {
        console.error("❌ خطأ من API:", err.response.status);
        try {
          console.error("Data:", JSON.stringify(err.response.data));
        } catch (e) {}
        // تعامُل خاص بحالة 403
        if (err.response.status === 403) {
          throw new Error("Forbidden (403) — قد تمنع Spotisaver طلبك (تحتاج Headers أو Proxy).");
        }
      }
      throw err;
    }
  }

  async downloadTrack(track) {
    if (!track || !track.id) throw new Error("معلومات المسار ناقصة.");
    console.log("🔄 طلب تنزيل المسار:", track.name || track.id);

    const payload = {
      track,
      download_dir: "downloads",
      filename_tag: "SPOTISAVER",
      user_ip: "2404:c0:9830::800e:2a9c",
      is_premium: false,
    };

    try {
      const res = await axios.post(
        `${this.base}/api/download_track.php`,
        payload,
        {
          headers: {
            ...this.headers,
            Referer: `https://spotisaver.net/en/track/${track.id}/`,
            "Content-Type": "application/json",
          },
          responseType: "arraybuffer",
          timeout: 60000,
        }
      );

      console.log("📥 تنزيل: حجم البيانات =", res.data?.byteLength ?? res.data?.length ?? 0);

      const buf = Buffer.from(res.data);
      if (!buf || buf.length === 0) throw new Error("تم تنزيل ملف فارغ.");
      if (buf.length < 1000) {
        console.warn("⚠️ حجم الملف صغير جداً؛ قد يكون خطأ. معاينة أولية:");
        console.warn(buf.toString("utf8", 0, 500));
        throw new Error("الملف صغير جداً بعد التنزيل - قد يكون هناك حظر أو رد خطأ.");
      }

      return buf;
    } catch (err) {
      if (err.response) {
        console.error("❌ رد خطأ من خدمة التنزيل:", err.response.status);
        try {
          const txt = Buffer.from(err.response.data || "").toString("utf8");
          console.error("رد نصي:", txt.substring(0, 1000));
        } catch (e) {}
        if (err.response.status === 403) {
          throw new Error("Forbidden (403) أثناء محاولة تنزيل الملف — Spotisaver رفض الطلب.");
        }
      }
      throw err;
    }
  }
}

/** مسارات router */

/** POST: body = { url: "...", index: 1 } */
router.post("/", async (req, res) => {
  try {
    const { url, index = 1 } = req.body || {};
    if (!url) return res.status(400).json({ status: false, message: "⚠️ يجب تمرير url في body" });

    console.log("▶ POST /api/spotify - url:", url, "index:", index);

    const spotify = new SpotifyAPI();
    const { tracks, type } = await spotify.getInfo(url);

    const i = Number.isFinite(Number(index)) ? parseInt(index) - 1 : 0;
    if (type === "playlist" && (i < 0 || i >= tracks.length)) {
      return res.status(400).json({ status: false, message: `رقم غير صالح — اختر بين 1 و ${tracks.length}` });
    }

    const track = tracks[i] || tracks[0];
    const buffer = await spotify.downloadTrack(track);

    const safeName = (track.name || `track-${track.id}`).replace(/[\\/:*?"<>|]+/g, "").slice(0, 120) + ".mp3";

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (err) {
    console.error("❌ POST Error:", err.message);
    return res.status(500).json({ status: false, message: "فشل تحميل الصوت من Spotify", error: err.message });
  }
});

/** GET: ?url=...&index=1 */
router.get("/", async (req, res) => {
  try {
    const { url, index = 1 } = req.query || {};
    if (!url) return res.status(400).json({ status: false, message: "⚠️ يجب تمرير ?url=" });

    console.log("▶ GET /api/spotify - url:", url, "index:", index);

    const spotify = new SpotifyAPI();
    const { tracks, type } = await spotify.getInfo(url);

    const i = Number.isFinite(Number(index)) ? parseInt(index) - 1 : 0;
    if (type === "playlist" && (i < 0 || i >= tracks.length)) {
      return res.status(400).json({ status: false, message: `رقم غير صالح — اختر بين 1 و ${tracks.length}` });
    }

    const track = tracks[i] || tracks[0];
    const buffer = await spotify.downloadTrack(track);

    const safeName = (track.name || `track-${track.id}`).replace(/[\\/:*?"<>|]+/g, "").slice(0, 120) + ".mp3";

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (err) {
    console.error("❌ GET Error:", err.message);
    return res.status(500).json({ status: false, message: "فشل تحميل الصوت من Spotify", error: err.message });
  }
});

export default router;

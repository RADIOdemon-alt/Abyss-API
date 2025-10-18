// routes/spotify-downloader.js
import express from "express";
import axios from "axios";

const router = express.Router();

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
};

class SpotifyService {
  constructor() {
    this.apiBase = "https://spotisaver.net";
    this.headers = { ...HEADERS };
  }

  parseSpotifyUrl(input) {
    if (!input) throw new Error("⚠️ رابط Spotify مطلوب");
    const url = String(input).trim();

    if (url.includes("spotify.link")) {
      throw new Error(
        "⚠️ الروابط المختصرة (spotify.link) غير مدعومة. استخدم الرابط الكامل من open.spotify.com"
      );
    }

    const trackMatch = url.match(/\/track\/([a-zA-Z0-9]+)/);
    if (trackMatch) {
      const id = trackMatch[1];
      return { id, type: "track", referer: `https://spotisaver.net/en/track/${id}/` };
    }

    const playlistMatch = url.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (playlistMatch) {
      const id = playlistMatch[1];
      return { id, type: "playlist", referer: `https://spotisaver.net/en/playlist/${id}/` };
    }

    const albumMatch = url.match(/\/album\/([a-zA-Z0-9]+)/);
    if (albumMatch) {
      const id = albumMatch[1];
      // spotisaver treats album similarly to playlist for retrieval
      return { id, type: "playlist", referer: `https://spotisaver.net/en/playlist/${id}/` };
    }

    throw new Error(
      "❌ رابط Spotify غير صالح!\nالروابط المدعومة:\n• https://open.spotify.com/track/xxxxx\n• https://open.spotify.com/playlist/xxxxx\n• https://open.spotify.com/album/xxxxx"
    );
  }

  async getSpotifyInfo(url) {
    const { id, type, referer } = this.parseSpotifyUrl(url);
    const apiUrl = `${this.apiBase}/api/get_playlist.php?id=${id}&type=${type}&lang=en`;

    const res = await axios.get(apiUrl, {
      headers: { ...this.headers, Referer: referer, Accept: "application/json" },
      timeout: 20000
    });

    if (res.data?.error) throw new Error(`خطأ من API: ${res.data.error}`);

    const tracks = res.data?.tracks || [];
    if (!tracks || tracks.length === 0) {
      throw new Error("لم يتم العثور على مسارات في الرابط (الـ API أعاد قائمة فارغة).");
    }

    return { tracks, type, id, raw: res.data };
  }

  async downloadTrackBuffer(track) {
    if (!track || !track.id) throw new Error("معلومات المسار ناقصة.");

    const payload = {
      track,
      download_dir: "downloads",
      filename_tag: "SPOTISAVER",
      user_ip: "2404:c0:9830::800e:2a9c",
      is_premium: false
    };

    const res = await axios.post(
      `${this.apiBase}/api/download_track.php`,
      payload,
      {
        headers: {
          ...this.headers,
          Referer: `https://spotisaver.net/en/track/${track.id}/`,
          "Content-Type": "application/json"
        },
        responseType: "arraybuffer",
        timeout: 60000
      }
    );

    if (!res.data || res.data.length === 0) {
      // try to decode possible error text
      let text = "";
      try { text = Buffer.from(res.data).toString("utf8").slice(0, 500); } catch (e) {}
      throw new Error(`تنزيل فشل أو الملف فارغ. استجابة السيرفر: ${text || "غير متاح"}`);
    }

    return Buffer.from(res.data);
  }

  cleanFileName(name = "track") {
    return String(name).replace(/[\\/:"'*?<>|]+/g, "").replace(/\s+/g, "_").slice(0, 150);
  }
}

/* ---------- POST Route ---------- 
   Body JSON:
   { "url": "https://open.spotify.com/track/...", "choice": 1 (optional - for playlists) }
   Response JSON (success):
   { status: true, message: "...", filename: "....mp3", data: "data:audio/mpeg;base64,....", meta: { title, artists, duration_ms } }
*/
router.post("/", async (req, res) => {
  try {
    const { url, choice } = req.body;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ الحقل 'url' مطلوب" });

    const service = new SpotifyService();

    console.log("▶ POST /spotify - url:", url, "choice:", choice);
    const { tracks, type } = await service.getSpotifyInfo(url);

    let index = 0;
    if (type === "playlist" && choice) {
      const n = parseInt(choice);
      if (Number.isInteger(n) && n > 0 && n <= tracks.length) {
        index = n - 1;
      } else {
        index = 0; // fallback to first
      }
    }

    const track = tracks[index];
    const buffer = await service.downloadTrackBuffer(track);

    const filename = `${service.cleanFileName(track.name || `track-${track.id}`)}.mp3`;
    const base64 = `data:audio/mpeg;base64,${buffer.toString("base64")}`;

    return res.json({
      status: true,
      message: "✅ تم تنزيل المسار بنجاح",
      filename,
      data: base64,
      meta: {
        title: track.name || null,
        artists: (track.artists || []).map(a => a.name).join(", ") || null,
        duration_ms: track.duration_ms || null,
        index: index + 1,
        total: tracks.length
      }
    });
  } catch (err) {
    console.error("POST /spotify error:", err?.message || err);
    const statusCode = err.response?.status === 400 ? 400 : 500;
    return res.status(statusCode).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة Spotify",
      error: err.message || String(err)
    });
  }
});

/* ---------- GET Route ---------- 
   Query:
   /?url=https://open.spotify.com/playlist/xxxxx&choice=3
   Response same as POST
*/
router.get("/", async (req, res) => {
  try {
    const url = req.query.url || req.query.track || req.query.link;
    const choice = req.query.choice;

    if (!url) return res.status(400).json({ status: false, message: "⚠️ الوسيط 'url' مطلوب في Query" });

    const service = new SpotifyService();

    console.log("▶ GET /spotify - url:", url, "choice:", choice);
    const { tracks, type } = await service.getSpotifyInfo(url);

    let index = 0;
    if (type === "playlist" && choice) {
      const n = parseInt(choice);
      if (Number.isInteger(n) && n > 0 && n <= tracks.length) index = n - 1;
    }

    const track = tracks[index];
    const buffer = await service.downloadTrackBuffer(track);

    const filename = `${service.cleanFileName(track.name || `track-${track.id}`)}.mp3`;
    const base64 = `data:audio/mpeg;base64,${buffer.toString("base64")}`;

    return res.json({
      status: true,
      message: "✅ تم تنزيل المسار بنجاح",
      filename,
      data: base64,
      meta: {
        title: track.name || null,
        artists: (track.artists || []).map(a => a.name).join(", ") || null,
        duration_ms: track.duration_ms || null,
        index: index + 1,
        total: tracks.length
      }
    });
  } catch (err) {
    console.error("GET /spotify error:", err?.message || err);
    const statusCode = err.response?.status === 400 ? 400 : 500;
    return res.status(statusCode).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة Spotify",
      error: err.message || String(err)
    });
  }
});

export default router;
// ✅ routes/spotify-dl.js
import express from "express";
import axios from "axios";

const router = express.Router();
router.use(express.json());

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  Accept: "application/json, text/plain, */*",
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

    const types = ["track", "playlist", "album"];
    for (const type of types) {
      const match = url.match(new RegExp(`/${type}/([a-zA-Z0-9]+)`));
      if (match)
        return {
          id: match[1],
          type: type === "album" ? "playlist" : type,
          referer: `https://spotisaver.net/en/${type}/${match[1]}/`,
        };
    }

    throw new Error(
      "❌ رابط Spotify غير صالح!\nالروابط المدعومة:\n• https://open.spotify.com/track/xxxxx\n• https://open.spotify.com/playlist/xxxxx\n• https://open.spotify.com/album/xxxxx"
    );
  }

  async getSpotifyInfo(url) {
    const { id, type, referer } = this.parseSpotifyUrl(url);
    const apiUrl = `${this.apiBase}/api/get_playlist.php?id=${id}&type=${type}&lang=en`;

    const res = await axios.get(apiUrl, {
      headers: { ...this.headers, Referer: referer },
      timeout: 15000,
    });

    const tracks = res.data?.tracks;
    if (!tracks || !tracks.length)
      throw new Error("❌ لم يتم العثور على أي مسارات في الرابط!");

    return { tracks, type, id };
  }

  async downloadTrackBuffer(track) {
    if (!track || !track.id) throw new Error("⚠️ بيانات المسار غير مكتملة");

    const payload = {
      track,
      download_dir: "downloads",
      filename_tag: "SPOTISAVER",
      user_ip: "2404:c0:9830::800e:2a9c",
      is_premium: false,
    };

    const res = await axios.post(
      `${this.apiBase}/api/download_track.php`,
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

    if (!res.data || res.data.length === 0) {
      let text = "";
      try {
        text = Buffer.from(res.data).toString("utf8").slice(0, 200);
      } catch {}
      throw new Error(`فشل التحميل أو الملف فارغ: ${text || "لا توجد بيانات"}`);
    }

    return Buffer.from(res.data);
  }

  cleanFileName(name = "track") {
    return String(name)
      .replace(/[\\/:"'*?<>|]+/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 150);
  }
}

// ✅ GET Route (الرئيسي)
router.get("/", async (req, res) => {
  try {
    const url = req.query.url || req.query.link || req.query.track;
    const choice = req.query.choice;
    if (!url)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ الوسيط 'url' مطلوب في الرابط" });

    const service = new SpotifyService();
    const { tracks, type } = await service.getSpotifyInfo(url);

    let index = 0;
    if (type === "playlist" && choice) {
      const n = parseInt(choice);
      if (Number.isInteger(n) && n > 0 && n <= tracks.length) index = n - 1;
    }

    const track = tracks[index];
    const buffer = await service.downloadTrackBuffer(track);
    const filename = `${service.cleanFileName(track.name)}.mp3`;

    return res.json({
      status: true,
      message: "✅ تم تنزيل المسار بنجاح",
      filename,
      url: `/api/Spotify-dl/file/${encodeURIComponent(filename)}`,
      meta: {
        title: track.name,
        artists: (track.artists || []).map((a) => a.name).join(", "),
        duration_ms: track.duration_ms,
        index: index + 1,
        total: tracks.length,
      },
      base64: `data:audio/mpeg;base64,${buffer.toString("base64")}`,
    });
  } catch (err) {
    console.error("GET /Spotify-dl error:", err.message);
    return res.status(500).json({
      status: false,
      message: "❌ فشل تحميل المسار",
      error: err.message,
    });
  }
});

export default router;
import express from "express";
import axios from "axios";

const router = express.Router();

class SpotifyDL {
  constructor() {
    this.base = "https://spotisaver.net";
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      Accept: "application/json",
    };
  }

  parseUrl(url) {
    if (!url.includes("spotify.com")) throw new Error("❌ رابط Spotify غير صالح");
    if (url.includes("spotify.link"))
      throw new Error("⚠️ الروابط المختصرة (spotify.link) غير مدعومة");

    const track = url.match(/\/track\/([a-zA-Z0-9]+)/);
    const playlist = url.match(/\/playlist\/([a-zA-Z0-9]+)/);
    const album = url.match(/\/album\/([a-zA-Z0-9]+)/);

    if (track)
      return {
        id: track[1],
        type: "track",
        referer: `${this.base}/en/track/${track[1]}/`,
      };
    if (playlist)
      return {
        id: playlist[1],
        type: "playlist",
        referer: `${this.base}/en/playlist/${playlist[1]}/`,
      };
    if (album)
      return {
        id: album[1],
        type: "playlist",
        referer: `${this.base}/en/playlist/${album[1]}/`,
      };

    throw new Error("⚠️ استخدم رابط track أو playlist أو album فقط.");
  }

  async getInfo(url) {
    const { id, type, referer } = this.parseUrl(url);
    const api = `${this.base}/api/get_playlist.php?id=${id}&type=${type}&lang=en`;

    const res = await axios.get(api, {
      headers: { ...this.headers, Referer: referer },
      timeout: 15000,
    });

    if (!res.data?.tracks?.length) throw new Error("❌ لم يتم العثور على أي مسارات!");
    return { tracks: res.data.tracks, id, type };
  }

  async downloadTrack(track) {
    const payload = {
      track,
      download_dir: "downloads",
      filename_tag: "SPOTISAVER",
      user_ip: "2404:c0:9830::800e:2a9c",
      is_premium: false,
    };

    const res = await axios.post(`${this.base}/api/download_track.php`, payload, {
      headers: {
        ...this.headers,
        Referer: `${this.base}/en/track/${track.id}/`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
      responseType: "arraybuffer",
    });

    if (!res.data || res.data.length === 0)
      throw new Error("⚠️ فشل في تحميل الصوت من المصدر.");
    return Buffer.from(res.data);
  }
}

/* 🎧 POST Route */
router.post("/", async (req, res) => {
  try {
    const { url, index = 1 } = req.body;
    if (!url)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ أدخل رابط Spotify في body (url)" });

    const spotify = new SpotifyDL();
    const { tracks, type } = await spotify.getInfo(url);
    const i = parseInt(index) - 1;

    if (type === "playlist" && (i < 0 || i >= tracks.length))
      return res.json({
        status: false,
        message: `⚠️ رقم غير صالح! اختر رقم بين 1 و ${tracks.length}`,
      });

    const track = tracks[i];
    const fileBuffer = await spotify.downloadTrack(track);

    const fileName = `${track.name.replace(/[\\/:*?"<>|]/g, "").slice(0, 100)}.mp3`;

    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": fileBuffer.length,
    });

    res.end(fileBuffer);
  } catch (err) {
    console.error("❌ Spotify Error:", err.message);
    res.status(500).json({
      status: false,
      message: "❌ فشل تحميل الصوت من Spotify",
      error: err.message,
    });
  }
});

/* 🎧 GET Route */
router.get("/", async (req, res) => {
  try {
    const { url, index = 1 } = req.query;
    if (!url)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ أدخل رابط Spotify في ?url=" });

    const spotify = new SpotifyDL();
    const { tracks, type } = await spotify.getInfo(url);
    const i = parseInt(index) - 1;

    if (type === "playlist" && (i < 0 || i >= tracks.length))
      return res.json({
        status: false,
        message: `⚠️ رقم غير صالح! اختر رقم بين 1 و ${tracks.length}`,
      });

    const track = tracks[i];
    const fileBuffer = await spotify.downloadTrack(track);

    const fileName = `${track.name.replace(/[\\/:*?"<>|]/g, "").slice(0, 100)}.mp3`;

    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": fileBuffer.length,
    });

    res.end(fileBuffer);
  } catch (err) {
    console.error("❌ Spotify Error:", err.message);
    res.status(500).json({
      status: false,
      message: "❌ فشل تحميل الصوت من Spotify",
      error: err.message,
    });
  }
});

export default router;
import express from "express";
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
    if (url.includes("spotify.link")) throw new Error("⚠️ الروابط المختصرة غير مدعومة حالياً.");

    const trackMatch = url.match(/\/track\/([a-zA-Z0-9]+)/);
    if (trackMatch) return { id: trackMatch[1], type: "track", referer: `${this.base}/en/track/${trackMatch[1]}/` };

    const playlistMatch = url.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (playlistMatch) return { id: playlistMatch[1], type: "playlist", referer: `${this.base}/en/playlist/${playlistMatch[1]}/` };

    const albumMatch = url.match(/\/album\/([a-zA-Z0-9]+)/);
    if (albumMatch) return { id: albumMatch[1], type: "playlist", referer: `${this.base}/en/playlist/${albumMatch[1]}/` };

    throw new Error("❌ رابط Spotify غير صالح.");
  }

  async getInfo(url) {
    const { id, type, referer } = this.parseUrl(url);
    const apiUrl = `${this.base}/api/get_playlist.php?id=${id}&type=${type}&lang=en`;
    const res = await axios.get(apiUrl, { headers: { ...this.headers, Referer: referer }, timeout: 20000 });
    if (!res.data || res.data.error) throw new Error(res.data?.error || "فشل الحصول على بيانات من spotisaver");
    const tracks = res.data.tracks || [];
    if (!tracks.length) throw new Error("لم يتم العثور على مسارات.");
    return { tracks, type, id };
  }

  async downloadTrack(track) {
    const payload = { track, download_dir: "downloads", filename_tag: "SPOTISAVER", user_ip: "2404:c0:9830::800e:2a9c", is_premium: false };
    const res = await axios.post(`${this.base}/api/download_track.php`, payload, { headers: { ...this.headers, Referer: `${this.base}/en/track/${track.id}/`, "Content-Type": "application/json" }, responseType: "arraybuffer", timeout: 60000 });
    return Buffer.from(res.data);
  }
}

// GET/POST API مشابه لأسلوب SaveTube
router.get("/", async (req, res) => {
  try {
    const { url, index = 1 } = req.query;
    if (!url) return res.status(400).json({ status: false, error: "يرجى إدخال رابط Spotify." });

    const spotify = new SpotifyAPI();
    const { tracks, type } = await spotify.getInfo(url);
    const i = parseInt(index) - 1;
    const track = tracks[i] || tracks[0];

    const buffer = await spotify.downloadTrack(track);

    res.json({
      status: true,
      creator: "Dark-Team",
      data: {
        id: track.id,
        name: track.name,
        artists: track.artists?.map(a => a.name) || [],
        type: type === "track" ? "audio" : "playlist",
        duration: track.duration_ms,
        download: buffer.toString("base64") // الصوت Base64
      }
    });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { url, index = 1 } = req.body;
    if (!url) return res.status(400).json({ status: false, error: "يرجى إدخال رابط Spotify." });

    const spotify = new SpotifyAPI();
    const { tracks, type } = await spotify.getInfo(url);
    const i = parseInt(index) - 1;
    const track = tracks[i] || tracks[0];

    const buffer = await spotify.downloadTrack(track);

    res.json({
      status: true,
      creator: "Dark-Team",
      data: {
        id: track.id,
        name: track.name,
        artists: track.artists?.map(a => a.name) || [],
        type: type === "track" ? "audio" : "playlist",
        duration: track.duration_ms,
        download: buffer.toString("base64")
      }
    });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

export default router;

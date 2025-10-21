import express from "express";
import axios from "axios";

const router = express.Router();

const spotifyAPI = {
  base: "https://spotisaver.net",
  headers: {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    Accept: "application/json",
  },

  parseUrl: (url) => {
    if (!url) throw new Error("⚠️ رابط Spotify مفقود");
    url = url.trim();

    if (url.includes("spotify.link"))
      throw new Error("⚠️ الروابط المختصرة غير مدعومة.");

    const trackMatch = url.match(/\/track\/([a-zA-Z0-9]+)/);
    if (trackMatch) return { id: trackMatch[1], type: "track", referer: `${spotifyAPI.base}/en/track/${trackMatch[1]}/` };

    const playlistMatch = url.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (playlistMatch) return { id: playlistMatch[1], type: "playlist", referer: `${spotifyAPI.base}/en/playlist/${playlistMatch[1]}/` };

    const albumMatch = url.match(/\/album\/([a-zA-Z0-9]+)/);
    if (albumMatch) return { id: albumMatch[1], type: "playlist", referer: `${spotifyAPI.base}/en/playlist/${albumMatch[1]}/` };

    throw new Error("❌ رابط Spotify غير صالح.");
  },

  getInfo: async (url) => {
    const { id, type, referer } = spotifyAPI.parseUrl(url);
    const apiUrl = `${spotifyAPI.base}/api/get_playlist.php?id=${id}&type=${type}&lang=en`;
    const res = await axios.get(apiUrl, { headers: { ...spotifyAPI.headers, Referer: referer }, timeout: 20000 });
    if (!res.data || res.data.error) throw new Error(res.data?.error || "فشل الحصول على بيانات من spotisaver");
    const tracks = res.data.tracks || [];
    if (!tracks.length) throw new Error("لم يتم العثور على مسارات.");
    return { tracks, type, id };
  },

  downloadTrack: async (track) => {
    const payload = { track, download_dir: "downloads", filename_tag: "SPOTISAVER", user_ip: "2404:c0:9830::800e:2a9c", is_premium: false };
    const res = await axios.post(`${spotifyAPI.base}/api/download_track.php`, payload, { headers: { ...spotifyAPI.headers, Referer: `${spotifyAPI.base}/en/track/${track.id}/`, "Content-Type": "application/json" }, responseType: "arraybuffer", timeout: 60000 });
    return Buffer.from(res.data);
  }
};

/** GET: ?url=...&index=1 */
router.get("/", async (req, res) => {
  try {
    const { url, index = 1 } = req.query;
    if (!url) return res.status(400).json({ status: false, error: "يرجى إدخال رابط Spotify." });

    const { tracks, type } = await spotifyAPI.getInfo(url);
    const i = parseInt(index) - 1;
    if (type === "playlist" && (i < 0 || i >= tracks.length)) return res.status(400).json({ status: false, error: `رقم غير صالح — اختر بين 1 و ${tracks.length}` });

    const track = tracks[i] || tracks[0];
    const buffer = await spotifyAPI.downloadTrack(track);

    res.json({
      status: true,
      creator: "Dark-Team",
      data: {
        id: track.id,
        name: track.name,
        artists: track.artists?.map(a => a.name) || [],
        type: type === "track" ? "audio" : "playlist",
        duration: track.duration_ms,
        download: buffer.toString("base64") // ترجع الصوت Base64
      }
    });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

export default router;

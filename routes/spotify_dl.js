import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";

const router = express.Router();

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
};

function parseSpotifyUrl(input) {
  let url = input.trim();

  if (url.includes("spotify.link")) {
    throw new Error("⚠️ الروابط المختصرة (spotify.link) غير مدعومة. استخدم open.spotify.com");
  }

  const trackMatch = url.match(/\/track\/([a-zA-Z0-9]+)/);
  if (trackMatch) return { id: trackMatch[1], type: "track", referer: `https://spotisaver.net/en/track/${trackMatch[1]}/` };

  const playlistMatch = url.match(/\/playlist\/([a-zA-Z0-9]+)/);
  if (playlistMatch) return { id: playlistMatch[1], type: "playlist", referer: `https://spotisaver.net/en/playlist/${playlistMatch[1]}/` };

  const albumMatch = url.match(/\/album\/([a-zA-Z0-9]+)/);
  if (albumMatch) return { id: albumMatch[1], type: "playlist", referer: `https://spotisaver.net/en/playlist/${albumMatch[1]}/` };

  throw new Error("❌ رابط Spotify غير صالح! استخدم روابط track أو playlist أو album.");
}

async function getSpotifyInfo(url) {
  const { id, type, referer } = parseSpotifyUrl(url);
  const apiUrl = `https://spotisaver.net/api/get_playlist.php?id=${id}&type=${type}&lang=en`;

  const res = await axios.get(apiUrl, {
    headers: { ...HEADERS, Referer: referer, Accept: "application/json" },
    timeout: 20000
  });

  if (!res.data?.tracks || res.data.tracks.length === 0) {
    throw new Error("❌ لم يتم العثور على مسارات في الرابط!");
  }

  return { tracks: res.data.tracks, type, id };
}

async function downloadTrack(track) {
  const payload = {
    track,
    download_dir: "downloads",
    filename_tag: "SPOTISAVER",
    user_ip: "2404:c0:9830::800e:2a9c",
    is_premium: false
  };

  const res = await axios.post("https://spotisaver.net/api/download_track.php", payload, {
    headers: { ...HEADERS, Referer: `https://spotisaver.net/en/track/${track.id}/`, "Content-Type": "application/json" },
    responseType: "arraybuffer",
    timeout: 60000
  });

  return Buffer.from(res.data);
}

function cleanFileName(name = "track") {
  return name.replace(/[\\/:"'*?<>|]+/g, "").replace(/\s+/g, "_").slice(0, 150);
}

//==========================================================
// 📡 Route: /api/Spotify-dl?url=<spotify_link>&index=<num>
//==========================================================
router.get("/", async (req, res) => {
  const { url, index } = req.query;

  try {
    if (!url) {
      return res.status(400).json({
        error: "⚠️ يرجى إدخال رابط Spotify\nمثال: /api/Spotify-dl?url=https://open.spotify.com/track/xxxxx"
      });
    }

    console.log("🎵 معالجة Spotify:", url);
    const { tracks, type } = await getSpotifyInfo(url);
    const trackIndex = index ? parseInt(index) - 1 : 0;

    if (type === "playlist" && (trackIndex < 0 || trackIndex >= tracks.length)) {
      return res.status(400).json({
        error: `⚠️ رقم المسار غير صالح! اختر رقم بين 1 و ${tracks.length}`
      });
    }

    const track = tracks[trackIndex];
    const fileBuffer = await downloadTrack(track);

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("⚠️ تم تنزيل ملف فارغ - قد يكون هناك مشكلة في المسار.");
    }

    const fileName = `${cleanFileName(track.name || `track-${track.id}`)}.mp3`;
    const tempPath = path.join(process.cwd(), `temp_${Date.now()}.mp3`);
    fs.writeFileSync(tempPath, fileBuffer);

    res.set({
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "audio/mpeg"
    });

    const stream = fs.createReadStream(tempPath);
    stream.pipe(res);
    stream.on("close", () => {
      fs.unlinkSync(tempPath);
      console.log("🗑️ حذف الملف المؤقت:", fileName);
    });

  } catch (err) {
    console.error("❌ Spotify-dl Error:", err.message);
    res.status(500).json({
      error: "حدث خطأ أثناء معالجة رابط Spotify",
      details: err.message
    });
  }
});

export default router;
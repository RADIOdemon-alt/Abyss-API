
import express from "express";
import fs from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = express.Router();

function sanitizeFilename(name = "track") {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

// دالة مساعدة لتحميل الملف مؤقتًا ثم ترسله للعميل
async function saveTempFile(buffer, filename) {
  const tmpPath = path.join(tmpdir(), filename);
  await fs.writeFile(tmpPath, buffer);
  return tmpPath;
}

router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url)
      return res.status(400).json({
        status: false,
        message: "⚠️ الرابط مطلوب (url)",
      });

    const spotModule = await import(path.resolve("./spotisaver.js"));
    const spot = spotModule.default ?? spotModule;
    const { getSpotifyInfo, downloadTrack } = spot;

    if (typeof getSpotifyInfo !== "function" || typeof downloadTrack !== "function") {
      throw new Error("ملف spotisaver.js لا يُصدّر الدوال المطلوبة (getSpotifyInfo, downloadTrack).");
    }

    const tracks = await getSpotifyInfo(url);
    if (!tracks || tracks.length === 0)
      return res.status(404).json({
        status: false,
        message: "⚠️ لم يتم العثور على أي مسار في الرابط المرسل.",
      });

    const isPlaylist = url.includes("/playlist/");
    const results = [];

    if (!isPlaylist) {
      const track = Array.isArray(tracks) ? tracks[0] : tracks;
      const buffer = await downloadTrack(track);
      if (!buffer || buffer.length === 0) throw new Error("ملف التحميل فارغ");

      const filename = sanitizeFilename(track.name || track.title || "track") + ".mp3";
      const tmpPath = await saveTempFile(buffer, filename);

      results.push({
        name: track.name,
        artists: track.artists,
        filename,
        path: tmpPath,
      });

      return res.json({
        status: true,
        message: `✅ تم تحميل المسار: ${track.name}`,
        track,
        file: { filename, tmpPath },
      });
    } else {
      const MAX = 5;
      const toDownload = tracks.slice(0, MAX);

      for (let i = 0; i < toDownload.length; i++) {
        const t = toDownload[i];
        try {
          const buff = await downloadTrack(t);
          if (!buff || buff.length === 0) throw new Error("ملف فارغ");
          const fname = sanitizeFilename(t.name || t.title || `track-${i + 1}`) + ".mp3";
          const tmpP = await saveTempFile(buff, fname);
          results.push({
            name: t.name,
            artists: t.artists,
            filename: fname,
            path: tmpP,
          });
        } catch (errTrack) {
          results.push({
            name: t.name,
            error: errTrack.message || String(errTrack),
          });
        }
      }

      return res.json({
        status: true,
        message: `✅ تم تحميل أول ${results.length} مسارات من قائمة التشغيل.`,
        count: results.length,
        results,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التعامل مع Spotify",
      error: err.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url)
      return res.status(400).json({
        status: false,
        message: "⚠️ الرابط مطلوب (url)",
      });

    const spotModule = await import(path.resolve("./spotisaver.js"));
    const spot = spotModule.default ?? spotModule;
    const { getSpotifyInfo } = spot;

    if (typeof getSpotifyInfo !== "function") {
      throw new Error("ملف spotisaver.js لا يحتوي على getSpotifyInfo.");
    }

    const info = await getSpotifyInfo(url);
    if (!info || info.length === 0)
      return res.status(404).json({
        status: false,
        message: "⚠️ لم يتم العثور على معلومات للمسار المطلوب.",
      });

    res.json({
      status: true,
      message: "✅ تم جلب معلومات المسار بنجاح",
      results: info,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب بيانات Spotify",
      error: err.message,
    });
  }
});

export default router;
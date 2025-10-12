import express from "express";
import axios from "axios";

const router = express.Router();

async function pindl(url) {
  try {
    const apiEndpoint = "https://pinterestdownloader.io/frontendService/DownloaderService";

    const { data } = await axios.post(
      apiEndpoint,
      { url },
      {
        headers: {
          "content-type": "application/json",
          origin: "https://pinterestdownloader.io",
          referer: "https://pinterestdownloader.io/",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        },
        timeout: 30000,
      }
    );

    const medias = data?.medias || [];
    const video = medias.find((m) => m.extension === "mp4") || medias[0];

    if (!video?.url) throw new Error("❌ لم يتم العثور على رابط فيديو صالح");

    return {
      status: true,
      title: data.title || "بدون عنوان",
      thumbnail: data.thumbnail,
      duration: data.duration || null,
      quality: video.quality || "غير محددة",
      size: formatSize(video.size),
      video_url: video.url,
      medias,
    };
  } catch (e) {
    return { status: false, message: e.message };
  }
}

function formatSize(bytes) {
  if (!bytes) return "—";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// ✅ POST endpoint
router.post("/", async (req, res) => {
  const { url } = req.body;
  if (!url)
    return res
      .status(400)
      .json({ status: false, message: "⚠️ يرجى إرسال رابط الفيديو داخل body: { url: '...' }" });

  const result = await pindl(url);
  res.status(result.status ? 200 : 500).json(result);
});

// ✅ GET endpoint
router.get("/", async (req, res) => {
  const { url } = req.query;

  if (url) {
    const result = await pindl(url);
    return res.status(result.status ? 200 : 500).json(result);
  }

  res.json({
    status: true,
    creator: "Radio Demon",
    message: "📌 استخدم ?url= أو أرسل POST بـ { url: '...' } لتحميل فيديو من Pinterest",
  });
});

export default router;
import express from "express";
import axios from "axios";

const router = express.Router();

/* -----------------------------------------------------
   🔥 Class للتعامل مع API Sora 2
------------------------------------------------------*/
class Sora2API {
  constructor() {
    this.base = "https://omegatech-api.dixonomega.tech/api/ai";
    this.startUrl = `${this.base}/sora2-create`;
    this.statusUrl = `${this.base}/sora2-status`;
  }

  /** 🧩 بدء إنشاء الفيديو */
  async start(prompt, aspectRatio) {
    const res = await axios.post(
      this.startUrl,
      { prompt, aspectRatio },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    if (!res.data.success || !res.data.videoId) {
      throw new Error(res.data.message || "فشل بدء إنشاء الفيديو");
    }

    return res.data.videoId;
  }

  /** 🧩 جلب حالة الفيديو */
  async status(videoId) {
    const res = await axios.get(`${this.statusUrl}?videoId=${videoId}`);
    return res.data;
  }
}

/* -----------------------------------------------------
   🧩 POST /sora2 => يبدأ توليد الفيديو ويرجع الـ progress
------------------------------------------------------*/
router.post("/", async (req, res) => {
  try {
    let { prompt, ratio } = req.body;

    if (!prompt)
      return res.status(400).json({
        status: false,
        message: "⚠️ الوصف مطلوب (prompt)",
      });

    ratio = ["16:9", "9:16"].includes(ratio) ? ratio : "16:9";

    const sora = new Sora2API();

    // 1) بدء المهمة
    const videoId = await sora.start(prompt, ratio);

    // 2) متابعة التقدم
    let videoUrl = null;
    let progress = 0;

    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 10000)); // 10 ثوانٍ

      const data = await sora.status(videoId);

      progress = data.progress ?? progress;

      // مكتمل
      if (data.status === "completed" && data.videoUrl) {
        videoUrl = data.videoUrl;
        break;
      }

      // فشل
      if (data.status === "failed") {
        return res.status(500).json({
          status: false,
          message: "❌ فشل توليد الفيديو",
        });
      }
    }

    if (!videoUrl) {
      return res.status(408).json({
        status: false,
        message: "⏳ انتهى الوقت ولم يكتمل التوليد",
      });
    }

    // 3) إرسال الرد النهائي
    return res.json({
      status: true,
      message: "🎬 تم إنشاء الفيديو بنجاح",
      prompt,
      ratio,
      videoId,
      videoUrl,
      progress: 100,
    });
  } catch (err) {
    console.error("Sora2 Error:", err);
    return res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء إنشاء الفيديو",
      error: err.message,
    });
  }
});

/* -----------------------------------------------------
   🧩 GET /sora2?videoId=xxx => جلب حالة الفيديو
------------------------------------------------------*/
router.get("/", async (req, res) => {
  try {
    const { videoId } = req.query;

    if (!videoId)
      return res.status(400).json({
        status: false,
        message: "⚠️ videoId مطلوب",
      });

    const sora = new Sora2API();
    const data = await sora.status(videoId);

    return res.json({
      status: true,
      message: "📡 تم جلب حالة الفيديو",
      data,
    });
  } catch (err) {
    console.error("Sora2 GET Error:", err);
    return res.status(500).json({
      status: false,
      message: "❌ فشل جلب الحالة",
      error: err.message,
    });
  }
});

export default router;
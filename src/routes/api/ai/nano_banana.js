import express from "express";
import axios from "axios";

const router = express.Router();

class NanoBananaAPI {
  constructor() {
    this.uploadUrlEndpoint = "https://imgeditor.co/api/get-upload-url";
    this.generateEndpoint = "https://imgeditor.co/api/generate-image";
    this.statusEndpoint = "https://imgeditor.co/api/generate-image/status";
    this.headers = {
      accept: "*/*",
      "content-type": "application/json",
    };
  }

  async getImageBuffer(imageUrl) {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    return {
      buffer: Buffer.from(response.data),
      contentType: response.headers["content-type"] || "image/jpeg",
    };
  }

  async generate({ prompt, imageUrl, styleId = "realistic", model = "nano-banana", maxPolls = 60, pollDelay = 2000 }) {
    if (!prompt) throw new Error("الوصف (prompt) مطلوب");
    if (!imageUrl) throw new Error("رابط الصورة (imageUrl) مطلوب");

    // 1️⃣ تحميل الصورة
    const { buffer: imageBuffer, contentType } = await this.getImageBuffer(imageUrl);
    const ext = contentType.split("/")[1] || "jpg";
    const fileName = `photo.${ext}`;

    // 2️⃣ طلب رابط الرفع
    const uploadInfoResp = await axios.post(
      this.uploadUrlEndpoint,
      {
        fileName,
        contentType,
        fileSize: imageBuffer.length,
      },
      { headers: this.headers }
    );

    const uploadInfo = uploadInfoResp.data;
    if (!uploadInfo?.uploadUrl || !uploadInfo?.publicUrl) {
      throw new Error("معلومات الرفع غير كاملة من الخادم");
    }

    // 3️⃣ رفع الصورة
    await axios.put(uploadInfo.uploadUrl, imageBuffer, {
      headers: { "content-type": contentType },
    });

    // 4️⃣ طلب التوليد
    const genResp = await axios.post(
      this.generateEndpoint,
      {
        prompt,
        styleId,
        mode: "image",
        imageUrl: uploadInfo.publicUrl,
        imageUrls: [uploadInfo.publicUrl],
        numImages: 1,
        outputFormat: "png",
        model,
      },
      { headers: this.headers }
    );

    const taskId = genResp.data?.taskId;
    if (!taskId) throw new Error("الخادم لم يرجع taskId");

    // 5️⃣ تتبع الحالة
    let polls = 0;
    while (polls < maxPolls) {
      await new Promise((r) => setTimeout(r, pollDelay));
      polls++;

      try {
        const statusResp = await axios.get(`${this.statusEndpoint}?taskId=${encodeURIComponent(taskId)}`, {
          headers: { accept: "*/*" },
        });

        const status = statusResp.data;

        if (status.status === "completed" && status.imageUrl) {
          return status.imageUrl;
        }

        if (status.status === "failed" || status.status === "error") {
          throw new Error(`المهمة فشلت: ${status.message || "خطأ أثناء التوليد"}`);
        }
      } catch (err) {
        // استمر في المحاولة
        if (polls >= maxPolls) throw err;
      }
    }

    throw new Error("انتهت المهلة: لم تكتمل المهمة في الوقت المتوقع");
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { prompt, imageUrl, styleId, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ status: false, message: "⚠️ الوصف مطلوب (prompt)" });
    }

    if (!imageUrl) {
      return res.status(400).json({ status: false, message: "⚠️ رابط الصورة مطلوب (imageUrl)" });
    }

    const nanoBanana = new NanoBananaAPI();
    const resultUrl = await nanoBanana.generate({ prompt, imageUrl, styleId, model });

    res.json({
      status: true,
      message: "✅ تم التوليد بنجاح",
      imageUrl: resultUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء توليد الصورة",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { prompt, imageUrl, styleId, model } = req.query;

    if (!prompt) {
      return res.status(400).json({ status: false, message: "⚠️ الوصف مطلوب (prompt)" });
    }

    if (!imageUrl) {
      return res.status(400).json({ status: false, message: "⚠️ رابط الصورة مطلوب (imageUrl)" });
    }

    const nanoBanana = new NanoBananaAPI();
    const resultUrl = await nanoBanana.generate({ prompt, imageUrl, styleId, model });

    res.json({
      status: true,
      message: "✅ تم التوليد بنجاح",
      imageUrl: resultUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء توليد الصورة",
      error: err.message,
    });
  }
});

export default router;
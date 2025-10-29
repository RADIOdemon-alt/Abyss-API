import express from "express";
import axios from "axios";

const router = express.Router();

class Veo3API {
  constructor() {
    this.baseUrl = "https://omegatech-api.dixonomega.tech/api/ai";
    this.createEndpoint = `${this.baseUrl}/Veo3-v3`;
    this.statusEndpoint = `${this.baseUrl}/Veo3-v3-status`;
    this.maxAttempts = 80;
    this.checkInterval = 5000;
  }

  async createTask(prompt) {
    if (!prompt) throw new Error("Prompt is required");

    const response = await axios.get(
      `${this.createEndpoint}?prompt=${encodeURIComponent(prompt)}`
    );

    if (!response.data?.success || !response.data?.task_id) {
      throw new Error(
        `Failed to create task. Response: ${JSON.stringify(response.data)}`
      );
    }

    return response.data.task_id;
  }

  async checkStatus(taskId) {
    const response = await axios
      .get(`${this.statusEndpoint}?task_id=${taskId}`)
      .catch(() => ({}));

    return {
      status: response.data?.status?.toLowerCase() || "pending",
      videoUrl: response.data?.video_url || null,
    };
  }

  async generateVideo(prompt) {
    const taskId = await this.createTask(prompt);

    for (let i = 0; i < this.maxAttempts; i++) {
      const { status, videoUrl } = await this.checkStatus(taskId);

      if (status === "success" && videoUrl) {
        return { videoUrl, status: "success" };
      }

      if (status === "failed") {
        throw new Error("Video generation failed");
      }

      await new Promise((resolve) => setTimeout(resolve, this.checkInterval));
    }

    throw new Error("Video generation timeout or incomplete");
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ وصف الفيديو مطلوب (prompt)" });

    const veo3 = new Veo3API();
    const result = await veo3.generateVideo(prompt);

    res.json({
      status: true,
      message: "✅ تم إنشاء الفيديو بنجاح",
      prompt: prompt,
      videoUrl: result.videoUrl,
      source: "Veo3",
    });
  } catch (err) {
    console.error("💀 Veo3 Error:", err);
    res.status(500).json({
      status: false,
      message: "❌ فشل إنشاء الفيديو",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { prompt } = req.query;
    if (!prompt)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ وصف الفيديو مطلوب (prompt)" });

    const veo3 = new Veo3API();
    const result = await veo3.generateVideo(prompt);

    res.json({
      status: true,
      message: "✅ تم إنشاء الفيديو بنجاح",
      prompt: prompt,
      videoUrl: result.videoUrl,
      source: "Veo3",
    });
  } catch (err) {
    console.error("💀 Veo3 Error:", err);
    res.status(500).json({
      status: false,
      message: "❌ فشل إنشاء الفيديو",
      error: err.message,
    });
  }
});

export default router;
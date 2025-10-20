import express from "express";
import axios from "axios";
import crypto from "crypto";

const router = express.Router();

class SoraAPI {
  constructor() {
    this.baseUrl = "https://api.bylo.ai/aimodels/api/v1/ai";
    this.headers = {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json; charset=UTF-8",
      origin: "https://bylo.ai",
      referer: "https://bylo.ai/features/sora-2",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
    };
    this.timeout = 30000;
  }

  extractVideoUrl(obj) {
    if (!obj) return null;

    // حقول شائعة
    const candidates = [
      obj.videoUrl,
      obj.video,
      obj.url,
      obj.result?.videoUrl,
      obj.result?.video,
      obj.data?.videoUrl,
      obj.data?.video,
      obj.media?.url,
      obj.media?.video,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.startsWith("http")) return c;
    }

    // تفريغ الكائن وتحليل نصي للروابط بممتدات الفيديو الشائعة
    try {
      const txt = JSON.stringify(obj);
      const regex = /https?:\/\/[^"'\s<>]+?\.(mp4|webm|mov|mkv|m3u8)(\?[^"'\s<>]*)?/gi;
      const match = regex.exec(txt);
      if (match) return match[0];
    } catch (e) {
      /* ignore */
    }

    return null;
  }

  async createVideo({
    prompt,
    ratio = "portrait",
    timeoutMs = 3 * 60 * 1000,
    pollIntervalMs = 3000,
  }) {
    if (!prompt) throw new Error("Prompt is required");
    if (!["portrait", "landscape"].includes(ratio)) {
      throw new Error("Available ratios: portrait, landscape");
    }

    const api = axios.create({
      baseURL: this.baseUrl,
      headers: {
        ...this.headers,
        uniqueId: crypto.randomUUID().replace(/-/g, ""),
      },
      timeout: this.timeout,
    });

    // 1) إنشاء المهمة
    let postResp;
    try {
      postResp = await api.post("/video/create", {
        prompt,
        channel: "SORA2",
        pageId: 536,
        source: "bylo.ai",
        watermarkFlag: true,
        privateFlag: true,
        isTemp: true,
        vipFlag: true,
        model: "sora_video2",
        videoType: "text-to-video",
        aspectRatio: ratio,
      });
    } catch (err) {
      const info = err.response
        ? `Status ${err.response.status} - ${JSON.stringify(err.response.data).slice(0, 800)}`
        : err.message;
      throw new Error(`POST /video/create failed: ${info}`);
    }

    const taskBody = postResp.data ?? {};
    const taskId =
      taskBody?.data || taskBody?.taskId || taskBody?.id || taskBody?.task?.id;
    if (!taskId) {
      throw new Error(
        `لم أستطع استخراج taskId من استجابة POST. الرد: ${JSON.stringify(taskBody).slice(0, 1000)}`
      );
    }

    // 2) Polling
    const start = Date.now();
    let lastPoll = null;
    while (Date.now() - start < timeoutMs) {
      const pollPath = `/${encodeURIComponent(taskId)}?channel=SORA2`;
      try {
        const pollResp = await api.get(pollPath);
        const pdata = pollResp?.data ?? null;
        lastPoll = pdata;

        const state = pdata?.data?.state ?? pdata?.state ?? 0;
        const completeData =
          pdata?.data?.completeData ?? pdata?.completeData ?? null;

        if (state > 0 && completeData) {
          let parsed = completeData;
          if (typeof completeData === "string") {
            try {
              parsed = JSON.parse(completeData);
            } catch (e) {
              parsed = completeData;
            }
          }

          const url =
            this.extractVideoUrl(parsed) ||
            this.extractVideoUrl(pdata) ||
            this.extractVideoUrl(parsed?.result) ||
            null;

          return {
            videoUrl: url,
            result: parsed,
            rawTaskResponse: taskBody,
            rawPollResponse: pdata,
          };
        }
      } catch (err) {
        lastPoll = err.response
          ? { status: err.response.status, data: err.response.data }
          : { message: err.message };
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new Error(
      `timeout waiting for result (waited ${Math.round(timeoutMs / 1000)}s). lastPollResponse: ${JSON.stringify(lastPoll).slice(0, 1000)}`
    );
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { prompt, ratio = "portrait", timeoutMs, pollIntervalMs } = req.body;
    if (!prompt)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ النص مطلوب (prompt)" });

    const sora = new SoraAPI();
    const result = await sora.createVideo({
      prompt,
      ratio,
      timeoutMs,
      pollIntervalMs,
    });

    if (!result?.videoUrl) {
      return res.status(500).json({
        status: false,
        message: "⚠️ لم يتم العثور على رابط الفيديو",
        debug: {
          result: result?.result,
          rawTask: result?.rawTaskResponse,
          rawPoll: result?.rawPollResponse,
        },
      });
    }

    res.json({
      status: true,
      message: "✅ تم إنشاء الفيديو بنجاح",
      videoUrl: result.videoUrl,
      result: result.result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء إنشاء الفيديو",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const {
      prompt,
      ratio = "portrait",
      timeoutMs,
      pollIntervalMs,
    } = req.query;

    if (!prompt)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ النص مطلوب (prompt)" });

    const sora = new SoraAPI();
    const result = await sora.createVideo({
      prompt,
      ratio,
      timeoutMs: timeoutMs ? parseInt(timeoutMs) : undefined,
      pollIntervalMs: pollIntervalMs ? parseInt(pollIntervalMs) : undefined,
    });

    if (!result?.videoUrl) {
      return res.status(500).json({
        status: false,
        message: "⚠️ لم يتم العثور على رابط الفيديو",
        debug: {
          result: result?.result,
          rawTask: result?.rawTaskResponse,
          rawPoll: result?.rawPollResponse,
        },
      });
    }

    res.json({
      status: true,
      message: "✅ تم إنشاء الفيديو بنجاح",
      videoUrl: result.videoUrl,
      result: result.result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء إنشاء الفيديو",
      error: err.message,
    });
  }
});

export default router;
import express from "express";
import axios from "axios";

const router = express.Router();

/** 🎵 فئة توليد الأغاني */
class SongGenerator {
  constructor() {
    this.lyricsEndpoint =
      "https://8pe3nv3qha.execute-api.us-east-1.amazonaws.com/default/llm_chat";
    this.musicEndpoint =
      "https://ace-step-ace-step.hf.space/gradio_api/queue";
  }

  /** 📝 توليد كلمات الأغنية */
  async generateLyrics(prompt) {
    const { data } = await axios.get(this.lyricsEndpoint, {
      params: {
        query: JSON.stringify([
          {
            role: "system",
            content:
              "أنت كاتب أغاني محترف تكتب بالعربية فقط. اكتب كلمات أغنية عربية منسقة تتبع بنية الأغاني (مقاطع [المقطع], كورس [الكورس], جسر [الجسر])، ولا تشرح شيئًا ولا تضف عنوانًا. اجعل الأسلوب شعريًا وموزونًا ومناسبًا للغناء.",
          },
          { role: "user", content: prompt },
        ]),
        link: "writecream.com",
      },
    });

    const lyrics = data.response_content?.trim();
    if (!lyrics) throw new Error("⚠️ فشل في توليد الكلمات.");
    return lyrics;
  }

  /** 🎧 توليد الموسيقى */
  async generateMusic({ lyrics, tags }) {
    const session_hash = Math.random().toString(36).substring(2);

    await axios.post(`${this.musicEndpoint}/join?`, {
      data: [
        240, // length
        tags, // tags
        lyrics, // lyrics
        60, // tempo
        15, // seed
        "euler", // sampler
        "apg", // model
        10, // guidance
        "", // prompt2
        0.5,
        0,
        3,
        true,
        false,
        true,
        "",
        0,
        0,
        false,
        0.5,
        null,
        "none",
      ],
      event_data: null,
      fn_index: 11,
      trigger_id: 45,
      session_hash,
    });

    let audioUrl;
    for (let i = 0; i < 60; i++) {
      await new Promise((res) => setTimeout(res, 2000));

      const { data: queueData } = await axios.get(
        `${this.musicEndpoint}/data?session_hash=${session_hash}`
      );
      const lines = queueData.split("\n\n");

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const d = JSON.parse(line.substring(6));
          if (d.msg === "process_completed") {
            audioUrl = d.output.data[0].url;
            break;
          } else if (d.msg === "process_failed") {
            throw new Error("⚠️ فشل توليد الموسيقى من الخادم.");
          }
        }
      }

      if (audioUrl) break;
    }

    if (!audioUrl)
      throw new Error("⏳ لم يتم الحصول على الموسيقى. حاول مجددًا.");

    return audioUrl;
  }
}

/** 🎶 POST /song-generator */
router.post("/", async (req, res) => {
  try {
    const { prompt, tags = "pop, acoustic, happy" } = req.body;

    if (!prompt)
      return res.status(400).json({
        status: false,
        message: "⚠️ يرجى كتابة وصف للأغنية (prompt)",
      });

    const generator = new SongGenerator();

    // 🧩 الخطوة 1: توليد كلمات
    const lyrics = await generator.generateLyrics(prompt);

    // 🧩 الخطوة 2: توليد الموسيقى
    const audioUrl = await generator.generateMusic({ lyrics, tags });

    res.json({
      status: true,
      message: "✅ تم توليد الأغنية بنجاح",
      lyrics,
      audioUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء توليد الأغنية",
      error: error.message,
    });
  }
});

/** 🎵 GET /song-generator */
router.get("/", async (req, res) => {
  try {
    const { prompt, tags = "pop, acoustic, happy" } = req.query;

    if (!prompt)
      return res.status(400).json({
        status: false,
        message: "⚠️ يرجى كتابة وصف للأغنية (prompt)",
      });

    const generator = new SongGenerator();
    const lyrics = await generator.generateLyrics(prompt);
    const audioUrl = await generator.generateMusic({ lyrics, tags });

    res.json({
      status: true,
      message: "✅ تم توليد الأغنية بنجاح",
      lyrics,
      audioUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء توليد الأغنية",
      error: error.message,
    });
  }
});

export default router;
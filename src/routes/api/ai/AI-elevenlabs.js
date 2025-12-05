import express from "express";
import axios from "axios";

const router = express.Router();

// ضع مفتاح API هنا مباشرة
const ELEVEN_API_KEY = "sk_efdc5ee0747bb449ad1bfa7776301bd2208b8e77c7fc9a89";

/* -------------------------------------------
🗣️ قائمة الأصوات (نفس قائمتك بالكامل)
------------------------------------------- */
const voices = [
  { arName: "ليانا", id: "Xb7hH8MSUJpSbSDYk0k2", desc: "صوت أنثوي واضح ومشرق" },
  { arName: "ميرال", id: "XB0fDUnXU5powFXDhCwa", desc: "صوت ناعم ودافئ" },
  { arName: "تاليا", id: "ThT5KcBeYPX3keUQqHPh", desc: "صوت أنثوي مشرق وحيوي" },
  { arName: "رِنا", id: "LcfcDJNUP1GQjkzn1xUU", desc: "صوت لطيف ومهذب" },
  { arName: "سيرين", id: "jsCqWAovK2LkecY7zXl4", desc: "صوت ناعم ومتزن" },
  { arName: "فاي", id: "jBpfuIE2acCO8z3wKNLl", desc: "صوت أنثوي حيوي" },
  { arName: "ياسمين", id: "oWAxZDx7w5VEj9dCyTzz", desc: "صوت راقي وأنيق" },
  { arName: "نوفا", id: "t0jbNlBVZ17f02VDIeMI", desc: "صوت شاب ومفعم بالحيوية" },
  { arName: "آية", id: "pFZP5JQG7iQjIQuC4Bku", desc: "صوت دافئ وحنون" },
  { arName: "لينا", id: "XrExE9yKIg1WjnnlVkGX", desc: "صوت بريطاني راقي" },
  { arName: "رودينا", id: "piTKgcLEGmPE4e6mEKli", desc: "صوت هادئ ومريح" },
  { arName: "جودي", id: "21m00Tcm4TlvDq8ikWAM", desc: "صوت احترافي وواضح" },
  { arName: "سلمى", id: "EXAVITQu4vr4xnSDxMaL", desc: "صوت ناعم ومعبر" },

  // رجال
  { arName: "ريان", id: "pNInz6obpgDQGcFmaJgB", desc: "صوت ذكوري متزن" },
  { arName: "جاد", id: "ErXwobaYiN019PkySvjV", desc: "صوت ذكوري قوي" },
  { arName: "باسل", id: "VR6AewLTigWG4xSOukaG", desc: "صوت عميق وقوي" },
  { arName: "سامي", id: "pqHfZKP75CvOlQylNhV4", desc: "صوت وثائقي احترافي" },
  { arName: "رامي", id: "nPczCjzI2devNBz1zQrb", desc: "صوت ذكوري واثق" },
  { arName: "كريم", id: "N2lVS1w4EtoT3dr4eOWO", desc: "صوت دافئ" },
  { arName: "نور", id: "IKne3meq5aSn9XLyUdCD", desc: "صوت ودي ولطيف" },
  { arName: "آدمو", id: "2EiwWnXFnvU5JabPnv8n", desc: "صوت أمريكي متوسط" },
  { arName: "فهد", id: "onwK4e9ZLuTAKqWW03F9", desc: "صوت ذكوري رسمي" },
  { arName: "دان", id: "CYw3kZ02Hs0563khs1Fj", desc: "صوت بريطاني شاب" },
  { arName: "ليو", id: "29vD33N1CtxCmqQRPOHJ", desc: "صوت أمريكي حيوي" },
];

/* -------------------------------------------
🎧 Class ElevenLabs
------------------------------------------- */
class ElevenLabsTTS {
  constructor() {
    this.apiKey = ELEVEN_API_KEY;
    this.baseUrl = "https://api.elevenlabs.io/v1/text-to-speech/";
  }

  async generate({ voiceId, text }) {
    const response = await axios.post(
      `${this.baseUrl}${voiceId}`,
      {
        text,
        voice_settings: { stability: 0.7, similarity_boost: 0.9 },
      },
      {
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    return {
      file: Buffer.from(response.data).toString("base64"),
      mimetype: "audio/mpeg",
    };
  }
}

/* -------------------------------------------
🧩 POST - Body { voice, text }
------------------------------------------- */
router.post("/", async (req, res) => {
  try {
    const { voice, text } = req.body;

    if (!voice || !text)
      return res.json({ status: false, message: "ارسل voice و text" });

    const voiceObj = voices.find(v => v.arName === voice);
    if (!voiceObj)
      return res.json({ status: false, message: "الصوت غير موجود" });

    const tts = new ElevenLabsTTS();
    const result = await tts.generate({ voiceId: voiceObj.id, text });

    res.json({
      status: true,
      voice,
      response: `data:audio/mpeg;base64,${result.file}`,
    });
  } catch (e) {
    res.json({ status: false, error: e.message });
  }
});

/* -------------------------------------------
🧩 GET - Query ?voice=ليانا&text=مرحبا
------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const { voice, text } = req.query;

    if (!voice || !text)
      return res.json({ status: false, message: "ارسل voice و text" });

    const voiceObj = voices.find(v => v.arName === voice);
    if (!voiceObj)
      return res.json({ status: false, message: "الصوت غير موجود" });

    const tts = new ElevenLabsTTS();
    const result = await tts.generate({ voiceId: voiceObj.id, text });

    res.json({
      status: true,
      voice,
      response: `data:audio/mpeg;base64,${result.file}`,
    });
  } catch (e) {
    res.json({ status: false, error: e.message });
  }
});

/* -------------------------------------------
📘 الأصوات
------------------------------------------- */
router.get("/voices", (req, res) => {
  res.json({
    status: true,
    voices,
  });
});

export default router;
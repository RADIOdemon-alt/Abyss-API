// plugins/elevenlabs-squinty-api.js
import express from "express";
import axios from "axios";
import crypto from "crypto";

const router = express.Router();

const voices = {
  'ادم': 'pNInz6obpgDQGcFmaJgB',
  'بيلا': 'EXAVITQu4vr4xnSDxMaL',
  'جوش': 'TxGEqnHWrfWFTfGW9XjX',
  'ريتشيل': '21m00Tcm4TlvDq8ikWAM',
  'كلايد': '2EiwWnXFnvU5JabPnv8n',
  'دومي': 'AZnzlk1XvdvUeBnXmlld',
  'جوزفين': 'Xb7hH8MSUJpSbSDYk0k2',
  'سارة': 'EXAVITQu4vr4xnSDxMaL',
  'كالوم': 'N2lVS1w4EtoT3dr4eOWO',
  'جورج': 'JBFqnCBsd6RMkjVDRZzb',
  'باتريك': 'ODq5zmih8GrVes37Dizd',
  'كريس': 'ZQe5CZNOzWyzPSCn5a3c',
  'ماتيلدا': 'Xb7hH8MSUJpSbSDYk0k2',
  'دانيال': 'onwK4e9ZLuTAKqWW03F9',
  'ريفر': 'VR6AewLTigWG4xSOukaG',
  'بيل': 'pqHfZKP75CvOlQylNhV4',
  'تشارلي': 'iP95p4xoKVk53GoZ742B',
  'كالم': 'N2lVS1w4EtoT3dr4eOWO'
};

class ElevenLabs {
  constructor() {
    this.ins = axios.create({
      baseURL: "https://tts1.squinty.art/api/v1",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "user-agent": "NX/1.0.0",
      },
    });
  }

  genLogin() {
    const randHex = (l) => crypto.randomUUID().replace(/-/g, "").slice(0, l),
      randNum = (d) => String(Math.floor(Math.random() * 10 ** d)).padStart(d, "0"),
      getRand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
      b = getRand(0, 4);

    const [devices, country, lang, zone, ...nn] = [
      [
        "Samsung Galaxy S25 Ultra",
        "Google Pixel 10",
        "OnePlus 13",
        "Xiaomi 15 Ultra",
        "Oppo Find X8 Pro",
      ],
      ["ID", "VN", "PH", "MM", "JP"],
      ["id", "vi", "en", "my", "jp"],
      [
        "Asia/Jakarta",
        "Asia/Ho_Chi_Minh",
        "Asia/Manila",
        "Asia/Yangon",
        "Asia/Tokyo",
      ],
      ["Hiro", "Yuki", "Sora", "Riku", "Kaito"],
      ["Tanaka", "Sato", "Nakamura", "Kobayashi", "Yamamoto"],
    ];

    const [fn, ln] = nn.map((z) => z[Math.floor(Math.random() * z.length)]);

    return {
      build: "14",
      country: country[b],
      deviceId: randHex(16),
      deviceModel: `${devices[getRand(0, devices.length - 1)]}`,
      displayName: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}${randNum(4)}${randHex(4)}@gmail.com`,
      googleAccountId: randNum(18),
      language: lang[b],
      osVersion: String(26 + Math.floor(Math.random() * 4)),
      platform: "android",
      timeZone: zone[b],
      version: "1.1.4",
    };
  }

  async login() {
    const z = await this.ins.post("/login/login", this.genLogin());
    this.ins.defaults.headers.common.authorization = "Bearer " + z.data.token;
  }

  async create(f = {}) {
    const { data } = await this.ins.post("/generate/generate", {
      text: f.text || "hello world",
      voiceId: f.id || "2EiwWnXFnvU5JabPnv8n",
      modelId: f.model || "eleven_turbo_v2_5",
      styleExaggeration: f.exaggeration || "50",
      claritySimilarityBoost: f.clarity || "50",
      stability: f.stability || "50",
    });
    return data;
  }
}

// GET / POST
router.get("/", async (req, res) => {
  try {
    const { prompt, voice } = req.query;
    if (!prompt || !voice)
      return res
        .status(400)
        .json({ status: false, message: "❌ يرجى إدخال prompt و voice" });

    const voiceId = voices[voice];
    if (!voiceId)
      return res
        .status(400)
        .json({ status: false, message: "❌ الصوت غير موجود" });

    const eleven = new ElevenLabs();
    await eleven.login();
    const data = await eleven.create({ text: prompt, id: voiceId });

    if (!data?.url) throw new Error("لم يتم استلام رابط الصوت");

    res.json({ status: true, url: data.url });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

// 🎧 POST
router.post("/", async (req, res) => {
  try {
    const { prompt, voice } = req.body;
    if (!prompt || !voice)
      return res
        .status(400)
        .json({ status: false, message: "❌ يرجى إدخال prompt و voice" });

    const voiceId = voices[voice];
    if (!voiceId)
      return res
        .status(400)
        .json({ status: false, message: "❌ الصوت غير موجود" });

    const eleven = new ElevenLabs();
    await eleven.login();
    const data = await eleven.create({ text: prompt, id: voiceId });

    if (!data?.url) throw new Error("لم يتم استلام رابط الصوت");

    res.json({ status: true, url: data.url });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

export default router;

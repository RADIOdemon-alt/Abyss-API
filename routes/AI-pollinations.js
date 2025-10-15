import express from 'express';
import axios from 'axios';

const router = express.Router();

// موديلات AI
const chatModels = {
  gpt: { name: "gpt", description: "🎯 GPT | موديل أساسي", command: "gpt", emoji: "🤖" },
  nemo: { name: "mistral", description: "🍷 Mistral Nemo | فرنسي", command: "نيمو", emoji: "🇫🇷" },
  "ديب برو": { name: "deepseek-r1", description: "🧠 DeepSeek-R1 Distill", command: "ديب-برو", emoji: "🧬" },
  كوين: { name: "qwen-coder", description: "👨‍💻 Qwen Coder 32B", command: "كوين", emoji: "💻" },
  "جيمناي فلاش": { name: "gemini", description: "💠 Gemini Flash", command: "جيمناي-فلاش", emoji: "♠️" },
  مايكروسوفت: { name: "phi", description: "📡 Phi-4 | من مايكروسوفت", command: "مايكروسوفت", emoji: "🪐" },
  ليما: { name: "llama", description: "🦙 Llama 3.3 | مفتوح المصدر", command: "ليما", emoji: "🌿" },
  منطق: { name: "o1", description: "🧩 o1-mini | متخصص في المنطق", command: "منطق", emoji: "🧮" },
  جيمناي: { name: "geminit", description: "🔮 Gemini Thinking", command: "جيمناي-بلسو", emoji: "🧘‍♂️" }
};

// إعداد Pollinations API
const pollinations = {
  api: { chat: "https://text.pollinations.ai" },
  header: {
    'Connection': 'keep-alive',
    'sec-ch-ua-platform': '"Android"',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Origin': 'https://freeai.aihub.ren',
    'X-Requested-With': 'mark.via.gp',
    'Referer': 'https://freeai.aihub.ren/',
    'Accept-Language': 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7'
  }
};

// دالة التواصل مع Pollinations
async function chatWithPollinations(model, question) {
  try {
    const res = await axios.get(`${pollinations.api.chat}/${encodeURIComponent(question)}`, {
      params: { model },
      headers: pollinations.header,
      timeout: 15000,
    });
    return res.data;
  } catch (e) {
    if (e.code === 'ECONNABORTED') throw new Error("⏱ الخادم تأخر بالرد.");
    throw new Error(`❌ خطأ: ${e.message}`);
  }
}

// POST /api/ai
router.post('/', async (req, res) => {
  const { model, text } = req.body;

  if (!text) return res.status(400).json({ status: false, message: "⚠️ أرسل نص" });
  if (!model || !chatModels[model]) return res.status(400).json({ status: false, message: "⚠️ موديل غير صحيح" });

  try {
    const answer = await chatWithPollinations(chatModels[model].name, text);
    res.json({ status: true, model: chatModels[model].description, text: answer });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

// GET /api/ai?model=gpt&text=مرحبا
router.get('/', async (req, res) => {
  const { model, text } = req.query;

  if (!text || !model || !chatModels[model]) 
    return res.status(400).json({ status: false, message: "⚠️ استخدم ?text=...&model=..." });

  try {
    const answer = await chatWithPollinations(chatModels[model].name, text);
    res.json({ status: true, model: chatModels[model].description, text: answer });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

export default router;
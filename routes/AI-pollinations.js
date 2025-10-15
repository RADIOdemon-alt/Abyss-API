import express from 'express';
import axios from 'axios';
const router = express.Router();

const headers = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.163 Mobile Safari/537.36',
  'Accept': 'application/json'
};

// موديلات AI
const chatModels = {
  gpt: 'gpt',
  nemo: 'mistral',
  "ديب برو": 'deepseekr1',
  كوين: 'qwen',
  "جيمناي فلاش": 'gemini',
  مايكروسوفت: 'phi',
  ليما: 'llama',
  منطق: 'o1',
  جيمناي: 'geminit'
};

// POST /api/ai
router.post('/', async (req, res) => {
  const { text, model } = req.body;
  if (!text) return res.status(400).json({ status: false, message: "⚠️ أرسل نص" });
  if (!model || !chatModels[model]) return res.status(400).json({ status: false, message: "⚠️ موديل غير صحيح" });

  try {
    const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(text)}`, {
      params: { model: chatModels[model] },
      headers
    });
    res.json({ status: true, text: response.data });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

// GET /api/ai?text=مرحبا&model=gpt
router.get('/', async (req, res) => {
  const { text, model } = req.query;
  if (!text || !model || !chatModels[model]) return res.json({ status: false, message: "⚠️ استخدم ?text=...&model=..." });

  try {
    const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(text)}`, {
      params: { model: chatModels[model] },
      headers
    });
    res.json({ status: true, text: response.data });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

export default router;

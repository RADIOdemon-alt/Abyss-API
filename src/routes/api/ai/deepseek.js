
import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

class DeepSeekClient {
  constructor() {
    this.origin = "https://deep-seek.chat";
    this.headers = {
      origin: this.origin,
      "user-agent": "Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0",
      accept: "*/*",
      "accept-language": "ar,en-US;q=0.9,en;q=0.8"
    };
  }

  async sendMessage({ input = "مرحباً", model = "deepseek-v3" } = {}) {
    const html = await axios.get(this.origin, { headers: this.headers }).then(r => r.data);
    const match = html.match(/window\.DeepSeekConfig\s*=\s*({[\s\S]*?});/);
    if (!match || !match[1]) throw new Error("تعذر العثور على إعدادات DeepSeek");

    const config = JSON.parse(match[1]);
    if (!config.ajax_url || !config.nonce) throw new Error("إعدادات الخادم غير صالحة");

    const form = new FormData();
    form.append("action", "deepseek_chat");
    form.append("nonce", config.nonce);
    form.append("message", input);
    form.append("model", model);
    form.append("save_conversation", "0");
    form.append("session_only", "1");

    const res = await axios.post(config.ajax_url, form, {
      headers: { ...this.headers, ...form.getHeaders() },
      timeout: 60_000
    });

    return res.data;
  }
}

// 🧹 دالة تنظيف الاستجابة
function cleanResponse(raw) {
  let text = String(raw);
  
  // إزالة الأجزاء غير المرغوبة
  text = text
    .replace(/response:\s*/gi, '')
    .replace(/conversation_id:\s*conv_[a-z0-9]+/gi, '')
    .replace(/formatted_html:\s*/gi, '')
    .replace(/usage:\s*prompt_tokens.*?total_tokens:\s*\d+/gi, '')
    .replace(/,\s*conversation_id:/gi, '')
    .replace(/,\s*formatted_html:/gi, '')
    .replace(/,\s*usage:/gi, '')
    .replace(/prompt_tokens:\s*\d+/gi, '')
    .replace(/completion_tokens:\s*\d+/gi, '')
    .replace(/total_tokens:\s*\d+/gi, '');
    
  // إزالة HTML tags
  text = text.replace(/<\/?[^>]+(>|$)/g, '');
  
  // إزالة الأقواس والرموز الزائدة
  text = text.replace(/^[{}\[\]",\s]+|[{}\[\]",\s]+$/g, '');
  
  // تنظيف الفواصل المتكررة
  text = text.replace(/,{2,}/g, ',');
  
  // إزالة المسافات الزائدة
  text = text.replace(/\s{2,}/g, ' ');
  
  // تنظيف السطور الفارغة
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { prompt, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ النص مطلوب (prompt)" 
      });
    }

    const client = new DeepSeekClient();
    const data = await client.sendMessage({ 
      input: prompt, 
      model: model || "deepseek-v3" 
    });

    // استخراج الرد النصي فقط
    let responseText = data?.response || data?.output || data?.data || "";
    
    if (typeof responseText === "object") {
      responseText = responseText.response || responseText.output || JSON.stringify(responseText);
    }

    // تنظيف الاستجابة
    let cleaned = cleanResponse(responseText);

    if (!cleaned || cleaned.length < 2) {
      return res.status(500).json({ 
        status: false, 
        message: "⚠️ لم يتم الحصول على استجابة واضحة من DeepSeek" 
      });
    }

    res.json({ 
      status: true, 
      message: "✅ تم الحصول على الرد بنجاح", 
      response: cleaned,
      model: model || "deepseek-v3"
    });

  } catch (err) {
    console.error("DeepSeek API Error:", err.message);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء التواصل مع DeepSeek API", 
      error: err.message 
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { prompt, model } = req.query;
    
    if (!prompt) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ النص مطلوب (prompt)" 
      });
    }

    const client = new DeepSeekClient();
    const data = await client.sendMessage({ 
      input: prompt, 
      model: model || "deepseek-v3" 
    });

    // استخراج الرد النصي فقط
    let responseText = data?.response || data?.output || data?.data || "";
    
    if (typeof responseText === "object") {
      responseText = responseText.response || responseText.output || JSON.stringify(responseText);
    }

    // تنظيف الاستجابة
    let cleaned = cleanResponse(responseText);

    if (!cleaned || cleaned.length < 2) {
      return res.status(500).json({ 
        status: false, 
        message: "⚠️ لم يتم الحصول على استجابة واضحة من DeepSeek" 
      });
    }

    res.json({ 
      status: true, 
      message: "✅ تم الحصول على الرد بنجاح", 
      response: cleaned,
      model: model || "deepseek-v3"
    });

  } catch (err) {
    console.error("DeepSeek API Error:", err.message);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء التواصل مع DeepSeek API", 
      error: err.message 
    });
  }
});

export default router;
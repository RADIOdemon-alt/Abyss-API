import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

class ClaudeAPI {
  constructor() {
    this.baseUrl = "https://claudeai.one";
    this.headers = {
      Accept: "*/*",
      Referer: "https://claudeai.one/",
      Origin: "https://claudeai.one",
    };
  }

  getDataAttr(html, attr) {
    const re = new RegExp(`data-${attr}\\s*=\\s*["']([^"']+)["']`, "i");
    const m = html.match(re);
    return m ? m[1] : "";
  }

  generateClientId() {
    return "JHFiony-" + Math.random().toString(36).substring(2, 12);
  }

  cleanResponse(text) {
    return text
      .replace(/\$~~~\$[\s\S]*?\$~~~\$/g, "")
      .trim()
      .replace(/\\n/g, "\n")
      .replace(/\s+/g, " ")
      .replace(
        /[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\w\s\*\-\.،؛؟!\n]/g,
        ""
      );
  }

  async chat({ message }) {
    if (!message) throw new Error("Message is required");

    // 1️⃣ الحصول على البيانات المطلوبة من الصفحة الرئيسية
    const { data: html } = await axios.get(this.baseUrl, {
      headers: this.headers,
    });

    const nonce = this.getDataAttr(html, "nonce");
    const postId = this.getDataAttr(html, "post-id");
    const botId = this.getDataAttr(html, "bot-id");

    const clientIdMatch = html.match(
      /localStorage\.setItem\(['"]wpaicg_chat_client_id['"],\s*['"]([^'"]+)['"]\)/
    );
    const clientId = clientIdMatch?.[1] ?? this.generateClientId();

    // 2️⃣ إعداد الطلب
    const form = new FormData();
    form.append("_wpnonce", nonce);
    form.append("post_id", postId);
    form.append("url", this.baseUrl);
    form.append("action", "wpaicg_chat_shortcode_message");
    form.append("message", message);
    form.append("bot_id", botId);
    form.append("chatbot_identity", "shortcode");
    form.append("wpaicg_chat_history", "[]");
    form.append("wpaicg_chat_client_id", clientId);

    // 3️⃣ إرسال الطلب
    const { data: resp } = await axios.post(
      `${this.baseUrl}/wp-admin/admin-ajax.php`,
      form,
      {
        headers: {
          ...this.headers,
          ...form.getHeaders(),
        },
      }
    );

    return resp;
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ الرسالة مطلوبة (message)" });

    const claude = new ClaudeAPI();
    const result = await claude.chat({ message });

    const answer = result?.data;
    if (!answer)
      return res.status(500).json({
        status: false,
        message: "⚠️ لم يتم الحصول على استجابة من Claude",
      });

    const cleaned = claude.cleanResponse(answer);

    res.json({
      status: true,
      message: "✅ تم الحصول على الرد بنجاح",
      response: cleaned,
    });
  } catch (err) {
    console.error("Claude API Error:", err.response?.data || err.message);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التواصل مع Claude API",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { message } = req.query;

    if (!message)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ الرسالة مطلوبة (message)" });

    const claude = new ClaudeAPI();
    const result = await claude.chat({ message });

    const answer = result?.data;
    if (!answer)
      return res.status(500).json({
        status: false,
        message: "⚠️ لم يتم الحصول على استجابة من Claude",
      });

    const cleaned = claude.cleanResponse(answer);

    res.json({
      status: true,
      message: "✅ تم الحصول على الرد بنجاح",
      response: cleaned,
    });
  } catch (err) {
    console.error("Claude API Error:", err.response?.data || err.message);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التواصل مع Claude API",
      error: err.message,
    });
  }
});

export default router;
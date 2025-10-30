import express from "express";
import WebSocket from "ws";
import axios from "axios";

const router = express.Router();

/** 🧠 Copilot API Class */
class CopilotAPI {
  constructor() {
    this.conversationId = null;
    this.models = {
      default: "chat",
      "think-deeper": "reasoning",
      "gpt-5": "smart",
    };
    this.headers = {
      origin: "https://copilot.microsoft.com",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36",
    };
  }

  /** إنشاء محادثة جديدة */
  async createConversation() {
    const { data } = await axios.post(
      "https://copilot.microsoft.com/c/api/conversations",
      null,
      { headers: this.headers }
    );
    this.conversationId = data.id;
    return this.conversationId;
  }

  /** إرسال رسالة إلى Copilot */
  async chat(message, { model = "default" } = {}) {
    if (!message) throw new Error("⚠️ النص مطلوب (prompt)");
    if (!this.models[model])
      throw new Error(
        `النموذج غير معروف. النماذج المتاحة: ${Object.keys(this.models).join(", ")}`
      );
    if (!this.conversationId) await this.createConversation();

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `wss://copilot.microsoft.com/c/api/chat?api-version=2&features=-,ncedge,edgepagecontext&setflight=-,ncedge,edgepagecontext&ncedge=1`,
        { headers: this.headers }
      );

      const response = { text: "", citations: [] };

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            event: "setOptions",
            supportedFeatures: ["partial-generated-images"],
            supportedCards: [
              "weather",
              "local",
              "image",
              "sports",
              "video",
              "ads",
              "safetyHelpline",
              "quiz",
              "finance",
              "recipe",
            ],
            ads: {
              supportedTypes: [
                "text",
                "product",
                "multimedia",
                "tourActivity",
                "propertyPromotion",
              ],
            },
          })
        );

        ws.send(
          JSON.stringify({
            event: "send",
            mode: this.models[model],
            conversationId: this.conversationId,
            content: [{ type: "text", text: message }],
            context: {},
          })
        );
      });

      ws.on("message", (chunk) => {
        try {
          const parsed = JSON.parse(chunk.toString());
          switch (parsed.event) {
            case "appendText":
              response.text += parsed.text || "";
              break;
            case "citation":
              response.citations.push({
                title: parsed.title,
                icon: parsed.iconUrl,
                url: parsed.url,
              });
              break;
            case "done":
              ws.close();
              resolve(response);
              break;
            case "error":
              ws.close();
              reject(new Error(parsed.message));
              break;
          }
        } catch (err) {
          ws.close();
          reject(err);
        }
      });

      ws.on("error", (err) => {
        reject(err);
      });
    });
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { prompt, model = "default" } = req.body;
    if (!prompt)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ النص مطلوب (prompt)" });

    const copilot = new CopilotAPI();
    const result = await copilot.chat(prompt, { model });

    if (!result.text)
      return res
        .status(500)
        .json({ status: false, message: "⚠️ لم يتم الحصول على رد من Copilot" });

    res.json({
      status: true,
      model,
      message: "✅ تم الحصول على الرد بنجاح",
      response: result.text.trim(),
      citations: result.citations,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التواصل مع Copilot API",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const prompt = req.query.prompt;
    const model = req.query.model || "default";

    if (!prompt)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ النص مطلوب (prompt)" });

    const copilot = new CopilotAPI();
    const result = await copilot.chat(prompt, { model });

    if (!result.text)
      return res
        .status(500)
        .json({ status: false, message: "⚠️ لم يتم الحصول على رد من Copilot" });

    res.json({
      status: true,
      model,
      message: "✅ تم الحصول على الرد بنجاح",
      response: result.text.trim(),
      citations: result.citations,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التواصل مع Copilot API",
      error: err.message,
    });
  }
});

export default router;

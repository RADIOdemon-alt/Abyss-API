import express from "express";
import axios from "axios";

const router = express.Router();

class AICodeGenerator {
  constructor() {
    this.aiBaseUrl = "https://dark-api-x.vercel.app/api/v1/ai/gemini";
  }

  async analyzeAPI(apiUrl) {
    try {
      const testUrl = apiUrl.replace("$", encodeURIComponent("test"));
      const res = await axios.get(testUrl);
      return res.data;
    } catch (error) {
      throw new Error("فشل تحليل الـ API: " + error.message);
    }
  }

  async generateCode(api, commandName, apiResponse) {
    const prompt = `أنت مبرمج محترف متخصص في بوتات واتساب. قم بإنشاء كود JavaScript handler كامل.

📌 معلومات الـ API:
- الرابط: ${api}
- اسم الأمر: ${commandName}

📌 مثال على استجابة الـ API:
${JSON.stringify(apiResponse, null, 2)}

📌 المطلوب منك:
1. تحليل بنية الاستجابة (results, data, items, etc.)
2. تحديد الحقول المهمة (title, url, video, audio, download, link, etc.)
3. إنشاء كود يعرض المعلومات بشكل منظم
4. إذا كان هناك روابط تحميل/فيديو/صوت، يجب إرسالها كملفات وليس نص فقط

📌 أمثلة على الأكواد الصحيحة:

**مثال 1: بحث عادي (نصوص فقط)**
\`\`\`javascript
import fetch from "node-fetch";
const handler = async (m, { conn, text }) => {
  if (!text) return m.reply("اكتب نص البحث");
  try {
    const url = \`https://api.com/search?q=\${encodeURIComponent(text)}\`;
    const r = await fetch(url);
    const j = await r.json();
    
    if (!j.results?.length) return m.reply("لا توجد نتائج");
    
    let msg = \`🔍 نتائج البحث عن: \${text}\\n\\n\`;
    j.results.slice(0, 5).forEach((item, i) => {
      msg += \`\${i + 1}. \${item.title}\\n\`;
      msg += \`🔗 \${item.url}\\n\\n\`;
    });
    
    conn.sendMessage(m.chat, { text: msg }, { quoted: m });
  } catch (e) {
    m.reply("❌ " + e.message);
  }
};
handler.command = ["بحث"];
export default handler;
\`\`\`

**مثال 2: تحميل فيديو/صوت (يجب إرسال الملف)**
\`\`\`javascript
import fetch from "node-fetch";
const handler = async (m, { conn, text }) => {
  if (!text) return m.reply("اكتب اسم الفيديو");
  try {
    await m.reply("⏳ جاري البحث...");
    
    const url = \`https://api.com/download?q=\${encodeURIComponent(text)}\`;
    const r = await fetch(url);
    const j = await r.json();
    
    if (!j.download_url) return m.reply("❌ لم يتم العثور على الفيديو");
    
    // إرسال معلومات
    let info = \`✅ تم العثور على:\\n\`;
    info += \`📌 العنوان: \${j.title}\\n\`;
    info += \`⏱️ المدة: \${j.duration}\\n\`;
    info += \`👁️ المشاهدات: \${j.views}\\n\\n\`;
    info += \`⏳ جاري التحميل...\`;
    await m.reply(info);
    
    // إرسال الفيديو
    await conn.sendMessage(m.chat, {
      video: { url: j.download_url },
      caption: \`🎬 \${j.title}\`,
      mimetype: 'video/mp4'
    }, { quoted: m });
    
  } catch (e) {
    m.reply("❌ " + e.message);
  }
};
handler.command = ["تحميل"];
export default handler;
\`\`\`

**مثال 3: تحميل صوت**
\`\`\`javascript
import fetch from "node-fetch";
const handler = async (m, { conn, text }) => {
  if (!text) return m.reply("اكتب اسم الأغنية");
  try {
    const url = \`https://api.com/music?q=\${encodeURIComponent(text)}\`;
    const r = await fetch(url);
    const j = await r.json();
    
    if (!j.audio_url) return m.reply("❌ لم يتم العثور على الأغنية");
    
    await conn.sendMessage(m.chat, {
      audio: { url: j.audio_url },
      mimetype: 'audio/mp4',
      fileName: \`\${j.title}.mp3\`
    }, { quoted: m });
    
  } catch (e) {
    m.reply("❌ " + e.message);
  }
};
handler.command = ["اغنية"];
export default handler;
\`\`\`

📌 قواعد مهمة:
- إذا كان الـ API يرجع روابط فيديو: استخدم conn.sendMessage مع video: { url: ... }
- إذا كان الـ API يرجع روابط صوت: استخدم conn.sendMessage مع audio: { url: ... }
- إذا كان الـ API يرجع روابط صور: استخدم conn.sendMessage مع image: { url: ... }
- إذا كان الـ API يرجع بيانات نصية فقط: استخدم text: ...
- لا ترسل الروابط كنص، بل أرسلها كملفات
- استخدم async/await بشكل صحيح
- أضف رسائل انتظار للمستخدم

الآن قم بتحليل استجابة الـ API أعلاه وأنشئ الكود المناسب. أرجع الكود فقط بدون شرح.`;

    try {
      const aiUrl = `${this.aiBaseUrl}?prompt=${encodeURIComponent(prompt)}`;
      const aiRes = await axios.get(aiUrl);
      const aiJson = aiRes.data;

      let generatedCode = "";

      if (aiJson.status && aiJson.result) {
        generatedCode = aiJson.result;
      } else if (aiJson.result) {
        generatedCode = aiJson.result;
      } else if (aiJson.response) {
        generatedCode = aiJson.response;
      } else if (aiJson.message) {
        generatedCode = aiJson.message;
      } else if (aiJson.data) {
        generatedCode = aiJson.data;
      } else {
        throw new Error("استجابة غير متوقعة من الـ AI");
      }

      if (!generatedCode || generatedCode.trim() === "") {
        throw new Error("الذكاء الاصطناعي لم يرجع كود");
      }

      // استخراج الكود من بين ```
      const codeMatch = generatedCode.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
      if (codeMatch) {
        generatedCode = codeMatch[1].trim();
      }

      return generatedCode;
    } catch (error) {
      throw new Error("فشل توليد الكود: " + error.message);
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { api, commandName } = req.body;

    if (!api || !commandName) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الـ API واسم الأمر مطلوبان",
      });
    }

    const generator = new AICodeGenerator();

    // تحليل الـ API
    const apiResponse = await generator.analyzeAPI(api);

    if (!apiResponse) {
      return res.status(500).json({
        status: false,
        message: "❌ الـ API لم يرجع بيانات",
      });
    }

    // توليد الكود
    const generatedCode = await generator.generateCode(api, commandName, apiResponse);

    res.json({
      status: true,
      message: "✅ تم إنشاء الكود بنجاح",
      data: {
        command: commandName,
        api: api,
        code: generatedCode,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { api, commandName } = req.query;

    if (!api || !commandName) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الـ API واسم الأمر مطلوبان (api و commandName)",
        example: "?api=https://api.com/search?q=$&commandName=بحث",
      });
    }

    const generator = new AICodeGenerator();

    // تحليل الـ API
    const apiResponse = await generator.analyzeAPI(api);

    if (!apiResponse) {
      return res.status(500).json({
        status: false,
        message: "❌ الـ API لم يرجع بيانات",
      });
    }

    // توليد الكود
    const generatedCode = await generator.generateCode(api, commandName, apiResponse);

    res.json({
      status: true,
      message: "✅ تم إنشاء الكود بنجاح",
      data: {
        command: commandName,
        api: api,
        code: generatedCode,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ",
      error: err.message,
    });
  }
});

export default router;
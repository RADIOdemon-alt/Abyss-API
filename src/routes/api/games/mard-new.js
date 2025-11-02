// 📁 routes/mardAnswer.js
import express from "express";
import axios from "axios";

const router = express.Router();

/** 🎩 كلاس خاص بالتعامل مع Akinator */
class MaridAPI {
  constructor() {
    this.baseUrl = "https://ar.akinator.com";
    this.headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "ar,en;q=0.9",
    };
  }

  /** 🔹 إرسال الإجابة وجلب السؤال التالي */
  async nextQuestion({ session, signature, step, answer, progression = "0.0" }) {
    if (!session || !signature || step === undefined || answer === undefined)
      throw new Error("⚠️ البيانات المطلوبة غير مكتملة (session, signature, step, answer)");

    const body = new URLSearchParams({
      session,
      signature,
      step,
      answer,
      progression,
      cm: "false",
      sid: "1",
    });

    const response = await axios.post(`${this.baseUrl}/answer`, body, {
      headers: this.headers,
    });

    const html = response.data;

    // 🔍 استخراج السؤال التالي
    const match = html.match(/<div id="question-label"[^>]*>(.*?)<\/div>/);
    const nextQuestion = match ? match[1].trim() : null;

    // 🔍 استخراج صورة المارد أو akitude
    const akitudeMatch = html.match(/akitudes_520x650\/(.*?)"/);
    const akitude_url = akitudeMatch
      ? `${this.baseUrl}/assets/img/akitudes_520x650/${akitudeMatch[1]}`
      : null;

    return {
      status: true,
      message: nextQuestion
        ? "✅ تم جلب السؤال التالي بنجاح"
        : "⚠️ لم يتم العثور على سؤال جديد (ربما انتهت الجولة)",
      question: nextQuestion,
      akitude_url,
    };
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { session, signature, step, answer, progression } = req.body;

    const marid = new MaridAPI();
    const result = await marid.nextQuestion({
      session,
      signature,
      step,
      answer,
      progression,
    });

    res.json(result);
  } catch (err) {
    console.error("❌ خطأ أثناء جلب السؤال التالي:", err.message);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التواصل مع Akinator",
      error: err.message,
    });
  }
});

/** 🧩 GET Route (اختياري لاختبار مباشر عبر المتصفح) */
router.get("/", async (req, res) => {
  try {
    const { session, signature, step, answer, progression } = req.query;

    const marid = new MaridAPI();
    const result = await marid.nextQuestion({
      session,
      signature,
      step,
      answer,
      progression,
    });

    res.json(result);
  } catch (err) {
    console.error("❌ خطأ أثناء جلب السؤال التالي:", err.message);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التواصل مع Akinator",
      error: err.message,
    });
  }
});

export default router;
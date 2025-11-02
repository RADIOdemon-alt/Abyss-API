import express from "express";
import axios from "axios";

const router = express.Router();

class AkinatorAPI {
  constructor() {
    this.base = "https://ar.akinator.com";
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  async answer({ session, signature, step, answer, progression, extra = {} }) {
    const body = new URLSearchParams({
      session,
      signature,
      step,
      answer,
      progression,
      cm: "false",
      sid: "NaN",
      ...extra,
    });

    const res = await axios.post(`${this.base}/answer`, body.toString(), {
      headers: this.headers,
    });
    return res.data;
  }

  async cancelAnswer({ session, signature, step, progression, extra = {} }) {
    const body = new URLSearchParams({
      session,
      signature,
      step,
      progression,
      cm: "false",
      sid: "NaN",
      ...extra,
    });

    const res = await axios.post(`${this.base}/cancel_answer`, body.toString(), {
      headers: this.headers,
    });
    return res.data;
  }

  // مساعدة لاستخراج نص السؤال من أي استجابة محتملة
  extractQuestion(data) {
    if (!data) return null;
    return (
      data.question ||
      data.question_label ||
      data.questionText ||
      data.question_text ||
      (data.questionHTML ? this.stripHtml(data.questionHTML) : null) ||
      null
    );
  }

  stripHtml(html) {
    return String(html).replace(/<\/?[^>]+(>|$)/g, "").trim();
  }
}

/** POST /api/mard/answer
 * Body: { session, signature, step, answer, progression }
 * يُعيد: السؤال التالي أو نتيجة completion مع الحقل raw
 */
router.post("/answer", async (req, res) => {
  try {
    const { session, signature, step, answer, progression } = req.body;

    if (!session || !signature || step == null || answer == null) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الحقول المطلوبة: session, signature, step, answer",
      });
    }

    const api = new AkinatorAPI();

    // 1) نرسل الإجابة أولاً
    const ansData = await api.answer({ session, signature, step, answer, progression });

    // 2) نحاول استخراج السؤال مباشرة من جواب /answer
    const nextQ = api.extractQuestion(ansData);

    if (nextQ) {
      return res.json({
        status: true,
        message: "✅ سؤال جديد مستلم من /answer",
        question: nextQ,
        raw: ansData,
      });
    }

    // 3) إذا جاء completion/guess أعدها مباشرة
    if (ansData.completion || ansData.guess || ansData.results) {
      return res.json({
        status: true,
        message: "✅ Akinator أعطى نتيجة / completion",
        type: "completion",
        data: ansData,
      });
    }

    // 4) fallback: نطلب cancel_answer لاسترجاع السؤال الحالي
    const cancelData = await api.cancelAnswer({ session, signature, step, progression });
    const canceledQ = api.extractQuestion(cancelData);

    if (canceledQ) {
      return res.json({
        status: true,
        message: "✅ سؤال مسترجع من /cancel_answer (fallback)",
        question: canceledQ,
        raw: cancelData,
      });
    }

    // 5) لم نتمكن من الحصول على سؤال — أعد الخام للمراجعة
    return res.status(500).json({
      status: false,
      message: "❌ لم يتم الحصول على سؤال من /answer أو /cancel_answer",
      ansRaw: ansData,
      cancelRaw: cancelData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التواصل مع Akinator",
      error: err.message,
      raw: err.response?.data,
    });
  }
});

/** GET /api/mard/answer (للاختبار السريع عبر query params) */
router.get("/answer", async (req, res) => {
  // يقبل نفس الحقول كـ query (session, signature, step, answer, progression)
  req.body = { ...req.body, ...req.query };
  return router.handle(req, res);
});

export default router;
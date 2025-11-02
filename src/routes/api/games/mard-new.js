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

  /** 🔍 استخراج نص السؤال */
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

  /** 🧩 تنظيف HTML */
  stripHtml(html) {
    return String(html).replace(/<\/?[^>]+(>|$)/g, "").trim();
  }

  /** 🧠 استخراج النتيجة (الشخصية) */
  extractCompletion(data) {
    if (!data) return null;

    const isCompletion =
      data.completion === "KO" ||
      data.guess ||
      data.results ||
      (data.step_information && !data.step_information.answers);

    if (!isCompletion) return null;

    return {
      completion: "KO",
      name:
        data.name ||
        data.character_name ||
        data.results?.[0]?.name ||
        "غير معروف",
      description:
        data.description ||
        data.character_desc ||
        data.results?.[0]?.description ||
        "بدون وصف",
      image:
        data.akitude
          ? `https://ar.akinator.com/assets/img/akitudes_520x650/${data.akitude}`
          : data.photo ||
            data.results?.[0]?.absolute_picture_path ||
            "https://i.imgur.com/5cX1VFt.png",
      proba:
        data.proba ||
        data.results?.[0]?.proba ||
        data.results?.[0]?.ranking ||
        "0.0",
    };
  }
}

/** 🧩 POST /api/mard/answer
 * Body: { session, signature, step, answer, progression }
 * Returns: السؤال التالي أو النتيجة
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

    // 1️⃣ نرسل الإجابة
    const ansData = await api.answer({
      session,
      signature,
      step,
      answer,
      progression,
    });

    // 2️⃣ تحقق: هل هي نتيجة تخمين؟
    const completion = api.extractCompletion(ansData);
    if (completion) {
      return res.json({
        status: true,
        message: "✅ Akinator أعطى نتيجة (completion/guess)",
        type: "completion",
        data: completion,
        raw: ansData,
      });
    }

    // 3️⃣ أو سؤال جديد من /answer
    const nextQ = api.extractQuestion(ansData);
    if (nextQ) {
      return res.json({
        status: true,
        message: "✅ سؤال جديد مستلم من /answer",
        type: "continue",
        data: {
          question: nextQ,
          progression:
            ansData.step_information?.progression ||
            ansData.progression ||
            "0",
        },
        raw: ansData,
      });
    }

    // 4️⃣ لو لم يوجد شيء، استخدم /cancel_answer كـ fallback
    const cancelData = await api.cancelAnswer({
      session,
      signature,
      step,
      progression,
    });

    const canceledQ = api.extractQuestion(cancelData);
    if (canceledQ) {
      return res.json({
        status: true,
        message: "✅ سؤال مسترجع من /cancel_answer (fallback)",
        type: "continue",
        data: {
          question: canceledQ,
          progression:
            cancelData.step_information?.progression ||
            cancelData.progression ||
            "0",
        },
        raw: cancelData,
      });
    }

    // 5️⃣ فشل في جلب أي سؤال أو نتيجة
    return res.status(500).json({
      status: false,
      message: "❌ لم يتم الحصول على سؤال أو نتيجة من Akinator",
      ansRaw: ansData,
    });
  } catch (err) {
    console.error("❌ Error in /api/mard/answer:", err);
    return res.status(500).json({
      status: false,
      message: "⚠️ فشل في التواصل مع المارد.",
      error: err.message,
      raw: err.response?.data,
    });
  }
});

/** GET /api/mard/answer (للاختبار السريع عبر query params) */
router.get("/answer", async (req, res) => {
  req.body = { ...req.body, ...req.query };
  return router.handle(req, res);
});

export default router;
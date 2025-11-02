// routes/mard-new.js
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

  // إرسال الإجابة إلى /answer
  async answer(paramsObj) {
    const params = new URLSearchParams({
      cm: "false",
      sid: "NaN",
      ...paramsObj,
    });

    const res = await axios.post(`${this.base}/answer`, params.toString(), {
      headers: this.headers,
      timeout: 15000,
    });
    return res.data;
  }

  // طلب fallback من /cancel_answer
  async cancelAnswer(paramsObj) {
    const params = new URLSearchParams({
      cm: "false",
      sid: "NaN",
      ...paramsObj,
    });

    const res = await axios.post(`${this.base}/cancel_answer`, params.toString(), {
      headers: this.headers,
      timeout: 15000,
    });
    return res.data;
  }

  // استخراج نص السؤال من أنواع الحقول المختلفة
  extractQuestion(data) {
    if (!data) return null;

    // بعض نسخ Akinator ترجع السؤال في حقول مختلفة أو داخل HTML
    const candidates = [
      data.question,
      data.question_label,
      data.questionText,
      data.question_text,
      data.questionHTML, // قد يحتوي HTML
    ];

    for (const c of candidates) {
      if (c && typeof c === "string" && c.trim()) {
        // إذا كان HTML نزيل الوسوم
        if (/<\/?[a-z][\s\S]*>/i.test(c)) {
          return this.stripHtml(c);
        }
        return c.trim();
      }
    }

    return null;
  }

  stripHtml(html) {
    return String(html).replace(/<\/?[^>]+(>|$)/g, "").trim();
  }
}

/**
 * المعالج المشترك
 * يقبل القيم من body أو query (GET/POST)
 * الحقول المطلوبة: session, signature, step, answer
 */
async function handleExtractNextQuestion(req, res) {
  try {
    // دمج body و query بحيث يمكن استخدام GET أو POST
    const input = { ...req.body, ...req.query };

    const session = input.session;
    const signature = input.signature;
    const step = input.step;
    const answer = input.answer;
    const progression = input.progression ?? input.progress ?? 0; // بعض العملاء يستخدمون أسماء مختلفة

    if (!session || !signature || step == null || answer == null) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الحقول المطلوبة: session, signature, step, answer (ويمكن optional progression)",
      });
    }

    const api = new AkinatorAPI();

    // 1) نرسل الإجابة أولًا
    const ansData = await api.answer({
      session,
      signature,
      step,
      answer,
      progression,
    });

    // 2) نحاول استخراج السؤال الجديد من /answer مباشرة
    const directQuestion = api.extractQuestion(ansData);

    if (directQuestion) {
      return res.json({
        status: true,
        message: "✅ سؤال جديد مستلم من /answer",
        question: directQuestion,
        // ارتجاع raw مفيد للتصحيح، ويمكن للمستخدم اختيار تجاهله
        raw: ansData,
      });
    }

    // 3) تحقق إن كانت هناك completion / guess (Akinator انتهى)
    const completionFields = ansData.completion || ansData.guess || ansData.results || ansData.final || null;
    if (completionFields) {
      return res.json({
        status: true,
        message: "✅ Akinator أعطى نتيجة (completion/guess)",
        type: "completion",
        data: ansData,
      });
    }

    // 4) fallback: نطلب /cancel_answer لاسترجاع السؤال أو السؤال الحالي
    const cancelData = await api.cancelAnswer({
      session,
      signature,
      step,
      progression,
    });

    const fallbackQuestion = api.extractQuestion(cancelData);

    if (fallbackQuestion) {
      return res.json({
        status: true,
        message: "✅ سؤال مسترجع من /cancel_answer (fallback)",
        question: fallbackQuestion,
        raw: cancelData,
      });
    }

    // 5) إذا لم نحصل على شيء — نرجع الخام لمراجعة client
    return res.status(500).json({
      status: false,
      message: "❌ لم يتم العثور على سؤال جديد من /answer أو /cancel_answer",
      ansRaw: ansData,
      cancelRaw: cancelData,
    });
  } catch (err) {
    console.error("mard-new error:", err?.response?.data ?? err.message ?? err);
    return res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء محاولة استخراج السؤال الجديد",
      error: err.message,
      raw: err.response?.data ?? null,
    });
  }
}

// ربط المسارات: يدعم POST و GET
router.post("/", handleExtractNextQuestion);
router.get("/", handleExtractNextQuestion);

// تصدير الراوتر
export default router;
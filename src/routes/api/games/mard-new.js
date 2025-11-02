// routes/mard-answer.js
import express from "express";
import axios from "axios";

const router = express.Router();

/** 🎭 كلاس المارد الأزرق - إرسال الإجابة */
class MardAnswerAPI {
  constructor() {
    this.baseUrl = "https://ar.akinator.com";
    this.headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };
  }

  /** 🔹 إرسال الإجابة */
  async answer(body) {
    if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
      throw new Error("⚠️ لا يوجد بيانات مرسلة في body!");
    }

    try {
      const { data } = await axios.post(
        `${this.baseUrl}/answer`,
        new URLSearchParams(body),
        { headers: this.headers }
      );
      return data;
    } catch (err) {
      throw new Error(
        `فشل تنفيذ answer: ${err.response?.data || err.message}`
      );
    }
  }

  /** 🔹 جلب السؤال التالي */
  async getNextQuestion(session, signature, step) {
    try {
      const url = `${this.baseUrl}/question?session=${session}&signature=${encodeURIComponent(
        signature
      )}&step=${step}`;
      const { data } = await axios.get(url, { headers: this.headers });
      return data;
    } catch (err) {
      throw new Error(
        `فشل في جلب السؤال التالي: ${err.response?.data || err.message}`
      );
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const mard = new MardAnswerAPI();
    const result = await mard.answer(req.body);

    let nextQuestion = null;

    // 🔹 إذا ما فيه سؤال في الرد أو ظهرت علامة KO، نجيب السؤال التالي
    if (!result.question || result.completion === "KO") {
      const { session, signature, step } = req.body;
      if (session && signature && step !== undefined) {
        nextQuestion = await mard.getNextQuestion(session, signature, step);
      }
    }

    res.json({
      status: true,
      message: "✅ تم إرسال الإجابة بنجاح",
      data: {
        answer_result: result,
        next_question: nextQuestion || result.question
          ? result
          : "❌ لم يتم العثور على سؤال جديد",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء إرسال الإجابة",
      error: err.message,
    });
  }
});

/** 🧩 GET Route (اختياري للاختبار من المتصفح) */
router.get("/", async (req, res) => {
  try {
    const mard = new MardAnswerAPI();
    const result = await mard.answer(req.query);

    let nextQuestion = null;

    if (!result.question || result.completion === "KO") {
      const { session, signature, step } = req.query;
      if (session && signature && step !== undefined) {
        nextQuestion = await mard.getNextQuestion(session, signature, step);
      }
    }

    res.json({
      status: true,
      message: "✅ تم إرسال الإجابة بنجاح",
      data: {
        answer_result: result,
        next_question: nextQuestion || result.question
          ? result
          : "❌ لم يتم العثور على سؤال جديد",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء إرسال الإجابة",
      error: err.message,
    });
  }
});

export default router;
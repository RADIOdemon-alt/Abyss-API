// routes/mard-answer.js
import express from "express";
import axios from "axios";

const router = express.Router();

/** 🎭 كلاس المارد الأزرق - إرسال الإجابة */
class MardAnswerAPI {
  constructor() {
    this.baseUrl = "https://ar.akinator.com/answer";
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
      const response = await axios.post(
        this.baseUrl,
        new URLSearchParams(body),
        { headers: this.headers }
      );

      const result = response.data;

      if (result.akitude) {
        result.akitude_url = `https://ar.akinator.com/assets/img/akitudes_520x650/${result.akitude}`;
      }

      return result;
    } catch (err) {
      throw new Error(
        `فشل تنفيذ answer: ${err.response?.data || err.message}`
      );
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const mard = new MardAnswerAPI();
    const result = await mard.answer(req.body);

    res.json({
      status: true,
      message: "✅ تم إرسال الإجابة بنجاح",
      data: result,
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

    res.json({
      status: true,
      message: "✅ تم إرسال الإجابة بنجاح",
      data: result,
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
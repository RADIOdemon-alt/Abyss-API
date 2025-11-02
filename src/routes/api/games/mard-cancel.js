// routes/mard-cancel.js
import express from "express";
import axios from "axios";

const router = express.Router();

/** 🎭 كلاس المارد الأزرق - إلغاء الإجابة */
class MardCancelAPI {
  constructor() {
    this.baseUrl = "https://ar.akinator.com/cancel_answer";
    this.headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };
  }

  /** 🔹 إرسال طلب إلغاء الإجابة */
  async cancel({ step, progression, session, signature }) {
    if (!step || !progression || !session || !signature) {
      throw new Error("⚠️ جميع الحقول مطلوبة: step, progression, session, signature");
    }

    try {
      const response = await axios.post(
        this.baseUrl,
        new URLSearchParams({
          step,
          progression,
          session,
          signature,
          cm: "false",
          sid: "NaN",
        }),
        { headers: this.headers }
      );

      const result = response.data;

      if (result.akitude) {
        result.akitude_url = `https://ar.akinator.com/assets/img/akitudes_520x650/${result.akitude}`;
      }

      return result;
    } catch (err) {
      throw new Error(
        `فشل تنفيذ cancel_answer: ${err.response?.data || err.message}`
      );
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { step, progression, session, signature } = req.body;

    if (!step || !progression || !session || !signature) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الحقول مطلوبة: step, progression, session, signature",
      });
    }

    const mard = new MardCancelAPI();
    const result = await mard.cancel({ step, progression, session, signature });

    res.json({
      status: true,
      message: "✅ تم إلغاء الإجابة بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء إلغاء الإجابة",
      error: err.message,
    });
  }
});

/** 🧩 GET Route (اختياري للاختبار عبر الرابط) */
router.get("/", async (req, res) => {
  try {
    const { step, progression, session, signature } = req.query;

    if (!step || !progression || !session || !signature) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الحقول مطلوبة: step, progression, session, signature",
      });
    }

    const mard = new MardCancelAPI();
    const result = await mard.cancel({ step, progression, session, signature });

    res.json({
      status: true,
      message: "✅ تم إلغاء الإجابة بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء إلغاء الإجابة",
      error: err.message,
    });
  }
});

export default router;
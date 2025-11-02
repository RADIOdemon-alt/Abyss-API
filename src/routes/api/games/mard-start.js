// routes/mard-start.js
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

/** 🎭 كلاس المارد الأزرق */
class MardAPI {
  constructor() {
    this.baseUrl = "https://ar.akinator.com/game";
    this.headers = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "content-type": "application/x-www-form-urlencoded",
    };
  }

  /** 🔹 بدء الجلسة */
  async start() {
    try {
      const response = await axios.post(
        this.baseUrl,
        new URLSearchParams({ cm: "false", sid: "1" }),
        { headers: this.headers }
      );

      const $ = cheerio.load(response.data);

      const question = $("#question-label").text().trim();
      const session = $('form#askSoundlike input[name="session"]').val();
      const signature = $('form#askSoundlike input[name="signature"]').val();

      if (!session || !signature) {
        throw new Error("Session أو Signature غير موجودين!");
      }

      return {
        id: uuidv4(),
        session,
        signature,
        question,
      };
    } catch (err) {
      throw new Error(`فشل بدء جلسة المارد: ${err.message}`);
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const mard = new MardAPI();
    const result = await mard.start();

    res.json({
      status: true,
      message: "✅ تم بدء جلسة المارد الأزرق بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء بدء الجلسة",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const mard = new MardAPI();
    const result = await mard.start();

    res.json({
      status: true,
      message: "✅ تم بدء جلسة المارد الأزرق بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء بدء الجلسة",
      error: err.message,
    });
  }
});

export default router;
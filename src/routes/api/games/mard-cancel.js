// routes/mard-cancel.js
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

/** 🎭 كلاس المارد الأزرق - إلغاء الإجابة */
class MardCancelAPI {
  constructor() {
    this.baseUrl = "https://ar.akinator.com/answer";
    this.headers = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; 22120RN86G Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
      Origin: "https://ar.akinator.com",
      Referer: "https://ar.akinator.com/game",
    };
  }

  _absUrl(src) {
    if (!src) return null;
    try {
      if (src.startsWith("//")) return "https:" + src;
      if (src.startsWith("http://") || src.startsWith("https://")) return src;
      return new URL(src, "https://ar.akinator.com").href;
    } catch {
      return src;
    }
  }

  /** 🔍 استخراج التخمين من HTML */
  _extractGuessFromHtml(html) {
    const $ = cheerio.load(html);

    const ogTitle =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="og:title"]').attr("content") ||
      null;
    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="og:image"]').attr("content") ||
      null;
    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      $(".subname").first().text().trim() ||
      $(".description").first().text().trim() ||
      null;

    const possibleName =
      $("#perso").text().trim() ||
      $(".bubble-name").text().trim() ||
      $(".bubble-body .name").text().trim() ||
      $(".bubble-body strong").text().trim() ||
      $("h1, h2, .name, .guess-name, .entity-name")
        .first()
        .text()
        .trim() ||
      ogTitle;

    let img =
      $("img#photo").attr("src") ||
      $("img.main-picture").attr("src") ||
      $("img.character").attr("src") ||
      $('img[src*="/uploads/"]').attr("src") ||
      $('img[src*="/imgs/"]').attr("src") ||
      $('img[src*="/characters/"]').attr("src") ||
      ogImage;

    if (!img) {
      const style = $("#photo, .picture, .main-picture").attr("style") || "";
      const bgMatch = style.match(/url\(['"]?(.*?)['"]?\)/);
      if (bgMatch && bgMatch[1]) img = bgMatch[1];
    }

    const image = this._absUrl(img);

    if (!possibleName && !image && !description) return null;

    return {
      name: possibleName || "غير معروف",
      description: description || "بدون وصف",
      image: image || "https://i.imgur.com/5cX1VFt.png",
    };
  }

  /** 🔹 تنفيذ طلب cancel_answer / إرسال إجابة */
  async cancel({ step, progression, session, signature, answer, step_last_proposition = "" }) {
    if (!step || !progression || !session || !signature || answer === undefined) {
      throw new Error("⚠️ الحقول مطلوبة: step, progression, session, signature, answer");
    }

    const response = await axios.post(
      this.baseUrl,
      new URLSearchParams({
        step,
        progression,
        session,
        signature,
        cm: "false",
        sid: "NaN",
        answer,
        step_last_proposition,
      }),
      { headers: this.headers, responseType: "text" }
    );

    let result = response.data;
    if (typeof result === "string" && result.trim().startsWith("{")) {
      try {
        result = JSON.parse(result);
      } catch {}
    }

    let guess = null;

    if (typeof result === "string" && result.includes("<html")) {
      guess = this._extractGuessFromHtml(result);
    } else if (result && typeof result === "object") {
      const htmlCandidates = [
        result.html,
        result.partialHtml,
        result.page,
        result.data,
      ].filter(Boolean);
      for (const h of htmlCandidates) {
        if (typeof h === "string" && h.includes("<")) {
          guess = this._extractGuessFromHtml(h);
          if (guess) break;
        }
      }
    }

    if (guess) result.guess = guess;

    return result;
  }
}

/** 🧩 GET & POST */
const handler = async (req, res) => {
  try {
    const body = req.method === "GET" ? req.query : req.body;
    const { step, progression, session, signature, answer, step_last_proposition } = body;

    if (!step || !progression || !session || !signature || answer === undefined) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الحقول مطلوبة: step, progression, session, signature, answer",
      });
    }

    const mard = new MardCancelAPI();
    const result = await mard.cancel({ step, progression, session, signature, answer, step_last_proposition });

    res.json({
      status: true,
      message: "✅ تم إرسال الإجابة بنجاح واسترجاع السؤال/التخمين",
      data: result,
    });
  } catch (err) {
    console.error("❌ [MardCancelAPI Error]", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء إلغاء الإجابة",
      error: err.message,
    });
  }
};

router.get("/", handler);
router.post("/", handler);

export default router;
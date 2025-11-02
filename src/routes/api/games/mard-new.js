// routes/mard-new.js
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

class AkinatorAPI {
  constructor() {
    this.base = "https://ar.akinator.com";
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Origin: "https://ar.akinator.com",
      Referer: "https://ar.akinator.com/game",
    };
    // مسارات
    this.answerPath = "/answer";
    this.cancelPath = "/cancel_answer";
  }

  _absUrl(src) {
    if (!src) return null;
    try {
      if (src.startsWith("//")) return "https:" + src;
      if (src.startsWith("http://") || src.startsWith("https://")) return src;
      return new URL(src, this.base).href;
    } catch {
      return src;
    }
  }

  // استخراج تخمين من HTML (اسم، وصف، صورة)
  _extractGuessFromHtml(html) {
    if (!html || typeof html !== "string") return null;
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

  // يرسل طلب /answer
  async answer(paramsObj) {
    const params = new URLSearchParams({
      cm: "false",
      sid: "NaN",
      ...paramsObj,
    });

    const res = await axios.post(
      `${this.base}${this.answerPath}`,
      params.toString(),
      {
        headers: this.headers,
        timeout: 15000,
      }
    );
    return res.data;
  }

  // يرسل طلب /cancel_answer
  async cancelAnswer(paramsObj) {
    const params = new URLSearchParams({
      cm: "false",
      sid: "NaN",
      ...paramsObj,
    });

    const res = await axios.post(
      `${this.base}${this.cancelPath}`,
      params.toString(),
      {
        headers: this.headers,
        timeout: 15000,
      }
    );
    return res.data;
  }

  // تنظيف HTML البسيط
  stripHtml(html) {
    return String(html).replace(/<\/?[^>]+(>|$)/g, "").trim();
  }

  // استخراج نص السؤال من مصادر متعددة
  extractQuestion(data) {
    if (!data) return null;

    // إذا كان الرد نص HTML كاملاً
    if (typeof data === "string") {
      // JSON string?
      const trimmed = data.trim();
      if (trimmed.startsWith("{")) {
        try {
          data = JSON.parse(trimmed);
        } catch (e) {
          // تركه كسلسلة HTML
        }
      } else if (trimmed.includes("<")) {
        // HTML -> حاول استخراج نص من الداخل
        const $ = cheerio.load(trimmed);
        const q =
          $("div#question, .question, #q, .question-text").first().text().trim() ||
          $("title").text().trim();
        return q || null;
      }
    }

    const candidates = [
      data.question,
      data.question_label,
      data.questionText,
      data.question_text,
      data.questionHTML,
      data.current_question,
      data.next_question,
      data.partialHtml,
      data.html,
      data.page,
      data.data,
    ];

    for (const c of candidates) {
      if (!c) continue;
      if (typeof c === "string" && c.trim()) {
        // لو يحتوى على HTML نزيل الوسوم
        if (/<\/?[a-z][\s\S]*>/i.test(c)) {
          const stripped = this.stripHtml(c);
          if (stripped) return stripped;
        } else {
          return c.trim();
        }
      }

      // بعض الحقول تأتي كـ كائن يحتوي على text/html
      if (typeof c === "object") {
        // حاول استخراج من خواص شائعة
        const objCandidates = [
          c.text,
          c.label,
          c.question,
          c.html,
          c.content,
        ];
        for (const oc of objCandidates) {
          if (oc && typeof oc === "string" && oc.trim()) {
            if (/<\/?[a-z][\s\S]*>/i.test(oc)) {
              const stripped = this.stripHtml(oc);
              if (stripped) return stripped;
            } else {
              return oc.trim();
            }
          }
        }
      }
    }

    return null;
  }

  // استخراج تخمين من ردود JSON (حقول completion/guess)
  extractGuessFromData(data) {
    if (!data) return null;

    // لو الرد HTML كامل
    if (typeof data === "string" && data.includes("<")) {
      return this._extractGuessFromHtml(data);
    }

    // بعض السيرفرات تُرجع التخمين في حقول مختلفة
    const guessCandidates = [
      data.guess,
      data.completion,
      data.results,
      data.final,
      data.data, // ممكن أن يحتوي شيء
    ];

    for (const g of guessCandidates) {
      if (!g) continue;
      // إذا كان سلسلة نصية تحتوي على HTML
      if (typeof g === "string" && g.includes("<")) {
        const got = this._extractGuessFromHtml(g);
        if (got) return got;
      }

      // إذا كان كائن يحتوي على اسم أو صورة أو وصف
      if (typeof g === "object") {
        // بعض الحقول: name, entity, label, description, picture_url, image
        const name =
          g.name ||
          g.entity ||
          g.label ||
          g.title ||
          g.name_fr ||
          g.name_en ||
          null;
        const description =
          g.description ||
          g.desc ||
          g.subname ||
          g.detail ||
          null;
        const image =
          g.picture_url ||
          g.image ||
          g.img ||
          g.photo ||
          g.photo_url ||
          null;

        if (name || description || image) {
          return {
            name: (typeof name === "string" && name.trim()) ? name.trim() : undefined,
            description: (typeof description === "string" && description.trim()) ? description.trim() : undefined,
            image: image ? this._absUrl(image) : undefined,
          };
        }
      }
    }

    // أخيرًا، حاول البحث في نصوص HTML المتوفرة في data.partialHtml / data.html
    const htmlFields = [data.partialHtml, data.html, data.page, data.pageHtml, data.html_page].filter(Boolean);
    for (const h of htmlFields) {
      if (typeof h === "string" && h.includes("<")) {
        const got = this._extractGuessFromHtml(h);
        if (got) return got;
      }
    }

    return null;
  }
}

/**
 * المعالج الرئيسي:
 * - يقبل GET/POST
 * - الحقول المطلوبة: session, signature, step, answer
 * - إن كان answer === -1 أو action === 'cancel' -> يستعمل /cancel_answer
 * - يحاول استخراج السؤال التالي أو التخمين النهائي، ويرجع raw للمساعدة
 */
async function handleExtractNextQuestion(req, res) {
  try {
    const input = { ...req.body, ...req.query };

    const session = input.session;
    const signature = input.signature;
    const step = input.step;
    const rawAnswer = input.answer;
    const progression = input.progression ?? input.progress ?? input.progression ?? 0;
    const step_last_proposition = input.step_last_proposition ?? "";

    if (!session || !signature || step == null || rawAnswer == null) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الحقول المطلوبة: session, signature, step, answer (ويمكن optional progression, step_last_proposition)",
      });
    }

    const api = new AkinatorAPI();

    // قرر هل سنستعمل cancel مباشرة؟
    const wantCancel =
      String(rawAnswer) === "-1" ||
      input.action === "cancel" ||
      input.cancel === "true" ||
      input.cancel === true;

    let ansData = null;
    let usedCancel = false;

    if (!wantCancel) {
      // 1) نرسل الإجابة أولًا (العملية العادية)
      try {
        ansData = await api.answer({
          session,
          signature,
          step,
          answer: String(rawAnswer),
          progression,
          step_last_proposition,
        });
      } catch (e) {
        // لو فشل /answer نستخدم cancel كـ fallback لاحقًا
        console.warn("Akinator /answer failed:", e?.response?.data ?? e.message ?? e);
        ansData = e?.response?.data ?? null;
      }
    } else {
      // المستخدم طلب إلغاء مباشرة
      usedCancel = true;
      ansData = await api.cancelAnswer({
        session,
        signature,
        step,
        progression,
      });
    }

    // حاول استخراج سؤال مباشر من نتيجة /answer
    const directQuestion = api.extractQuestion(ansData);
    if (directQuestion) {
      return res.json({
        status: true,
        message: usedCancel ? "✅ سؤال مسترجع من /cancel_answer" : "✅ سؤال جديد مستلم من /answer",
        type: "question",
        question: directQuestion,
        raw: ansData,
      });
    }

    // تحقق إن كانت هناك نتيجة / تخمين
    const guessFromAns = api.extractGuessFromData(ansData);
    if (guessFromAns) {
      return res.json({
        status: true,
        message: "✅ Akinator أعطى نتيجة (guess/completion) من /answer",
        type: "guess",
        guess: guessFromAns,
        raw: ansData,
      });
    }

    // إذا لم يكن هناك سؤال أو تخمين من /answer، فنجرب /cancel_answer كـ fallback (إن لم نستخدمه)
    let cancelData = null;
    if (!usedCancel) {
      try {
        cancelData = await api.cancelAnswer({
          session,
          signature,
          step,
          progression,
        });
      } catch (e) {
        console.warn("Akinator /cancel_answer failed:", e?.response?.data ?? e.message ?? e);
        cancelData = e?.response?.data ?? null;
      }

      const fallbackQuestion = api.extractQuestion(cancelData);
      if (fallbackQuestion) {
        return res.json({
          status: true,
          message: "✅ سؤال مسترجع من /cancel_answer (fallback)",
          type: "question",
          question: fallbackQuestion,
          raw: cancelData,
        });
      }

      const guessFromCancel = api.extractGuessFromData(cancelData);
      if (guessFromCancel) {
        return res.json({
          status: true,
          message: "✅ Akinator أعطى نتيجة (guess/completion) من /cancel_answer",
          type: "guess",
          guess: guessFromCancel,
          raw: cancelData,
        });
      }
    }

    // لا شيء مفيد — نعيد الخامين لمساعدة العميل في التشخيص
    return res.status(500).json({
      status: false,
      message: "❌ لم يتم العثور على سؤال أو تخمين من /answer أو /cancel_answer",
      ansRaw: ansData,
      cancelRaw: cancelData,
    });
  } catch (err) {
    console.error("mard-new error:", err?.response?.data ?? err.message ?? err);
    return res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء محاولة استخراج السؤال/التخمين",
      error: err.message,
      raw: err.response?.data ?? null,
    });
  }
}

router.post("/", handleExtractNextQuestion);
router.get("/", handleExtractNextQuestion);

export default router;
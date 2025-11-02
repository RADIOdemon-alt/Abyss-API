// routes/mard-new.js
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

class AkinatorAPI {
  constructor() {
    this.base = "https://ar.akinator.com";
    // رؤوس أساسية مشابهة للـ curl الذي زودتنا به
    this.headers = {
      "Host": "ar.akinator.com",
      "Connection": "keep-alive",
      "sec-ch-ua-platform": '"Android"',
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; 22120RN86G Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36",
      "Accept": "*/*",
      "sec-ch-ua": '"Android WebView";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "sec-ch-ua-mobile": "?1",
      "Origin": "https://ar.akinator.com",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "Referer": "https://ar.akinator.com/game",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7"
    };

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

  // ارسال POST مطابق للـ curl: body كسلسلة URL encoded، واستلام النص الخام (text)
  async _postRaw(path, paramsObj = {}, extraHeaders = {}) {
    const params = new URLSearchParams({
      cm: "false",
      sid: "NaN",
      ...paramsObj,
    }).toString();

    const headers = { ...this.headers, ...extraHeaders };
    // السماح بطول body كبير إذا لزم
    const res = await axios.post(`${this.base}${path}`, params, {
      headers,
      responseType: "text",
      timeout: 15000,
      maxBodyLength: Infinity,
      validateStatus: (s) => s >= 200 && s < 500, // نقرأ حتى أخطاء 4xx/5xx للـ debugging
    });

    return res.data;
  }

  // wrapper للإجابة
  async answer(paramsObj = {}) {
    return await this._postRaw(this.answerPath, paramsObj);
  }

  // wrapper للإلغاء/استرجاع
  async cancelAnswer(paramsObj = {}) {
    return await this._postRaw(this.cancelPath, paramsObj);
  }

  // تنظيف HTML بسيط
  stripHtml(html) {
    return String(html).replace(/<\/?[^>]+(>|$)/g, "").trim();
  }

  // استخراج نص سؤال من HTML أو JSON
  extractQuestion(data) {
    if (!data) return null;

    // لو النص HTML بالكامل
    if (typeof data === "string") {
      const trimmed = data.trim();
      // لو JSON كسلسلة، نجرب parse
      if (trimmed.startsWith("{")) {
        try {
          data = JSON.parse(trimmed);
        } catch (e) {
          // تركه HTML
        }
      } else if (trimmed.includes("<")) {
        const $ = cheerio.load(trimmed);
        const q =
          $("div#question, .question, #q, .question-text").first().text().trim() ||
          $("title").text().trim();
        // لو العنوان "Akinator" نعيد "Akinator" كذلك (نستخدمه كـ إشارة)
        return q || null;
      }
    }

    const candidates = [
      data?.question,
      data?.question_label,
      data?.questionText,
      data?.question_text,
      data?.questionHTML,
      data?.current_question,
      data?.next_question,
      data?.partialHtml,
      data?.html,
      data?.page,
      data?.data,
    ];

    for (const c of candidates) {
      if (!c) continue;
      if (typeof c === "string" && c.trim()) {
        if (/<\/?[a-z][\s\S]*>/i.test(c)) {
          const s = this.stripHtml(c);
          if (s) return s;
        } else return c.trim();
      }
      if (typeof c === "object") {
        const objCandidates = [c.text, c.label, c.question, c.html, c.content];
        for (const oc of objCandidates) {
          if (oc && typeof oc === "string" && oc.trim()) {
            if (/<\/?[a-z][\s\S]*>/i.test(oc)) {
              const s = this.stripHtml(oc);
              if (s) return s;
            } else return oc.trim();
          }
        }
      }
    }
    return null;
  }

  // استخراج التخمين من HTML أو JSON
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
      $("h1, h2, .name, .guess-name, .entity-name").first().text().trim() ||
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

  extractGuessFromData(data) {
    if (!data) return null;

    // لو السلسلة تحتوي HTML
    if (typeof data === "string" && data.includes("<")) {
      return this._extractGuessFromHtml(data);
    }

    // لو JSON أكيد
    if (typeof data === "object") {
      const guessCandidates = [
        data.guess,
        data.completion,
        data.results,
        data.final,
        data.data,
      ];
      for (const g of guessCandidates) {
        if (!g) continue;
        if (typeof g === "string" && g.includes("<")) {
          const got = this._extractGuessFromHtml(g);
          if (got) return got;
        }
        if (typeof g === "object") {
          const name =
            g.name || g.entity || g.label || g.title || g.name_fr || g.name_en || null;
          const description =
            g.description || g.desc || g.subname || g.detail || null;
          const image =
            g.picture_url || g.image || g.img || g.photo || g.photo_url || null;

          if (name || description || image) {
            return {
              name: (typeof name === "string" && name.trim()) ? name.trim() : undefined,
              description: (typeof description === "string" && description.trim()) ? description.trim() : undefined,
              image: image ? this._absUrl(image) : undefined,
            };
          }
        }
      }
    }

    // أخيراً نجرب حقول HTML داخل data
    const htmlFields = [data?.partialHtml, data?.html, data?.page, data?.pageHtml, data?.html_page].filter(Boolean);
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
 * يقبل GET/POST
 * الحقول المطلوبة: session, signature, step, answer
 * يدير fallback ذكي إذا أعاد HTML صفحة اللعبة أو سؤال "Akinator"
 */
async function handleExtractNextQuestion(req, res) {
  try {
    const input = { ...req.body, ...req.query };

    const session = input.session;
    const signature = input.signature;
    const step = input.step;
    const rawAnswer = input.answer;
    const progression = input.progression ?? input.progress ?? 0;
    const step_last_proposition = input.step_last_proposition ?? "";

    if (!session || !signature || step == null || rawAnswer == null) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الحقول المطلوبة: session, signature, step, answer (ويمكن optional progression, step_last_proposition)",
      });
    }

    const api = new AkinatorAPI();

    // عندما تكون القيمة -1 أو action=cancel نستخدم cancelAnswer مباشرة
    const wantCancel =
      String(rawAnswer) === "-1" ||
      input.action === "cancel" ||
      input.cancel === true ||
      input.cancel === "true";

    let ansRaw = null;
    let usedCancel = false;

    // 1) أرسل /answer أو /cancel_answer حسب الطلب
    if (!wantCancel) {
      try {
        ansRaw = await api.answer({
          session,
          signature,
          step,
          answer: String(rawAnswer),
          progression,
          step_last_proposition,
        });
      } catch (e) {
        // إذا فشل /answer خزن الاستجابة أو الرسالة
        console.warn("Akinator /answer failed:", e?.response?.data ?? e.message ?? e);
        ansRaw = e?.response?.data ?? null;
      }
    } else {
      usedCancel = true;
      try {
        ansRaw = await api.cancelAnswer({
          session,
          signature,
          step,
          progression,
        });
      } catch (e) {
        console.warn("Akinator /cancel_answer failed:", e?.response?.data ?? e.message ?? e);
        ansRaw = e?.response?.data ?? null;
      }
    }

    // 2) حاول استخراج سؤال أو تخمين مباشرة
    const directQ = api.extractQuestion(ansRaw);
    if (directQ) {
      return res.json({
        status: true,
        message: usedCancel ? "✅ سؤال مسترجع من /cancel_answer" : "✅ سؤال جديد مستلم من /answer",
        type: "question",
        question: directQ,
        raw: ansRaw,
      });
    }

    const guessFromAns = api.extractGuessFromData(ansRaw);
    if (guessFromAns) {
      return res.json({
        status: true,
        message: "✅ Akinator أعطى نتيجة (guess/completion) من /answer",
        type: "guess",
        guess: guessFromAns,
        raw: ansRaw,
      });
    }

    // 3) إن كانت الاستجابة HTML لصفحة اللعبة (مثلاً العنوان "Akinator") -> نجرب fallback ذكي:
    if (typeof ansRaw === "string" && ansRaw.includes("<")) {
      const $ = cheerio.load(ansRaw);
      const title = ($("title").text() || "").trim();
      // لو الصفحة هي صفحة Akinator فالمطلوب إجراء cancel أو طلب التخمين النهائي
      if (title && title.toLowerCase().includes("akinator")) {
        // 3.a) نجرب cancel_answer أولًا
        let cancelRaw = null;
        try {
          cancelRaw = await api.cancelAnswer({
            session,
            signature,
            step,
            progression,
          });
        } catch (e) {
          cancelRaw = e?.response?.data ?? null;
        }

        // إذا أرجع سؤال نعيده
        const fallbackQ = api.extractQuestion(cancelRaw);
        if (fallbackQ) {
          return res.json({
            status: true,
            message: "✅ سؤال مسترجع من /cancel_answer (fallback-html)",
            type: "question",
            question: fallbackQ,
            raw: cancelRaw,
          });
        }

        // إذا أرجع تخمين
        const fallbackGuess = api.extractGuessFromData(cancelRaw);
        if (fallbackGuess) {
          return res.json({
            status: true,
            message: "✅ Akinator أعطى نتيجة من /cancel_answer (fallback-html)",
            type: "guess",
            guess: fallbackGuess,
            raw: cancelRaw,
          });
        }

        // 3.b) نجرب طلب إنهاء التخمين عبر answer=-1 كوسيلة أخيرة
        try {
          const finalRaw = await api.answer({
            session,
            signature,
            step,
            answer: "-1",
            progression,
            step_last_proposition,
          });

          const finalGuess = api.extractGuessFromData(finalRaw);
          if (finalGuess) {
            return res.json({
              status: true,
              message: "✅ تم الحصول على التخمين بعد طلب النهائي (answer=-1)",
              type: "guess",
              guess: finalGuess,
              raw: finalRaw,
            });
          }

          const finalQ = api.extractQuestion(finalRaw);
          if (finalQ) {
            return res.json({
              status: true,
              message: "✅ سؤال بعد طلب النهائي (answer=-1)",
              type: "question",
              question: finalQ,
              raw: finalRaw,
            });
          }
        } catch (e) {
          // تجاهل واستمر للأسفل لإعادة raw للمساعدة
          console.warn("final answer(-1) failed:", e?.response?.data ?? e.message ?? e);
        }

        // لا شيء نافع من محاولات fallback
        return res.status(500).json({
          status: false,
          message: "❌ الرد كان صفحة Akinator ولم نتمكن من استخلاص سؤال/تخمين بعد محاولات fallback.",
          rawAnswer: ansRaw,
          cancelAttempt: cancelRaw ?? null,
        });
      }
    }

    // 4) لو لم نحصل على شيء من /answer، نجرّب /cancel_answer كـ fallback (لو لم نستخدمه أصلاً)
    if (!usedCancel) {
      let cancelRaw = null;
      try {
        cancelRaw = await api.cancelAnswer({
          session,
          signature,
          step,
          progression,
        });
      } catch (e) {
        console.warn("Akinator /cancel_answer failed (fallback):", e?.response?.data ?? e.message ?? e);
        cancelRaw = e?.response?.data ?? null;
      }

      const fallbackQ = api.extractQuestion(cancelRaw);
      if (fallbackQ) {
        return res.json({
          status: true,
          message: "✅ سؤال مسترجع من /cancel_answer (fallback)",
          type: "question",
          question: fallbackQ,
          raw: cancelRaw,
        });
      }
      const fallbackGuess = api.extractGuessFromData(cancelRaw);
      if (fallbackGuess) {
        return res.json({
          status: true,
          message: "✅ Akinator أعطى نتيجة (guess/completion) من /cancel_answer (fallback)",
          type: "guess",
          guess: fallbackGuess,
          raw: cancelRaw,
        });
      }

      // لم ينجح أي شيء
      return res.status(500).json({
        status: false,
        message: "❌ لم يتم العثور على سؤال أو تخمين من /answer أو /cancel_answer (fallback).",
        ansRaw,
        cancelRaw,
      });
    }

    // 5) إفشال نهائي: أعد الخام للمساعدة في التشخيص
    return res.status(500).json({
      status: false,
      message: "❌ لم يتم العثور على سؤال أو تخمين من الاستجابة.",
      ansRaw,
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
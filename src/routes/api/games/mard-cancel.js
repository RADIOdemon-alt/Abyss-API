// routes/mard-cancel.js
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

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

  /** تحويل مسار صورة نسبي إلى مطلق اعتمادًا على الدومين */
  _absUrl(src) {
    if (!src) return null;
    try {
      // حالات: //domain/.. , /path , relative.jpg , http(s)://...
      if (src.startsWith("//")) return "https:" + src;
      if (src.startsWith("http://") || src.startsWith("https://")) return src;
      return new URL(src, "https://ar.akinator.com").href;
    } catch {
      return src;
    }
  }

  /** محاولة استخراج اسم التخمين وصورته من HTML */
  _extractGuessFromHtml(html) {
    const $ = cheerio.load(html);

    // 1) حاول الميتا أولًا (og:title, og:image, description)
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
      null;

    // 2) محاولات اختيار العناصر المتوقعة في الصفحة
    const nameSelectors = [
      "#guessName",
      "#guess-name",
      ".guess-name",
      ".entity-name",
      ".result h2",
      "h1",
      "h2",
      ".card-title",
      ".character-name",
      ".candidate__name",
    ];
    let name = null;
    for (const s of nameSelectors) {
      const t = $(s).first().text().trim();
      if (t) {
        name = t;
        break;
      }
    }

    // 3) محاولات أخذ صورة من تسلسلات img منطقية
    const imgSelectors = [
      'img[id*="guess"]',
      'img[class*="guess"]',
      'img[class*="character"]',
      'img[src*="/uploads/"]',
      'img[src*="/imgs/"]',
      'img[src*="/images/"]',
      "img",
    ];
    let img = null;
    for (const s of imgSelectors) {
      const el = $(s).first();
      const src = el.attr("src") || el.attr("data-src") || el.attr("data-original");
      if (src && src.trim()) {
        img = src.trim();
        break;
      }
      // بعض الصفحات تضم صورة داخل background-image
      const styleBg = el.attr("style") || "";
      const m = styleBg.match(/url\(['"]?(.*?)['"]?\)/);
      if (m && m[1]) {
        img = m[1];
        break;
      }
    }

    // 4) fallback: نص من ogTitle إن لم نجد اسم من السيلكتور
    if (!name && ogTitle) name = ogTitle;

    // 5) إن لم نجد صورة من السيلكتور خذ ogImage
    if (!img && ogImage) img = ogImage;

    // 6) تأكد من تحويل المسار إلى URL مطلق
    const image = this._absUrl(img);

    if (!name && !image && !description) {
      return null;
    }

    return {
      name: name || null,
      description: description || null,
      image: image || null,
    };
  }

  /** 🔹 إرسال طلب إلغاء الإجابة */
  async cancel({ step, progression, session, signature }) {
    if (!step || !progression || !session || !signature) {
      throw new Error(
        "⚠️ جميع الحقول مطلوبة: step, progression, session, signature"
      );
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
        { headers: this.headers, responseType: "text" } // نحصل على نص لأن Akinator قد يرجع HTML
      );

      let result = response.data;

      // إذا كان الرد JSON (سلسلة قابلة للتحويل)، حاول تحويلها
      try {
        if (typeof result === "string" && result.trim().startsWith("{")) {
          const parsed = JSON.parse(result);
          result = parsed;
        }
      } catch {
        // لا تفعل شيئًا — المحتوى قد يكون HTML صالحًا
      }

      // إذا جاء حقل akitude (كما في النسخة السابقة) أنشئ رابط الصورة
      if (result && result.akitude) {
        result.akitude_url = `https://ar.akinator.com/assets/img/akitudes_520x650/${result.akitude}`;
      }

      // الآن: إذا كان الرد HTML أو يحتوي على HTML، حاول استخراج التخمين (الاسم + الصورة)
      let guess = null;
      if (typeof result === "string" && result.includes("<")) {
        guess = this._extractGuessFromHtml(result);
      } else if (result && typeof result === "object") {
        // أحيانًا الـ API يرجع حقل html أو partialHtml داخل object
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

        // إن لم نجد تخمينًا لكن يوجد akitude_url فنستخدمه كصورة مع اسم محتمل
        if (!guess && result.akitude_url) {
          guess = {
            name: result.name || result.guess_name || null,
            description: result.description || null,
            image: result.akitude_url,
          };
        }
      }

      // أرفق التخمين داخل النتيجة
      if (guess) {
        result.guess = guess;
      }

      return result;
    } catch (err) {
      // إذا جاء رد خام من axios، ضع raw data للمساعدة في التصحيح
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
        message:
          "⚠️ الحقول مطلوبة: step, progression, session, signature",
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
        message:
          "⚠️ الحقول مطلوبة: step, progression, session, signature",
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
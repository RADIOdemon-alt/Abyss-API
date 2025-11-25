// routes/surahStream.js
import express from "express";
import axios from "axios";

const router = express.Router();

const BASE_MP3_HOST = "https://server10.mp3quran.net/ajm/128";

/**
 * يحول اسم السورة إلى رقم (نفس الخريطة الموجودة في كودك)
 * يدعم أيضاً إدخال رقم مباشرة كـ "1" أو "001"
 */
function getSurahNumber(surahNameOrNumber) {
  if (!surahNameOrNumber) return null;

  // لو المستخدم أعطى رقم
  const maybeNum = String(surahNameOrNumber).trim();
  if (/^\d+$/.test(maybeNum)) return parseInt(maybeNum, 10);

  const surahs = {
    'الفاتحة': 1,
    'البقرة': 2,
    'آل عمران': 3,
    'النساء': 4,
    'المائدة': 5,
    'الأنعام': 6,
    'الأعراف': 7,
    'الأنفال': 8,
    'التوبة': 9,
    'يونس': 10,
    'هود': 11,
    'يوسف': 12,
    'الرعد': 13,
    'إبراهيم': 14,
    'الحجر': 15,
    'النحل': 16,
    'الإسراء': 17,
    'الكهف': 18,
    'مريم': 19,
    'طه': 20,
    'الأنبياء': 21,
    'الحج': 22,
    'المؤمنون': 23,
    'النور': 24,
    'الفرقان': 25,
    'الشعراء': 26,
    'النمل': 27,
    'القصص': 28,
    'العنكبوت': 29,
    'الروم': 30,
    'لقمان': 31,
    'السجدة': 32,
    'الأحزاب': 33,
    'سبأ': 34,
    'فاطر': 35,
    'يس': 36,
    'الصافات': 37,
    'ص': 38,
    'الزمر': 39,
    'غافر': 40,
    'فصلت': 41,
    'الشورى': 42,
    'الزخرف': 43,
    'الدخان': 44,
    'الجاثية': 45,
    'الأحقاف': 46,
    'محمد': 47,
    'الفتح': 48,
    'الحجرات': 49,
    'ق': 50,
    'الذاريات': 51,
    'الطور': 52,
    'النجم': 53,
    'القمر': 54,
    'الرحمن': 55,
    'الواقعة': 56,
    'الحديد': 57,
    'المجادلة': 58,
    'الحشر': 59,
    'الممتحنة': 60,
    'الصف': 61,
    'الجمعة': 62,
    'المنافقون': 63,
    'التغابن': 64,
    'الطلاق': 65,
    'التحريم': 66,
    'الملك': 67,
    'القلم': 68,
    'الحاقة': 69,
    'المعارج': 70,
    'نوح': 71,
    'الجن': 72,
    'المزمل': 73,
    'المدثر': 74,
    'القيامة': 75,
    'الإنسان': 76,
    'المرسلات': 77,
    'النبأ': 78,
    'النازعات': 79,
    'عبس': 80,
    'التكوير': 81,
    'الانفطار': 82,
    'المطففين': 83,
    'الانشقاق': 84,
    'البروج': 85,
    'الطارق': 86,
    'الأعلى': 87,
    'الغاشية': 88,
    'الفجر': 89,
    'البلد': 90,
    'الشمس': 91,
    'الليل': 92,
    'الضحى': 93,
    'الشرح': 94,
    'التين': 95,
    'العلق': 96,
    'القدر': 97,
    'البينة': 98,
    'الزلزلة': 99,
    'العاديات': 100,
    'القارعة': 101,
    'التكاثر': 102,
    'العصر': 103,
    'الهمزة': 104,
    'الفيل': 105,
    'قريش': 106,
    'الماعون': 107,
    'الكوثر': 108,
    'الكافرون': 109,
    'النصر': 110,
    'المسد': 111,
    'الإخلاص': 112,
    'الفلق': 113,
    'الناس': 114
  };

  // محاولات مطابقة بسيطة: exact بعد trim
  const key = maybeNum;
  return surahs[key] || surahs[key.replace(/\s+/g, ' ')] || null;
}

/**
 * GET /         -> ?name=الفاتحة  OR ?number=1
 * GET /:id      -> /الفاتحة  أو /1
 */
router.get("/", async (req, res) => {
  try {
    const name = req.query.name || req.query.surah || req.query.q || req.query.number;
    if (!name) {
      return res.status(400).json({ status: false, message: "⚠️ ارسل اسم السورة أو رقمها كـ ?name=الفاتحة" });
    }

    const surahNum = getSurahNumber(name);
    if (!surahNum || surahNum < 1 || surahNum > 114) {
      return res.status(404).json({ status: false, message: "❌ لم يتم العثور على السورة المطلوبة" });
    }

    const fileName = String(surahNum).padStart(3, "0") + ".mp3";
    const mp3Url = `${BASE_MP3_HOST}/${fileName}`;

    // إعادة توجيه هيدر Range (لو موجود) لتمكين seek
    const upstreamHeaders = {
      "Accept-Encoding": "identity",
      Referer: `https://surahquran.com/mp3/Al-Ajmy/${surahNum}.html`,
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; 22120RN86G Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.125 Mobile Safari/537.36",
      Host: "server10.mp3quran.net",
      Connection: "Keep-Alive"
    };

    if (req.headers.range) {
      upstreamHeaders.Range = req.headers.range;
    }

    // طلب الستريم من السيرفر الخارجي
    const upstreamResponse = await axios.get(mp3Url, {
      responseType: "stream",
      headers: upstreamHeaders,
      validateStatus: null // سنتعامل مع الحالة يدوياً
    });

    // إن لم يتم العثور على الملف أو خطأ
    if (upstreamResponse.status >= 400) {
      const msg = upstreamResponse.status === 404 ? "ملف السورة غير موجود في المصدر" : `خطأ من المصدر (${upstreamResponse.status})`;
      return res.status(502).json({ status: false, message: `❌ ${msg}` });
    }

    // إعداد هيدرز الاستجابة للعميل بناءً على هيدرز المصدَّر
    const contentType = upstreamResponse.headers["content-type"] || "audio/mpeg";
    const contentLength = upstreamResponse.headers["content-length"];
    const acceptRanges = upstreamResponse.headers["accept-ranges"];
    const upstreamStatus = upstreamResponse.status === 206 ? 206 : 200;

    res.status(upstreamStatus);
    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
    // ممكن تعيين اسم الملف للتحميل لو حاب:
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    // وصل الستريم مباشرة لعميل الطلب
    upstreamResponse.data.on("error", (err) => {
      console.error("Stream error from upstream:", err);
      if (!res.headersSent) {
        res.status(500).end("❌ خطأ أثناء بث الملف");
      } else {
        try { res.end(); } catch (e) {}
      }
    });

    upstreamResponse.data.pipe(res);
  } catch (err) {
    console.error("Router error:", err);
    if (!res.headersSent) res.status(500).json({ status: false, message: "❌ حدث خطأ داخلي", error: err.message });
    else try { res.end(); } catch (e) {}
  }
});

// دعم المسار كـ /الفاتحة أو /1
router.get("/:id", async (req, res) => {
  // ببساطة نعيد استخدام المعالج عبر تحويل المعرف إلى query
  req.query.name = req.params.id;
  return router.handle(req, res);
});

export default router;
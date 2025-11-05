// routes/instagram.js
import express from "express";
import axios from "axios";
import cheerio from "cheerio";

const router = express.Router();

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";

const COMMON_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
  "X-Requested-With": "mark.via.gp",
};

// 🔸 أدوات الكوكيز
function parseSetCookie(setCookieArray = []) {
  const jar = {};
  for (const s of setCookieArray) {
    try {
      const [pair] = s.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) {
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        jar[name] = value;
      }
    } catch {}
  }
  return jar;
}

function mergeJars(dest, src) {
  for (const k of Object.keys(src)) dest[k] = src[k];
}

function cookieHeaderFromJar(jar) {
  return Object.keys(jar)
    .map((k) => `${k}=${jar[k]}`)
    .join("; ");
}

async function waitForResult(jobId, cookieJar, maxTries = 15) {
  for (let i = 0; i < maxTries; i++) {
    const res = await axios.get(
      `https://instag.com/api/result/?job_id=${encodeURIComponent(jobId)}`,
      {
        headers: {
          ...COMMON_HEADERS,
          Cookie: cookieHeaderFromJar(cookieJar),
        },
        timeout: 20000,
        validateStatus: (s) => s < 500,
      }
    );
    if (res.status === 200 && res.data && res.data.loading !== true) {
      return res.data;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

class InstagramDownloader {
  async fetchMedia(url) {
    const cookieJar = {};
    let csrf = null;

    // 🌀 الخطوة 1: فتح الصفحة الرئيسية
    const homeRes = await axios.get("https://instag.com/", {
      headers: { ...COMMON_HEADERS, Referer: "https://www.google.com/" },
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });
    mergeJars(cookieJar, parseSetCookie(homeRes.headers["set-cookie"] || []));
    const homeHtml = homeRes.data || "";
    const m1 = homeHtml.match(
      /name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/i
    );
    if (m1) csrf = m1[1];
    if (!csrf && cookieJar.csrftoken) csrf = cookieJar.csrftoken;

    // 🌀 الخطوة 2: إرسال رابط الإنستجرام
    const params = new URLSearchParams();
    if (csrf) params.append("csrfmiddlewaretoken", csrf);
    params.append("url", url);

    const managerRes = await axios.post(
      "https://instag.com/api/manager/",
      params.toString(),
      {
        headers: {
          ...COMMON_HEADERS,
          Referer: "https://instag.com/",
          Origin: "https://instag.com",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: cookieHeaderFromJar(cookieJar),
        },
        timeout: 20000,
        validateStatus: (s) => s < 500,
      }
    );
    mergeJars(cookieJar, parseSetCookie(managerRes.headers["set-cookie"] || []));

    // 🌀 استخراج job_id
    let jobId = null;
    const data = managerRes.data;
    if (data?.job_id) jobId = data.job_id;
    else if (Array.isArray(data?.job_ids) && data.job_ids[0]?.job_id)
      jobId = data.job_ids[0].job_id;
    else if (data?.id) jobId = data.id;
    else if (typeof data === "string") {
      const mj = data.match(/"job_id":"([^"]+)"/i);
      if (mj) jobId = mj[1];
    }

    if (!jobId) throw new Error("لم يتم العثور على job_id");

    // 🌀 انتظار النتيجة
    const resultData = await waitForResult(jobId, cookieJar, 15);
    if (!resultData) throw new Error("لم يتم الحصول على نتيجة بعد الانتظار");

    // 🌀 استخراج رابط الميديا
    let mediaUrl = null;
    if (resultData.html) {
      const $ = cheerio.load(resultData.html);
      const proxy = $("a[href*='/proxy-image/']").first().attr("href");
      if (proxy) mediaUrl = "https://instag.com" + proxy;
      if (!mediaUrl) {
        const imgApi = $("a[href*='/api/image/']").first().attr("href");
        if (imgApi) mediaUrl = "https://instag.com" + imgApi;
      }
      if (!mediaUrl) {
        const link = $("a[href^='http']").first().attr("href");
        if (link) mediaUrl = link;
      }
    }

    if (!mediaUrl) throw new Error("لم يتم العثور على رابط الميديا");

    // 🌀 تحميل الملف فعلياً
    const fileRes = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": USER_AGENT,
        Referer: "https://www.instagram.com/",
      },
      timeout: 30000,
    });

    return {
      mediaUrl,
      mimeType: fileRes.headers["content-type"] || "application/octet-stream",
      base64: Buffer.from(fileRes.data).toString("base64"),
    };
  }
}

/* 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !/^https?:\/\/(www\.)?instagram\.com\//i.test(url)) {
      return res
        .status(400)
        .json({ status: false, message: "⚠️ ضع رابط إنستجرام صحيح." });
    }

    const insta = new InstagramDownloader();
    const result = await insta.fetchMedia(url);

    res.json({
      status: true,
      message: "✅ تم جلب الميديا بنجاح",
      data: {
        url,
        mediaUrl: result.mediaUrl,
        mimeType: result.mimeType,
        base64: result.base64,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحميل الميديا",
      error: err.message,
    });
  }
});

/* 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || !/^https?:\/\/(www\.)?instagram\.com\//i.test(url)) {
      return res
        .status(400)
        .json({ status: false, message: "⚠️ ضع رابط إنستجرام صحيح." });
    }

    const insta = new InstagramDownloader();
    const result = await insta.fetchMedia(url);

    res.json({
      status: true,
      message: "✅ تم جلب الميديا بنجاح",
      data: {
        url,
        mediaUrl: result.mediaUrl,
        mimeType: result.mimeType,
        base64: result.base64,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحميل الميديا",
      error: err.message,
    });
  }
});

export default router;
// 📦 instagram-scraper.api.js
// • Developer: izana
// • Feature: Instagram media downloader (instag.com)
// • Framework: Express Router style

import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

/* ----------------------------- إعدادات عامة ----------------------------- */
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";

const COMMON_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
  "X-Requested-With": "mark.via.gp",
};

/* ----------------------------- أدوات مساعدة ----------------------------- */
function parseSetCookie(setCookieArray = []) {
  const jar = {};
  for (const s of setCookieArray) {
    try {
      const [pair] = s.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
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

/* ----------------------------- كلاس الإنستجرام ----------------------------- */
class InstagramScraper {
  constructor() {
    this.baseUrl = "https://instag.com";
  }

  async waitForResult(jobId, cookieJar, maxTries = 15) {
    for (let i = 0; i < maxTries; i++) {
      const res = await axios.get(`${this.baseUrl}/api/result/?job_id=${encodeURIComponent(jobId)}`, {
        headers: { ...COMMON_HEADERS, Cookie: cookieHeaderFromJar(cookieJar) },
        timeout: 20000,
        validateStatus: (s) => s < 500,
      });
      if (res.status === 200 && res.data && res.data.loading !== true) return res.data;
      await new Promise((r) => setTimeout(r, 2000));
    }
    return null;
  }

  async fetchMedia(url) {
    if (!url || !/instagram\.com\/[^\s]+/i.test(url))
      throw new Error("❌ رابط إنستاجرام غير صالح");

    const cookieJar = {};

    // افتح الصفحة الرئيسية
    const homeRes = await axios.get(this.baseUrl + "/", {
      headers: { ...COMMON_HEADERS, Referer: "https://www.google.com/" },
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });
    mergeJars(cookieJar, parseSetCookie(homeRes.headers["set-cookie"] || []));
    const homeHtml = homeRes.data || "";

    // الحصول على CSRF
    let csrf = null;
    const m1 = homeHtml.match(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/i);
    if (m1) csrf = m1[1];
    if (!csrf && cookieJar.csrftoken) csrf = cookieJar.csrftoken;

    // إرسال رابط إنستجرام
    const params = new URLSearchParams();
    if (csrf) params.append("csrfmiddlewaretoken", csrf);
    params.append("url", url);

    const managerRes = await axios.post(`${this.baseUrl}/api/manager/`, params.toString(), {
      headers: {
        ...COMMON_HEADERS,
        Referer: this.baseUrl + "/",
        Origin: this.baseUrl,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Cookie: cookieHeaderFromJar(cookieJar),
      },
      timeout: 20000,
      validateStatus: (s) => s < 500,
    });
    mergeJars(cookieJar, parseSetCookie(managerRes.headers["set-cookie"] || []));

    const data = managerRes.data;
    if (!data) throw new Error("⚠️ رد فاضي من /api/manager/");

    let jobId =
      data.job_id ||
      (Array.isArray(data.job_ids) && data.job_ids[0]?.job_id) ||
      data.id ||
      (typeof data === "string" && (data.match(/"job_id":"([^"]+)"/i) || [])[1]);

    if (!jobId) throw new Error("⚠️ لم يتم العثور على job_id");

    const result = await this.waitForResult(jobId, cookieJar);
    if (!result) throw new Error("⚠️ لم يتم العثور على نتيجة بعد الانتظار");

    // استخراج رابط الميديا
    let mediaUrl = null;
    if (result.html) {
      const $ = cheerio.load(result.html);
      const proxy = $("a[href*='/proxy-image/']").first().attr("href");
      if (proxy) mediaUrl = this.baseUrl + proxy;
      if (!mediaUrl) {
        const imgApi = $("a[href*='/api/image/']").first().attr("href");
        if (imgApi) mediaUrl = this.baseUrl + imgApi;
      }
      if (!mediaUrl) {
        const link = $("a[href^='http']").first().attr("href");
        if (link) mediaUrl = link;
      }
    }

    if (!mediaUrl) throw new Error("⚠️ لا يوجد رابط ميديا في النتيجة");

    const mediaRes = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      headers: { "User-Agent": USER_AGENT, Referer: "https://www.instagram.com/" },
      timeout: 30000,
    });

    return {
      status: true,
      type: mediaRes.headers["content-type"].startsWith("video") ? "video" : "image",
      contentType: mediaRes.headers["content-type"],
      buffer: Buffer.from(mediaRes.data),
      source: url,
    };
  }
}

/* ----------------------------- POST /insta ----------------------------- */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ الرابط مطلوب" });

    const insta = new InstagramScraper();
    const media = await insta.fetchMedia(url);

    const base64 = media.buffer.toString("base64");
    res.json({
      status: true,
      message: "✅ تم جلب الميديا بنجاح",
      mediaType: media.type,
      contentType: media.contentType,
      source: media.source,
      fileBase64: base64,
    });
  } catch (err) {
    console.error("Instagram Error:", err.message);
    res.status(500).json({ status: false, message: err.message });
  }
});

/* ----------------------------- GET /insta ----------------------------- */
router.get("/", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ الرابط مطلوب" });

    const insta = new InstagramScraper();
    const media = await insta.fetchMedia(url);

    res.setHeader("Content-Type", media.contentType);
    res.send(media.buffer);
  } catch (err) {
    console.error("Instagram Error:", err.message);
    res.status(500).json({ status: false, message: err.message });
  }
});

export default router;

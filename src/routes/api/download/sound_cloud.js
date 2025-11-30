// 📦 soundcloud.api.js
// • Developer: izana
// • Feature: SoundCloud MP3 Downloader (soundcloudmp3.org)
// • Framework: Express Router style

import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

/* ----------------------------- إعدادات عامة ----------------------------- */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, مثل Gecko) Chrome/120.0 Safari/537.36";

const COMMON_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "ar,en;q=0.9",
};

/* ----------------------------- Cookie Helpers ----------------------------- */
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

/* ----------------------------- كلاس SoundCloud ----------------------------- */
class SoundCloudScraper {
  constructor() {
    this.baseUrl = "https://soundcloudmp3.org";
  }

  async fetch(url) {
    if (!url || !url.includes("soundcloud.com"))
      throw new Error("❌ رابط SoundCloud غير صالح");

    const cookieJar = {};

    // ▪ افتح الصفحة الرئيسية لجلب التوكن
    const homeRes = await axios.get(this.baseUrl + "/", {
      headers: { ...COMMON_HEADERS },
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });

    mergeJars(cookieJar, parseSetCookie(homeRes.headers["set-cookie"] || []));
    const $ = cheerio.load(homeRes.data);
    const token = $("input").attr("value");

    if (!token) throw new Error("❌ لم يتم استخراج التوكن");

    // ▪ طلب التحويل
    const params = new URLSearchParams();
    params.append("_token", token);
    params.append("lang", "en");
    params.append("url", url);
    params.append("submit", "");

    const convRes = await axios.post(this.baseUrl + "/converter", params.toString(), {
      headers: {
        ...COMMON_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeaderFromJar(cookieJar),
      },
      timeout: 20000,
    });

    const $$ = cheerio.load(convRes.data);

    const download = $$("#ready-group a").attr("href");
    const thumb = $$(".info img").attr("src");
    const title = $$(".info > p b").first().text().replace("Title:", "").trim();

    if (!download) throw new Error("⚠️ لم يتم العثور على رابط التحميل");

    // ▪ تحميل الملف
    const fileRes = await axios.get(download, {
      responseType: "arraybuffer",
      headers: { "User-Agent": USER_AGENT },
      timeout: 30000,
    });

    return {
      status: true,
      title: title || "SoundCloud Audio",
      thumbnail: thumb,
      source: url,
      contentType: "audio/mpeg",
      buffer: Buffer.from(fileRes.data),
    };
  }
}

/* ----------------------------- POST /soundcloud ----------------------------- */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ الرابط مطلوب" });

    const sc = new SoundCloudScraper();
    const audio = await sc.fetch(url);

    const base64 = audio.buffer.toString("base64");

    res.json({
      status: true,
      message: "✅ تم جلب الصوت بنجاح",
      title: audio.title,
      thumbnail: audio.thumbnail,
      contentType: audio.contentType,
      source: audio.source,
      fileBase64: base64,
    });

  } catch (err) {
    console.error("SoundCloud Error:", err.message);
    res.status(500).json({ status: false, message: err.message });
  }
});

/* ----------------------------- GET /soundcloud ----------------------------- */
router.get("/", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "⚠️ الرابط مطلوب" });

    const sc = new SoundCloudScraper();
    const audio = await sc.fetch(url);

    res.setHeader("Content-Type", audio.contentType);
    res.send(audio.buffer);

  } catch (err) {
    console.error("SoundCloud Error:", err.message);
    res.status(500).json({ status: false, message: err.message });
  }
});

export default router;

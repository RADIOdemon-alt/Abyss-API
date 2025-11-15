import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import JSZip from "jszip";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

const router = express.Router();

// تمكين قراءة JSON داخل هذا الروتر (إن لم يفعلها app الرئيسي)
router.use(express.json());

const SITE_BASE = "https://traidmode.com";
// NOTE: لم نعد نستخدم حد ثابت هنا؛ قمت بإلغاء منطق الرفض المباشر بناءً على الحجم
// const MAX_SEND_BYTES = 250 * 1024 * 1024; // لم يعد مستخدم

class TraidModeAPI {
  constructor() {
    this.baseUrl = SITE_BASE;
    this.headers = {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 14; TraidModeBot) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      referer: SITE_BASE,
      connection: "keep-alive",
    };

    this.EXCLUDE_PATH_PREFIXES = [
      "/", "/blog", "/f-a-q", "/faq", "/contact", "/about",
      "/category", "/tag", "/page", "/author", "/sitemap",
      "/privacy", "/terms", "/archive", "/login", "/register"
    ];
    this.EXCLUDE_TITLE_KEYWORDS = [
      "home", "الرئيسية", "blog", "faq", "contact", "about",
      "privacy", "terms", "category", "tag"
    ];
  }

  resolveAndFilter(href, titleRaw = "") {
    try {
      if (!href || href === "#" || href.trim().length === 0) return null;
      let resolvedUrl;
      try {
        resolvedUrl = new URL(href, SITE_BASE).toString();
      } catch (e) {
        return null;
      }
      const urlObj = new URL(resolvedUrl);
      const pathname = urlObj.pathname.replace(/\/+$/, "");
      const title = (titleRaw || "").toString().trim();
      const lowerPath = pathname.toLowerCase();

      for (const prefix of this.EXCLUDE_PATH_PREFIXES) {
        if (prefix === "/" && (lowerPath === "" || lowerPath === "/")) return null;
        if (prefix !== "/" && lowerPath.startsWith(prefix)) return null;
      }

      const lowerTitle = title.toLowerCase();
      for (const kw of this.EXCLUDE_TITLE_KEYWORDS) {
        if (lowerTitle.includes(kw)) return null;
      }

      if (lowerPath.includes("/?s=") || lowerPath.includes("/page/") || lowerPath.includes("/tag/") || lowerPath.includes("/category/")) {
        return null;
      }

      if (urlObj.hostname && !urlObj.hostname.includes("traidmode.com") && !urlObj.pathname.toLowerCase().includes(".apk")) {
        return null;
      }

      const finalUrl = resolvedUrl;
      const finalTitle = title || finalUrl.split("/").pop().split("?")[0] || finalUrl;
      return { url: finalUrl, title: finalTitle.replace(/\s+/g, " ").trim() };
    } catch (e) {
      return null;
    }
  }

  async searchFirstResult(query) {
    if (!query) throw new Error("⚠️ الحقل 'query' مطلوب");
    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log(`🔍 TraidMode: البحث عن "${query}" -> ${searchUrl}`);
    const res = await axios.get(searchUrl, { headers: this.headers, timeout: 15000 });
    const $ = cheerio.load(res.data);

    const candidates = [];

    $(".post, article, .search-result, .app-item").each((i, elem) => {
      const $elem = $(elem);
      const link = $elem.find("a").first();
      const rawHref = link.attr("href") || "";
      const titleRaw = link.attr("title") || link.text() || $elem.find("h2, h3, .title, .post-title").first().text();
      const description = $elem.find(".excerpt, .description, p").first().text().trim();
      const resolved = this.resolveAndFilter(rawHref, titleRaw);
      if (!resolved) return;
      candidates.push({ title: resolved.title, url: resolved.url, description: description || "" });
    });

    if (candidates.length === 0) {
      $("a").each((i, elem) => {
        const $a = $(elem);
        const href = $a.attr("href") || "";
        const titleRaw = $a.attr("title") || $a.text().trim();
        const resolved = this.resolveAndFilter(href, titleRaw);
        if (!resolved) return;
        if (!candidates.find(c => c.url === resolved.url)) {
          candidates.push({ title: resolved.title, url: resolved.url, description: "" });
        }
      });
    }

    if (!candidates || candidates.length === 0) {
      throw new Error("❌ لم تُعثر أي نتائج صالحة في TraidMode");
    }

    console.log(`✅ تم العثور على ${candidates.length} نتائج، اختيار الأولى: ${candidates[0].title}`);
    return candidates[0];
  }

  extractFromGetUrl(getUrl) {
    try {
      const urlObj = new URL(getUrl);
      const directUrl = urlObj.searchParams.get("urls");
      const filename = urlObj.searchParams.get("names");
      if (!directUrl) throw new Error("لم يتم العثور على رابط التحميل في معاملات URL");
      return {
        url: directUrl,
        filename: filename ? decodeURIComponent(filename) : directUrl.split("/").pop().split("?")[0],
        source: "traidmode"
      };
    } catch (err) {
      throw new Error(`خطأ في تحليل رابط Get: ${err.message}`);
    }
  }

  async getDirectDownloadLink(pageUrl) {
    try {
      if (!pageUrl) throw new Error("صفحة المصدر مطلوبة");
      let url = pageUrl;

      if (url.includes("/get/?urls=")) {
        return this.extractFromGetUrl(url);
      }

      if (!url.includes("/download")) url = url.endsWith("/") ? `${url}download/` : `${url}/download/`;

      console.log(`🔗 TraidMode: الوصول إلى صفحة التنزيل -> ${url}`);
      const resp = await axios.get(url, { headers: this.headers, timeout: 15000 });
      const $ = cheerio.load(resp.data);

      let getLink = null;
      $("a").each((i, elem) => {
        const href = $(elem).attr("href");
        if (!href) return;
        if (href.includes("/get/?urls=")) {
          getLink = href.startsWith("http") ? href : `${SITE_BASE}${href}`;
          return false;
        }
        if (href.endsWith(".apk") || href.includes(".apk")) {
          getLink = href.startsWith("http") ? href : href;
          return false;
        }
      });

      if (!getLink) {
        throw new Error("لم يتم العثور على رابط تحميل مباشر في صفحة التنزيل");
      }

      if (getLink.includes("/get/?urls=")) return this.extractFromGetUrl(getLink);
      return { url: getLink, filename: getLink.split("/").pop().split("?")[0], source: "traidmode" };
    } catch (err) {
      throw new Error(`فشل استخراج رابط: ${err.message}`);
    }
  }

  // HEAD لجلب الحجم (مفيد فقط كإعلام — لكن حتى لو غائب سنكمل)
  async getRemoteFileSize(url) {
    try {
      const head = await axios.head(url, { headers: { "User-Agent": this.headers["user-agent"] || this.headers["User-Agent"], Referer: SITE_BASE }, timeout: 10000 });
      const len = parseInt(head.headers["content-length"] || "0");
      return isNaN(len) ? 0 : len;
    } catch (e) {
      return 0;
    }
  }
}

// ==== Utilities: download stream -> temp file, unzip-if-needed, sanitize filename, headers

function tmpFilePath(prefix = "traid") {
  const name = `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
  return path.join(os.tmpdir(), name);
}

// تنزيل كسطر إلى ملف مؤقت، وإرجاع المسار والحجم الحقيقي عند الانتهاء
async function downloadToTempFile(url, headers = {}) {
  const tempPath = tmpFilePath("download");
  const writer = fs.createWriteStream(tempPath);

  const resp = await axios.get(url, { responseType: "stream", headers, timeout: 0 /*no timeout for large files*/ });
  return await new Promise((resolve, reject) => {
    let total = 0;
    resp.data.on("data", chunk => { total += chunk.length; });
    resp.data.on("error", err => {
      writer.close();
      reject(err);
    });
    writer.on("error", err => {
      resp.data.destroy();
      reject(err);
    });
    writer.on("finish", async () => {
      resolve({ path: tempPath, bytes: total, contentType: resp.headers['content-type'] || null });
    });
    resp.data.pipe(writer);
  });
}

// قراءة ملف مؤقت إلى buffer (لـ JSZip)
async function readFileBuffer(filePath) {
  return fs.promises.readFile(filePath);
}

// تابع استخراج APK داخل ZIP (متوافق مع كودك السابق)
async function extractApkIfZippedBuffer(buffer, filename) {
  // تفقد header PK
  const isPK = buffer && buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
  if (!isPK) {
    const bufferString = buffer.toString("binary", 0, Math.min(buffer.length, 1000));
    const isDirectApk = bufferString.includes("AndroidManifest") || bufferString.includes("classes.dex") || bufferString.includes("META-INF");
    if (isDirectApk) {
      return { buffer, filename };
    }
    // ليس ZIP ولا APK
    return { buffer, filename };
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);
    const apkFile = files.find(name => /\.apk$/i.test(name) && !zip.files[name].dir);
    if (!apkFile) {
      return { buffer, filename };
    }
    const apkBuffer = await zip.files[apkFile].async("nodebuffer");
    const apkName = apkFile.split("/").pop();
    return { buffer: apkBuffer, filename: apkName };
  } catch (err) {
    return { buffer, filename }; // لو فشل، أعد الملف كما هو
  }
}

function sanitizeFilename(name) {
  if (!name || typeof name !== "string") return { ascii: "file.apk", utf8: "file.apk" };
  let original = name.trim().slice(0, 240);
  original = original.replace(/[\u0000-\u001f\u007f-\u009f]/g, "_");
  original = original.replace(/["<>:\\/|?*;]/g, "_");
  original = original.replace(/\s+/g, "_");
  const asciiSafe = original.replace(/[^\x20-\x7E]/g, "_");
  let ascii = asciiSafe;
  if (!/\.[a-zA-Z0-9]{1,6}$/.test(ascii)) ascii = ascii + ".apk";
  return { ascii: ascii.slice(0, 200), utf8: original.slice(0, 240) };
}

function setAttachmentHeaders(res, filenameObj) {
  const ascii = filenameObj.ascii || "file.apk";
  const utf8 = filenameObj.utf8 || ascii;
  res.setHeader("Content-Disposition",
    `attachment; filename="${ascii.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(utf8)}`
  );
}

// تنظيف مسارات مؤقتة (حذف الملفات إن وجدت)
async function safeUnlink(filePath) {
  try { await fs.promises.unlink(filePath); } catch (e) { /* ignore */ }
}

// =====================
// Routes (GET / and POST /)
// =====================

/**
 * GET /?query=NAME
 * يبحث عن أول نتيجة، يستخرج رابط التحميل، يقوم بتنزيل الملف إلى temp، يفحصه (ZIP/APK)، ويرسله كـ attachment.
 */
router.get("/", async (req, res) => {
  let downloadedPath = null;
  let finalPath = null;
  try {
    const query = req.query.query;
    if (!query) return res.status(400).json({ status: false, message: "⚠️ أرسل اسم التطبيق في المعلمة ?query=" });

    const api = new TraidModeAPI();
    const first = await api.searchFirstResult(query);
    const direct = await api.getDirectDownloadLink(first.url);
    if (!direct || !direct.url) {
      return res.status(404).json({ status: false, message: "⚠️ تعذّر استخراج رابط التحميل المباشر" });
    }

    // إعلام المستخدم بالروابط (head info)
    const headSize = await api.getRemoteFileSize(direct.url);
    if (headSize) {
      console.log(`ℹ️ حجم مُعلن عبر HEAD: ${(headSize / (1024*1024)).toFixed(2)} MB`);
    } else {
      console.log("ℹ️ Content-Length غير متوفر أو غير موثوق - سنكمل التحميل كـ stream");
    }

    // تنزيل كـ stream إلى ملف مؤقت (لتجنب استهلاك الرام)
    console.log(`📥 بدء التنزيل: ${direct.url}`);
    const { path: tempPath, bytes, contentType } = await downloadToTempFile(direct.url, { "User-Agent": api.headers["user-agent"], Referer: SITE_BASE });
    downloadedPath = tempPath;
    console.log(`📦 نُزّل الملف إلى: ${tempPath} — الحجم: ${(bytes / (1024*1024)).toFixed(2)} MB`);

    // اقرأ buffer قصير (أو كامل) للتحقق وفك ZIP إن لزم
    const fileBuffer = await readFileBuffer(tempPath);
    const defaultFilename = direct.filename || `${first.title}.apk`;
    const { buffer: maybeApkBuffer, filename: maybeApkFilename } = await extractApkIfZippedBuffer(fileBuffer, defaultFilename);

    if (maybeApkBuffer && maybeApkBuffer !== fileBuffer) {
      // استخرجنا APK داخل ZIP -> احفظه كملف منفصل وأرسله
      const finalTemp = tmpFilePath("final");
      await fs.promises.writeFile(finalTemp, maybeApkBuffer);
      finalPath = finalTemp;
      console.log(`✅ تم استخراج APK وحفظه في: ${finalTemp}`);
    } else {
      // لم نستخرج شيء، نرسل الملف الأصلي كما هو
      finalPath = tempPath;
      console.log("ℹ️ الملف الأصلي يحتوي APK/أو لم يتضمن ZIP قابل للاستخراج — سنرسله كما هو");
    }

    const filenameObj = sanitizeFilename(maybeApkFilename || defaultFilename);
    setAttachmentHeaders(res, filenameObj);

    // Content-Type بناءً على ملف نهائي
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    // نحفظ الطول إذا كان معروف (اختياري)
    try {
      const stat = await fs.promises.stat(finalPath);
      res.setHeader("Content-Length", String(stat.size));
    } catch (e) {
      // إن تعذر، لا مشكلة
    }

    // إرسال الملف كـ stream للعميل
    const readStream = fs.createReadStream(finalPath);
    readStream.on("error", (err) => {
      console.error("ReadStream Error:", err);
      try { res.destroy(err); } catch(e) {}
    });

    // عند الانتهاء - نظف الملفات المؤقتة
    readStream.on("close", async () => {
      await safeUnlink(downloadedPath);
      if (finalPath && finalPath !== downloadedPath) await safeUnlink(finalPath);
    });

    console.log(`✅ بدء إرسال الملف: ${filenameObj.utf8}`);
    return readStream.pipe(res);

  } catch (err) {
    console.error("❌ TraidMode GET Error:", err);
    // حاول تنظيف الملفات إن كانت موجودة
    try { await safeUnlink(downloadedPath); } catch(e){}
    try { await safeUnlink(finalPath); } catch(e){}
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التحميل من TraidMode", error: err.message });
  }
});

/**
 * POST /
 * body: { query: "name" }
 * نفس وظيفة GET لكن عبر body JSON
 */
router.post("/", async (req, res) => {
  let downloadedPath = null;
  let finalPath = null;
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ status: false, message: "⚠️ أرسل حقل 'query' في body JSON" });

    const api = new TraidModeAPI();
    const first = await api.searchFirstResult(query);
    const direct = await api.getDirectDownloadLink(first.url);
    if (!direct || !direct.url) {
      return res.status(404).json({ status: false, message: "⚠️ تعذّر استخراج رابط التحميل المباشر" });
    }

    console.log(`📥 بدء التنزيل: ${direct.url}`);
    const { path: tempPath, bytes, contentType } = await downloadToTempFile(direct.url, { "User-Agent": api.headers["user-agent"], Referer: SITE_BASE });
    downloadedPath = tempPath;
    console.log(`📦 نُزّل الملف إلى: ${tempPath} — الحجم: ${(bytes / (1024*1024)).toFixed(2)} MB`);

    const fileBuffer = await readFileBuffer(tempPath);
    const defaultFilename = direct.filename || `${first.title}.apk`;
    const { buffer: maybeApkBuffer, filename: maybeApkFilename } = await extractApkIfZippedBuffer(fileBuffer, defaultFilename);

    if (maybeApkBuffer && maybeApkBuffer !== fileBuffer) {
      const finalTemp = tmpFilePath("final");
      await fs.promises.writeFile(finalTemp, maybeApkBuffer);
      finalPath = finalTemp;
      console.log(`✅ تم استخراج APK وحفظه في: ${finalTemp}`);
    } else {
      finalPath = tempPath;
    }

    const filenameObj = sanitizeFilename(maybeApkFilename || defaultFilename);
    setAttachmentHeaders(res, filenameObj);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    try {
      const stat = await fs.promises.stat(finalPath);
      res.setHeader("Content-Length", String(stat.size));
    } catch (e) {}

    const readStream = fs.createReadStream(finalPath);
    readStream.on("close", async () => {
      await safeUnlink(downloadedPath);
      if (finalPath && finalPath !== downloadedPath) await safeUnlink(finalPath);
    });
    readStream.on("error", (err) => {
      console.error("ReadStream Error:", err);
      try { res.destroy(err); } catch(e){}
    });

    console.log(`✅ بدء إرسال الملف: ${filenameObj.utf8}`);
    return readStream.pipe(res);

  } catch (err) {
    console.error("❌ TraidMode POST Error:", err);
    try { await safeUnlink(downloadedPath); } catch(e){}
    try { await safeUnlink(finalPath); } catch(e){}
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التحميل من TraidMode", error: err.message });
  }
});

export default router;
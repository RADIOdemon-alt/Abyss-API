import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import JSZip from "jszip";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

const router = express.Router();
router.use(express.json()); // لطلبات POST

const SITE_BASE = "https://traidmode.com";

// ---------- Helpers ----------
function tmpFilePath(prefix = "traid") {
  const name = `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
  return path.join(os.tmpdir(), name);
}

async function downloadStreamToFile(url, headers = {}) {
  const tempPath = tmpFilePath("download");
  const res = await fetch(url, { headers, redirect: "follow", timeout: 0 }); // no timeout for large files
  if (!res.ok) throw new Error(`فشل التحميل: HTTP ${res.status}`);
  const dest = fs.createWriteStream(tempPath);
  return await new Promise((resolve, reject) => {
    let total = 0;
    res.body.on("data", (chunk) => { total += chunk.length; });
    res.body.on("error", (err) => {
      try { dest.close(); } catch (e) {}
      reject(err);
    });
    dest.on("error", (err) => {
      try { res.body.destroy(); } catch (e) {}
      reject(err);
    });
    dest.on("finish", () => resolve({ path: tempPath, bytes: total, contentType: res.headers.get("content-type") || null }));
    res.body.pipe(dest);
  });
}

async function readFileBuffer(filePath) {
  return fs.promises.readFile(filePath);
}

async function safeUnlink(filePath) {
  try { await fs.promises.unlink(filePath); } catch (e) { /* ignore */ }
}

/**
 * فحص ZIP/APK داخل buffer: إن كان APK مباشرة، أعِد buffer كما هو.
 * إن كان ZIP ويحتوي APK فأعد buffer الخاص بالـ APK واسم الملف.
 */
async function extractApkIfZippedBuffer(buffer, filename) {
  const isPK = buffer && buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
  if (!isPK) {
    const snippet = buffer.toString("binary", 0, Math.min(buffer.length, 1000));
    const isDirectApk = snippet.includes("AndroidManifest") || snippet.includes("classes.dex") || snippet.includes("META-INF");
    if (isDirectApk) return { buffer, filename };
    return { buffer, filename };
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);
    const apkFile = files.find(name => /\.apk$/i.test(name) && !zip.files[name].dir);
    if (!apkFile) return { buffer, filename };
    const apkBuffer = await zip.files[apkFile].async("nodebuffer");
    const apkName = apkFile.split("/").pop();
    return { buffer: apkBuffer, filename: apkName };
  } catch (err) {
    return { buffer, filename };
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

// ---------- Search & extract (from TraidMode) ----------
const EXCLUDE_PATH_PREFIXES = [
  "/", "/blog", "/f-a-q", "/faq", "/contact", "/about",
  "/category", "/tag", "/page", "/author", "/sitemap",
  "/privacy", "/terms", "/archive", "/login", "/register"
];
const EXCLUDE_TITLE_KEYWORDS = [
  "home", "الرئيسية", "blog", "faq", "contact", "about",
  "privacy", "terms", "category", "tag"
];

function resolveAndFilter(href, titleRaw = "") {
  try {
    if (!href || href === "#" || href.trim().length === 0) return null;
    let resolvedUrl;
    try { resolvedUrl = new URL(href, SITE_BASE).toString(); } catch (e) { return null; }
    const urlObj = new URL(resolvedUrl);
    const pathname = urlObj.pathname.replace(/\/+$/, "");
    const title = (titleRaw || "").toString().trim();
    const lowerPath = pathname.toLowerCase();

    for (const prefix of EXCLUDE_PATH_PREFIXES) {
      if (prefix === "/" && (lowerPath === "" || lowerPath === "/")) return null;
      if (prefix !== "/" && lowerPath.startsWith(prefix)) return null;
    }

    const lowerTitle = title.toLowerCase();
    for (const kw of EXCLUDE_TITLE_KEYWORDS) {
      if (lowerTitle.includes(kw)) return null;
    }

    if (lowerPath.includes("/?s=") || lowerPath.includes("/page/") || lowerPath.includes("/tag/") || lowerPath.includes("/category/")) return null;

    if (urlObj.hostname && !urlObj.hostname.includes("traidmode.com") && !urlObj.pathname.toLowerCase().includes(".apk")) return null;

    const finalTitle = title || resolvedUrl.split("/").pop().split("?")[0] || resolvedUrl;
    return { url: resolvedUrl, title: finalTitle.replace(/\s+/g, " ").trim() };
  } catch (e) {
    return null;
  }
}

async function searchTraidMode(query) {
  if (!query) throw new Error("الحقل 'query' مطلوب");
  const searchUrl = `${SITE_BASE}/?s=${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow', timeout: 15000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const candidates = [];

  $(".post, article, .search-result, .app-item").each((i, elem) => {
    const $elem = $(elem);
    const link = $elem.find("a").first();
    const rawHref = link.attr("href") || "";
    const titleRaw = link.attr("title") || link.text() || $elem.find("h2, h3, .title, .post-title").first().text();
    const description = $elem.find(".excerpt, .description, p").first().text().trim();
    const resolved = resolveAndFilter(rawHref, titleRaw);
    if (!resolved) return;
    candidates.push({ title: resolved.title, url: resolved.url, description: description || "" });
  });

  if (candidates.length === 0) {
    $("a").each((i, elem) => {
      const $a = $(elem);
      const href = $a.attr("href") || "";
      const titleRaw = $a.attr("title") || $a.text().trim();
      const resolved = resolveAndFilter(href, titleRaw);
      if (!resolved) return;
      if (!candidates.find(c => c.url === resolved.url)) candidates.push({ title: resolved.title, url: resolved.url, description: "" });
    });
  }

  return candidates.slice(0, 10);
}

function extractFromGetUrl(getUrl) {
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

async function getDirectDownloadLink(pageUrl) {
  if (!pageUrl) throw new Error("صفحة المصدر مطلوبة");
  let url = pageUrl;
  if (url.includes("/get/?urls=")) return extractFromGetUrl(url);
  if (!url.includes("/download")) url = url.endsWith("/") ? `${url}download/` : `${url}/download/`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow', timeout: 15000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  let getLink = null;
  $("a").each((i, elem) => {
    const href = $(elem).attr("href");
    if (!href) return;
    if (href.includes("/get/?urls=")) { getLink = href.startsWith("http") ? href : `${SITE_BASE}${href}`; return false; }
    if (href.endsWith(".apk") || href.includes(".apk")) { getLink = href.startsWith("http") ? href : href; return false; }
  });
  if (!getLink) throw new Error("لم يتم العثور على رابط تحميل مباشر في صفحة التنزيل");
  if (getLink.includes("/get/?urls=")) return extractFromGetUrl(getLink);
  return { url: getLink, filename: getLink.split("/").pop().split("?")[0], source: "traidmode" };
}

// =====================
// Routes: GET /?query=  and POST / with { query }
// =====================

/**
 * GET / -> ?query=NAME
 */
router.get("/", async (req, res) => {
  let downloaded = null;
  let finalFile = null;
  try {
    const query = req.query.query;
    if (!query) return res.status(400).json({ status: false, message: "⚠️ أرسل اسم التطبيق في المعلمة ?query=" });

    // 1) البحث واختيار أول نتيجة
    const first = (await searchTraidMode(query))[0];
    if (!first) return res.status(404).json({ status: false, message: "❌ لم تُعثر أي نتائج" });

    // 2) استخراج رابط التحميل المباشر
    const direct = await getDirectDownloadLink(first.url);
    if (!direct || !direct.url) return res.status(404).json({ status: false, message: "⚠️ تعذّر استخراج رابط التحميل المباشر" });

    // 3) تنزيل كـ stream إلى ملف مؤقت
    const headers = { "User-Agent": "Mozilla/5.0", Referer: SITE_BASE };
    const dl = await downloadStreamToFile(direct.url, headers);
    downloaded = dl.path;

    // 4) فحص الملف (ZIP -> استخراج APK إذا وُجد)
    const fileBuffer = await readFileBuffer(downloaded);
    const defaultFilename = direct.filename || `${first.title}.apk`;
    const { buffer: apkBuffer, filename: apkFilename } = await extractApkIfZippedBuffer(fileBuffer, defaultFilename);

    if (apkBuffer && apkBuffer !== fileBuffer) {
      // حصل استخراج — احفظه كـ ملف نهائي
      const finalPath = tmpFilePath("final");
      await fs.promises.writeFile(finalPath, apkBuffer);
      finalFile = finalPath;
      // حذف الملف المؤقت الأصلي
      await safeUnlink(downloaded);
      downloaded = null;
    } else {
      finalFile = dl.path;
    }

    // 5) إعداد هيدرات الإرسال
    const filenameObj = sanitizeFilename(apkFilename || defaultFilename);
    setAttachmentHeaders(res, filenameObj);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    try {
      const stat = await fs.promises.stat(finalFile);
      res.setHeader("Content-Length", String(stat.size));
    } catch (e) { /* ignore */ }

    // 6) ارسال كـ stream
    const readStream = fs.createReadStream(finalFile);
    readStream.on("error", async (err) => {
      console.error("ReadStream Error:", err);
      try { await safeUnlink(finalFile); } catch (e) {}
      try { await safeUnlink(downloaded); } catch (e) {}
      if (!res.headersSent) return res.status(500).json({ status: false, message: "❌ خطأ أثناء قراءة الملف", error: err.message });
      else res.destroy(err);
    });

    readStream.on("close", async () => {
      // تنظيف
      await safeUnlink(finalFile);
      try { if (downloaded) await safeUnlink(downloaded); } catch (e) {}
    });

    return readStream.pipe(res);

  } catch (err) {
    console.error("TraidMode Router GET Error:", err);
    try { if (downloaded) await safeUnlink(downloaded); } catch (e) {}
    try { if (finalFile) await safeUnlink(finalFile); } catch (e) {}
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التحميل من TraidMode", error: err.message });
  }
});

/**
 * POST /  body: { query: "name" }
 */
router.post("/", async (req, res) => {
  let downloaded = null;
  let finalFile = null;
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ status: false, message: "⚠️ أرسل حقل 'query' في body JSON" });

    const first = (await searchTraidMode(query))[0];
    if (!first) return res.status(404).json({ status: false, message: "❌ لم تُعثر أي نتائج" });

    const direct = await getDirectDownloadLink(first.url);
    if (!direct || !direct.url) return res.status(404).json({ status: false, message: "⚠️ تعذّر استخراج رابط التحميل المباشر" });

    const headers = { "User-Agent": "Mozilla/5.0", Referer: SITE_BASE };
    const dl = await downloadStreamToFile(direct.url, headers);
    downloaded = dl.path;

    const fileBuffer = await readFileBuffer(downloaded);
    const defaultFilename = direct.filename || `${first.title}.apk`;
    const { buffer: apkBuffer, filename: apkFilename } = await extractApkIfZippedBuffer(fileBuffer, defaultFilename);

    if (apkBuffer && apkBuffer !== fileBuffer) {
      const finalPath = tmpFilePath("final");
      await fs.promises.writeFile(finalPath, apkBuffer);
      finalFile = finalPath;
      await safeUnlink(downloaded);
      downloaded = null;
    } else {
      finalFile = dl.path;
    }

    const filenameObj = sanitizeFilename(apkFilename || defaultFilename);
    setAttachmentHeaders(res, filenameObj);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    try {
      const stat = await fs.promises.stat(finalFile);
      res.setHeader("Content-Length", String(stat.size));
    } catch (e) {}

    const readStream = fs.createReadStream(finalFile);
    readStream.on("error", async (err) => {
      console.error("ReadStream Error:", err);
      try { await safeUnlink(finalFile); } catch (e) {}
      try { if (downloaded) await safeUnlink(downloaded); } catch (e) {}
      if (!res.headersSent) return res.status(500).json({ status: false, message: "❌ خطأ أثناء قراءة الملف", error: err.message });
      else res.destroy(err);
    });

    readStream.on("close", async () => {
      await safeUnlink(finalFile);
      try { if (downloaded) await safeUnlink(downloaded); } catch (e) {}
    });

    return readStream.pipe(res);

  } catch (err) {
    console.error("TraidMode Router POST Error:", err);
    try { if (downloaded) await safeUnlink(downloaded); } catch (e) {}
    try { if (finalFile) await safeUnlink(finalFile); } catch (e) {}
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التحميل من TraidMode", error: err.message });
  }
});

export default router;
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import JSZip from "jszip";

const router = express.Router();

// لتمكين قراءة JSON في POST داخل الروتر (إن لم يكن موجود في app الرئيسي)
router.use(express.json());

const SITE_BASE = "https://traidmode.com";
const MAX_SEND_BYTES = 1024 * 1024 * 1024; // 250 MB

class TraidModeAPI {
  constructor() {
    this.baseUrl = SITE_BASE;
    this.headers = {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent":
        "Mozilla/5.0 (Linux; Android 14; 22120RN86G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
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

async function extractApkIfZipped(buffer, filename) {
  // تأكد من طول buffer قبل الوصول لبايتات
  const isPK = buffer && buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4B;
  if (!isPK) {
    const bufferString = buffer.toString("binary", 0, Math.min(buffer.length, 1000));
    const isDirectApk = bufferString.includes("AndroidManifest") || bufferString.includes("classes.dex") || bufferString.includes("META-INF");
    if (isDirectApk) {
      console.log("✅ الملف يبدو APK مباشر");
      return { buffer, filename };
    }
    throw new Error("❌ الملف المحمّل ليس APK أو ZIP صالح");
  }

  try {
    console.log("🔄 محاولة فك ضغط ZIP...");
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);
    console.log(`📁 المحتويات: ${files.join(", ")}`);
    const apkFile = files.find(name => /\.apk$/i.test(name) && !zip.files[name].dir);
    if (!apkFile) {
      console.log("⚠️ لم يتم العثور على ملف .apk داخل ZIP، إرجاع الملف الأصلي");
      return { buffer, filename };
    }
    console.log(`✅ تم العثور على APK داخل ZIP: ${apkFile}`);
    const apkBuffer = await zip.files[apkFile].async("nodebuffer");
    const apkName = apkFile.split("/").pop();
    return { buffer: apkBuffer, filename: apkName };
  } catch (err) {
    console.log(`⚠️ فشل فك ZIP: ${err.message} — إرجاع الملف الأصلي`);
    return { buffer, filename };
  }
}

/**
 * sanitizeFilename:
 * - يزيل المحارف الخطرة للهيدر
 * - يرجّع نسخة ASCII آمنة للاستخدام في filename=
 * - يحتفظ بنسخة UTF-8 مشفرة لاستخدام filename*=
 */
function sanitizeFilename(name) {
  if (!name || typeof name !== "string") return "file.apk";
  // قص طول الاسم للحماية
  let original = name.trim().slice(0, 240);

  // استبدال محارف التحكم والاقتباسات والباكسلات الخطرة
  original = original.replace(/[\u0000-\u001f\u007f-\u009f]/g, "_"); // control chars
  original = original.replace(/["<>:\\/|?*;]/g, "_"); // محارف تمنع في الهيدر
  original = original.replace(/\s+/g, "_"); // استبدال الفراغات بشرطات سفلية

  // asciiSafe: احتفظ فقط بالرموز ASCII المرئية (20-7E) وإلا استبدل بـ _
  const asciiSafe = original.replace(/[^\x20-\x7E]/g, "_");

  // أيضاً قسّم الامتداد لو كان متاحًا وحافظ عليه إن كان معروفًا (مثل .apk)
  // إن لم يكن هناك امتداد واضح، ضيف .apk افتراضياً
  let ascii = asciiSafe;
  if (!/\.[a-zA-Z0-9]{1,6}$/.test(ascii)) {
    // أضف امتداد إذا لم يوجد
    ascii = ascii + ".apk";
  }

  // النهائية: ascii و utf8 (الاسم الأصلي الذي سنستخدمه مع urlencode)
  return {
    ascii: ascii.slice(0, 200),
    utf8: original.slice(0, 240)
  };
}

function setAttachmentHeaders(res, filenameObj) {
  // filenameObj: { ascii: "...", utf8: "..." }
  const ascii = filenameObj.ascii || "file.apk";
  const utf8 = filenameObj.utf8 || ascii;
  // نستخدم كل من filename (ASCII) و filename* (UTF-8 percent-encoded)
  res.setHeader("Content-Disposition",
    `attachment; filename="${ascii.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(utf8)}`
  );
}

// =====================
// Routes
// =====================

router.get("/", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) return res.status(400).json({ status: false, message: "⚠️ أرسل اسم التطبيق في المعلمة ?query=" });

    const api = new TraidModeAPI();

    const first = await api.searchFirstResult(query);

    const direct = await api.getDirectDownloadLink(first.url);
    if (!direct || !direct.url) {
      return res.status(404).json({ status: false, message: "⚠️ تعذّر استخراج رابط التحميل المباشر" });
    }

    const remoteSize = await api.getRemoteFileSize(direct.url);
    if (remoteSize && remoteSize > MAX_SEND_BYTES) {
      console.log(`⚠️ الملف كبير: ${(remoteSize / (1024*1024)).toFixed(2)} MB`);
      return res.json({
        status: true,
        message: "⚠️ الملف كبير جداً للإرسال عبر الخادم (حد: 250 MB). استخدم الرابط المباشر للتحميل.",
        file: { filename: direct.filename || null, size_bytes: remoteSize },
        download_link: direct.url,
        source_page: first.url,
        selected_title: first.title
      });
    }

    console.log(`📥 تنزيل من: ${direct.url}`);
    const dlResp = await axios.get(direct.url, {
      responseType: "arraybuffer",
      headers: { "User-Agent": api.headers["user-agent"] || api.headers["User-Agent"], Referer: SITE_BASE },
      timeout: 300000
    });

    const buffer = Buffer.from(dlResp.data);
    console.log(`📦 حجم الملف المحمّل: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);

    if (buffer.length > MAX_SEND_BYTES) {
      console.log("⚠️ الملف بعد التنزيل أكبر من الحد");
      return res.json({
        status: true,
        message: "⚠️ الملف بعد التنزيل أكبر من الحد المسموح (250 MB). استخدم الرابط المباشر.",
        file: { filename: direct.filename || null, size_bytes: buffer.length },
        download_link: direct.url,
        source_page: first.url,
        selected_title: first.title
      });
    }

    const defaultFilename = direct.filename || `${first.title}.apk`;
    const { buffer: apkBuffer, filename: apkFilename } = await extractApkIfZipped(buffer, defaultFilename);

    const filenameObj = sanitizeFilename(apkFilename || defaultFilename);
    setAttachmentHeaders(res, filenameObj);

    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Length", apkBuffer.length);

    console.log(`✅ إرسال الملف: ${filenameObj.utf8} (${(apkBuffer.length / (1024*1024)).toFixed(2)} MB)`);
    return res.send(apkBuffer);

  } catch (err) {
    console.error("❌ TraidMode GET Error:", err);
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التحميل من TraidMode", error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ status: false, message: "⚠️ أرسل حقل 'query' في body JSON" });

    const api = new TraidModeAPI();
    const first = await api.searchFirstResult(query);
    const direct = await api.getDirectDownloadLink(first.url);
    if (!direct || !direct.url) {
      return res.status(404).json({ status: false, message: "⚠️ تعذّر استخراج رابط التحميل المباشر" });
    }

    const remoteSize = await api.getRemoteFileSize(direct.url);
    if (remoteSize && remoteSize > MAX_SEND_BYTES) {
      return res.json({
        status: true,
        message: "⚠️ الملف كبير جداً للإرسال عبر الخادم (حد: 250 MB). استخدم الرابط المباشر للتحميل.",
        file: { filename: direct.filename || null, size_bytes: remoteSize },
        download_link: direct.url,
        source_page: first.url,
        selected_title: first.title
      });
    }

    console.log(`📥 تنزيل من: ${direct.url}`);
    const dlResp = await axios.get(direct.url, {
      responseType: "arraybuffer",
      headers: { "User-Agent": api.headers["user-agent"] || api.headers["User-Agent"], Referer: SITE_BASE },
      timeout: 300000
    });

    const buffer = Buffer.from(dlResp.data);
    console.log(`📦 حجم الملف المحمّل: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);

    if (buffer.length > MAX_SEND_BYTES) {
      return res.json({
        status: true,
        message: "⚠️ الملف بعد التنزيل أكبر من الحد المسموح (250 MB). استخدم الرابط المباشر.",
        file: { filename: direct.filename || null, size_bytes: buffer.length },
        download_link: direct.url,
        source_page: first.url,
        selected_title: first.title
      });
    }

    const defaultFilename = direct.filename || `${first.title}.apk`;
    const { buffer: apkBuffer, filename: apkFilename } = await extractApkIfZipped(buffer, defaultFilename);

    const filenameObj = sanitizeFilename(apkFilename || defaultFilename);
    setAttachmentHeaders(res, filenameObj);

    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Length", apkBuffer.length);

    console.log(`✅ إرسال الملف: ${filenameObj.utf8} (${(apkBuffer.length / (1024*1024)).toFixed(2)} MB)`);
    return res.send(apkBuffer);

  } catch (err) {
    console.error("❌ TraidMode POST Error:", err);
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التحميل من TraidMode", error: err.message });
  }
});

export default router;
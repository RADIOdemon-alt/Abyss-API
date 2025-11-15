import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import JSZip from "jszip";

const router = express.Router();

const SITE_BASE = "https://traidmode.com";
const MAX_SEND_BYTES = 250 * 1024 * 1024; // 250 MB

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

  // حلل الرابط وطبق فلتر المسارات والعناوين
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
      // فلترة مسارات عامة
      for (const prefix of this.EXCLUDE_PATH_PREFIXES) {
        if (prefix === "/" && (lowerPath === "" || lowerPath === "/")) return null;
        if (prefix !== "/" && lowerPath.startsWith(prefix)) return null;
      }
      // فلترة كلمات في العنوان
      const lowerTitle = title.toLowerCase();
      for (const kw of this.EXCLUDE_TITLE_KEYWORDS) {
        if (lowerTitle.includes(kw)) return null;
      }
      // استبعاد pagination/tag/category/search
      if (lowerPath.includes("/?s=") || lowerPath.includes("/page/") || lowerPath.includes("/tag/") || lowerPath.includes("/category/")) {
        return null;
      }
      // السماح بروابط خارجية فقط إذا ملف .apk مباشر
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

  // بحث: إرجاع أول نتيجة صالحة (أو رمي خطأ إن لم توجد)
  async searchFirstResult(query) {
    if (!query) throw new Error("⚠️ الحقل 'query' مطلوب");
    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log(`🔍 TraidMode: البحث عن "${query}" -> ${searchUrl}`);
    const res = await axios.get(searchUrl, { headers: this.headers, timeout: 15000 });
    const $ = cheerio.load(res.data);

    const candidates = [];

    // محاولة التقاط عناصر النتائج المعروفة
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

    // fallback: مسح كل الروابط الظاهرة
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

  // استخراج رابط التحميل المباشر من صفحة النتيجة أو من رابط get
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
      // لو الرابط يحتوي مباشرة على /get/?urls=
      if (url.includes("/get/?urls=")) {
        return this.extractFromGetUrl(url);
      }
      // جرب الوصول إلى مسار download/ إذا لم يكن موجودًا
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

  // محاولة استعلام HEAD لمعرفة الحجم (إن أمكن)
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

// --- دعم لفك ZIP/التأكد من APK (نفس أسلوب Aptoide) ---
async function extractApkIfZipped(buffer, filename) {
  // تفقد ترويسة PK لو كان ZIP
  const isPK = buffer[0] === 0x50 && buffer[1] === 0x4B;
  if (!isPK) {
    // ربما ملف APK (APK هو ZIP داخلي)، لكن إن لم يكن PK فليس ZIP/APK
    // حاول فحص وجود علامات APK داخل أول 1000 بايت
    const bufferString = buffer.toString("binary", 0, Math.min(buffer.length, 1000));
    const isDirectApk = bufferString.includes("AndroidManifest") || bufferString.includes("classes.dex") || bufferString.includes("META-INF");
    if (isDirectApk) {
      console.log("✅ الملف يبدو APK مباشر");
      return { buffer, filename };
    }
    throw new Error("❌ الملف المحمّل ليس APK أو ZIP صالح");
  }

  // قد يكون ZIP يحتوي APK بداخل
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

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9\u0600-\u06FF\.\-_]/g, "_").slice(0, 240) || "file.apk";
}

// =====================
// Routes
// =====================

/**
 * GET /?query=NAME
 * يبحث عن التطبيق، يختار أول نتيجة، يستخرج رابط التحميل، ينزل الملف ويرجعه كـ attachment
 */
router.get("/", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) return res.status(400).json({ status: false, message: "⚠️ أرسل اسم التطبيق في المعلمة ?query=" });

    const api = new TraidModeAPI();

    // 1) البحث واختيار النتيجة الأولى
    const first = await api.searchFirstResult(query);

    // 2) استخراج رابط التحميل المباشر
    const direct = await api.getDirectDownloadLink(first.url);
    if (!direct || !direct.url) {
      return res.status(404).json({ status: false, message: "⚠️ تعذّر استخراج رابط التحميل المباشر" });
    }

    // 3) تحقق من الحجم بواسطة HEAD
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

    // 4) تنزيل الملف
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

    // 5) فك ZIP إن كان ضرورياً
    const defaultFilename = direct.filename || `${first.title}.apk`;
    const { buffer: apkBuffer, filename: apkFilename } = await extractApkIfZipped(buffer, defaultFilename);

    const safeName = sanitizeFilename(apkFilename);

    // 6) ارسال كـ attachment
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Length", apkBuffer.length);

    console.log(`✅ إرسال الملف: ${safeName} (${(apkBuffer.length / (1024*1024)).toFixed(2)} MB)`);
    return res.send(apkBuffer);

  } catch (err) {
    console.error("❌ TraidMode GET Error:", err);
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التحميل من TraidMode", error: err.message });
  }
});

/**
 * POST /
 * body: { query: "name" }
 * نفس وظيفة GET لكن عبر body JSON
 */
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
    const safeName = sanitizeFilename(apkFilename);

    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Length", apkBuffer.length);

    console.log(`✅ إرسال الملف: ${safeName} (${(apkBuffer.length / (1024*1024)).toFixed(2)} MB)`);
    return res.send(apkBuffer);

  } catch (err) {
    console.error("❌ TraidMode POST Error:", err);
    return res.status(500).json({ status: false, message: "❌ حدث خطأ أثناء التحميل من TraidMode", error: err.message });
  }
});

export default router;
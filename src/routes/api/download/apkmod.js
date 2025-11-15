import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

const SITE_BASE = "https://traidmode.com";
const IMAGE_URL = "https://qu.ax/zAXgR.jpg";
const MAX_SEND_BYTES = 250 * 1024 * 1024; // 250 MB

const EXCLUDE_PATH_PREFIXES = [
  '/', '/blog', '/f-a-q', '/faq', '/contact', '/about',
  '/category', '/tag', '/page', '/author', '/sitemap',
  '/privacy', '/terms', '/archive', '/login', '/register'
];
const EXCLUDE_TITLE_KEYWORDS = [
  'home', 'الرئيسية', 'blog', 'faq', 'contact', 'about',
  'privacy', 'terms', 'category', 'tag'
];

function defaultHeaders(referer = SITE_BASE) {
  return {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; 22120RN86G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer,
    'Connection': 'keep-alive'
  };
}

function resolveAndFilter(href, titleRaw) {
  try {
    if (!href || href === '#' || href.trim().length === 0) return null;
    let resolvedUrl;
    try {
      resolvedUrl = new URL(href, SITE_BASE).toString();
    } catch (e) {
      return null;
    }
    const urlObj = new URL(resolvedUrl);
    const pathname = urlObj.pathname.replace(/\/+$/, '');
    const title = (titleRaw || '').toString().trim();
    const lowerPath = pathname.toLowerCase();

    for (const prefix of EXCLUDE_PATH_PREFIXES) {
      if (prefix === '/' && (lowerPath === '' || lowerPath === '/')) return null;
      if (prefix !== '/' && lowerPath.startsWith(prefix)) return null;
    }

    const lowerTitle = title.toLowerCase();
    for (const kw of EXCLUDE_TITLE_KEYWORDS) {
      if (lowerTitle.includes(kw)) return null;
    }

    if (lowerPath.includes('/?s=') || lowerPath.includes('/page/') || lowerPath.includes('/tag/') || lowerPath.includes('/category/')) {
      return null;
    }

    if (urlObj.hostname && !urlObj.hostname.includes('traidmode.com') && !urlObj.pathname.toLowerCase().includes('.apk')) {
      return null;
    }

    const finalUrl = resolvedUrl;
    const finalTitle = title || finalUrl.split('/').pop().split('?')[0] || finalUrl;
    return { url: finalUrl, title: finalTitle.replace(/\s+/g, ' ').trim() };
  } catch (e) {
    return null;
  }
}

async function searchTraidMode(query) {
  try {
    const searchUrl = `${SITE_BASE}/?s=${encodeURIComponent(query)}`;
    const resp = await axios.get(searchUrl, { headers: defaultHeaders(), timeout: 15000 });
    const $ = cheerio.load(resp.data);
    const results = [];

    $('.post, article, .search-result, .app-item').each((i, elem) => {
      const $elem = $(elem);
      const link = $elem.find('a').first();
      const rawHref = link.attr('href') || '';
      const titleRaw = link.attr('title') || link.text() || $elem.find('h2, h3, .title, .post-title').first().text();
      const description = $elem.find('.excerpt, .description, p').first().text().trim();
      const resolved = resolveAndFilter(rawHref, titleRaw);
      if (!resolved) return;
      const { url, title } = resolved;
      results.push({ title, url, description: description || '' });
    });

    if (results.length === 0) {
      $('a').each((i, elem) => {
        const $a = $(elem);
        const href = $a.attr('href') || '';
        const titleRaw = $a.attr('title') || $a.text().trim();
        const resolved = resolveAndFilter(href, titleRaw);
        if (!resolved) return;
        if (!results.find(r => r.url === resolved.url)) {
          results.push({ title: resolved.title, url: resolved.url, description: '' });
        }
      });
    }

    return results.slice(0, 10);
  } catch (err) {
    throw new Error(`فشل البحث: ${err.message}`);
  }
}

function extractFromGetUrl(getUrl) {
  try {
    const urlObj = new URL(getUrl);
    const directUrl = urlObj.searchParams.get('urls');
    const filename = urlObj.searchParams.get('names');
    if (!directUrl) throw new Error('لم يتم العثور على رابط التحميل في معاملات URL');
    return {
      url: directUrl,
      filename: filename ? decodeURIComponent(filename) : directUrl.split('/').pop().split('?')[0],
      source: 'traidmode'
    };
  } catch (error) {
    throw new Error(`خطأ في تحليل رابط Get: ${error.message}`);
  }
}

async function getDirectDownloadLink(pageUrl) {
  try {
    let url = pageUrl;
    if (url.includes('/get/?urls=')) {
      return extractFromGetUrl(url);
    }
    if (!url.includes('/download')) url = url.endsWith('/') ? `${url}download/` : `${url}/download/`;

    const resp = await axios.get(url, { headers: defaultHeaders(), timeout: 15000 });
    const $ = cheerio.load(resp.data);

    let getLink = null;
    $('a').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href && href.includes('/get/?urls=')) {
        getLink = href.startsWith('http') ? href : `${SITE_BASE}${href}`;
        return false;
      }
      if (href && (href.endsWith('.apk') || href.includes('.apk'))) {
        getLink = href.startsWith('http') ? href : href;
        return false;
      }
    });

    if (getLink) {
      if (getLink.includes('/get/?urls=')) return extractFromGetUrl(getLink);
      return { url: getLink, filename: getLink.split('/').pop().split('?')[0], source: 'traidmode' };
    }

    throw new Error("لم يتم العثور على رابط التحميل في الصفحة");
  } catch (err) {
    throw new Error(`فشل استخراج الرابط: ${err.message}`);
  }
}

async function getRemoteFileSize(url) {
  try {
    const head = await axios.head(url, { headers: { 'User-Agent': defaultHeaders().['User-Agent'], 'Referer': SITE_BASE }, timeout: 10000 });
    const len = parseInt(head.headers['content-length'] || '0');
    return isNaN(len) ? 0 : len;
  } catch (e) {
    return 0; // لا نفشل إن لم تتوفر معلومات الحجم
  }
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9\u0600-\u06FF\.\-_]/g, '_').slice(0, 240) || 'file.apk';
}

// POST / -> body: { query: "gta" }
// يقوم بالبحث، يختار أول نتيجة صالحة، يستخرج رابط التحميل ويحاول إرساله مباشرة.
router.post("/", async (req, res) => {
  try {
    const query = req.body?.query || req.query?.query;
    if (!query) return res.status(400).json({ status: false, message: "⚠️ الحقل 'query' مطلوب." });

    // 1) بحث
    const results = await searchTraidMode(query);
    if (!results || results.length === 0) {
      return res.status(404).json({ status: false, message: "❌ لم تُعثر أي نتائج صالحة." });
    }

    // 2) اختر أول نتيجة
    const first = results[0];

    // 3) استخراج رابط التحميل المباشر
    const direct = await getDirectDownloadLink(first.url);
    if (!direct || !direct.url) {
      return res.status(500).json({ status: false, message: "❌ تعذّر استخراج رابط التحميل المباشر." });
    }

    // 4) تحقق من الحجم عبر HEAD (إن أمكن)
    const remoteSize = await getRemoteFileSize(direct.url);
    if (remoteSize && remoteSize > MAX_SEND_BYTES) {
      return res.json({
        status: true,
        message: "⚠️ الملف كبير جداً للإرسال عبر HTTP (حد السيرفر: 250 MB). أعد المحاولة بالتحميل المباشر.",
        file: { filename: direct.filename || null, size_bytes: remoteSize },
        download_link: direct.url,
        source_page: first.url,
        selected_title: first.title
      });
    }

    // 5) تنزيل الملف (arraybuffer)
    const dlResp = await axios.get(direct.url, { responseType: "arraybuffer", headers: { 'User-Agent': defaultHeaders().['User-Agent'], 'Referer': SITE_BASE }, timeout: 300000 });
    const buffer = Buffer.from(dlResp.data);
    const actualSize = buffer.length;
    if (actualSize > MAX_SEND_BYTES) {
      return res.json({
        status: true,
        message: "⚠️ الملف بعد التنزيل أكبر من الحد المسموح (250 MB). استخدم الرابط المباشر.",
        file: { filename: direct.filename || null, size_bytes: actualSize },
        download_link: direct.url,
        source_page: first.url,
        selected_title: first.title
      });
    }

    const filename = sanitizeFilename(direct.filename || direct.url.split('/').pop().split('?')[0] || `${first.title}.apk`);

    // 6) أعد إرسال الملف كـ attachment
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Length', String(actualSize));
    return res.send(buffer);

  } catch (err) {
    console.error("TraidMode Router Error:", err);
    return res.status(500).json({ status: false, message: "❌ حدث خطأ داخلي", error: err.message });
  }
});

export default router;
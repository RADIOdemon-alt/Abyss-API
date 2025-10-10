import express from 'express';
import axios from 'axios';
import cheerio from 'cheerio';

const router = express.Router();

// دالة لاستخراج الرابط من base64 أو متابعة redirect
async function extractUrl(url) {
  if (!url) return null;
  try {
    // إذا كان الرابط مشفر base64 داخل مسار
    let match = url.match(/\/(hd|dl|mp3)\/([A-Za-z0-9+/=]+)/);
    if (match && match[2]) {
      return Buffer.from(match[2], 'base64').toString('utf-8');
    }

    // محاولة متابعة أي redirect للحصول على الرابط النهائي
    const res = await axios.get(url, { maxRedirects: 5, headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 10)' } });
    return res.request.res.responseUrl || url;
  } catch (e) {
    return url;
  }
}

// دالة تحميل فيديو TikTok HD عبر musicaldown.com
async function downloadTikTokHD(tiktokUrl) {
  const cfg = { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 10)' } };
  try {
    // الصفحة الرئيسية لاستخراج الـ tokens
    let res = await axios.get('https://musicaldown.com/id/download', cfg);
    const $ = cheerio.load(res.data);

    const url_name = $('#link_url').attr('name');
    const ko = $('#submit-form > div');
    const token = ko.find('div.inputbg input[type=hidden]:nth-child(2)');
    const verify = ko.find('div.inputbg input[type=hidden]:nth-child(3)');

    const data = {
      [url_name]: tiktokUrl,
      [token.attr('name')]: token.attr('value'),
      verify: verify.attr('value')
    };

    // إرسال POST لتحصل على صفحة التحميل
    let dlPage = await axios.post('https://musicaldown.com/id/download', new URLSearchParams(data), {
      headers: { ...cfg.headers, cookie: res.headers['set-cookie']?.join('; ') || '' }
    });

    const $dl = cheerio.load(dlPage.data);

    // التحقق من المحتوى
    if ($dl('div.card-image').length > 0) {
      return { status: false, message: 'Slide content, video only supported' };
    }

    const rawHdLink = $dl('a[data-event="hd_download_click"]').attr('href');
    const rawVideoLink = $dl('a[data-event="mp4_download_click"]').attr('href');
    const rawWmLink = $dl('a[data-event="watermark_download_click"]').attr('href');

    // استخراج الروابط النهائية
    const videoHd = rawHdLink ? await extractUrl(rawHdLink) : null;
    const video = rawVideoLink ? await extractUrl(rawVideoLink) : null;
    const videoWm = rawWmLink ? await extractUrl(rawWmLink) : null;

    return { status: true, type: 'video', video: videoHd || video || videoWm };

  } catch (e) {
    return { status: false, message: `فشل التحميل: ${e.message}` };
  }
}

// GET API /api/tiktokhd?url=...
router.get('/', async (req, res) => {
  let url = req.query.url;
  if (!url) return res.json({
    status: false,
    creator: 'Dark team',
    message: "📌 أرسل رابط TikTok في 'url' مثل /api/tiktokhd?url=https://www.tiktok.com/@user/video/1234567890"
  });

  const result = await downloadTikTokHD(url);
  res.json({ status: result.status, creator: 'Dark team', result });
});

// POST API /api/tiktokhd
router.post('/', async (req, res) => {
  let url = req.body.url;
  if (!url) return res.status(400).json({
    status: false,
    creator: 'Dark team',
    message: "📌 أرسل رابط TikTok في 'url' ضمن JSON مثل { url: '...' }"
  });

  const result = await downloadTikTokHD(url);
  res.json({ status: result.status, creator: 'Dark team', result });
});

export default router;

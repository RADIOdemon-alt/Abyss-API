import express from 'express';
import axios from 'axios';
import cheerio from 'cheerio';

const router = express.Router();

// دالة لاستخراج الرابط من base64
function extractUrl(url) {
  let match = url?.match(/\/(hd|dl|mp3)\/([A-Za-z0-9+/=]+)/);
  if (match && match[2]) return Buffer.from(match[2], 'base64').toString('utf-8');
  return url;
}

// دالة لتوسيع الروابط القصيرة TikTok
async function expandTikTokURL(url) {
  try {
    const res = await axios.head(url, { maxRedirects: 0, validateStatus: s => s >= 200 && s < 400 });
    if (res.status === 301 || res.status === 302) return res.headers.location;
    return url;
  } catch (err) {
    // تجربة GET إذا HEAD فشل
    try {
      const res = await axios.get(url, { maxRedirects: 0, validateStatus: s => s < 400 });
      if (res.status === 301 || res.status === 302) return res.headers.location;
    } catch {}
    return url;
  }
}

// دالة تحميل فيديو TikTok HD
async function downloadTikTokHD(url) {
  const cfg = { headers: { 'user-agent': 'Mozilla/5.0' } };
  try {
    let res = await axios.get('https://musicaldown.com/id/download', cfg);
    const $ = cheerio.load(res.data);
    const url_name = $('#link_url').attr('name');
    const ko = $('#submit-form > div');
    const token = ko.find('div.inputbg input[type=hidden]:nth-child(2)');
    const verify = ko.find('div.inputbg input[type=hidden]:nth-child(3)');

    const data = {
      [url_name]: url,
      [token.attr('name')]: token.attr('value'),
      verify: verify.attr('value')
    };

    let dlPage = await axios.post('https://musicaldown.com/id/download', new URLSearchParams(data), {
      headers: { ...cfg.headers, cookie: res.headers['set-cookie'].join('; ') }
    });

    const $dl = cheerio.load(dlPage.data);
    const videoHdLink = extractUrl($dl('a[data-event="hd_download_click"]').attr('href'));

    if (!videoHdLink) throw new Error('فشل استخراج رابط الفيديو HD');
    return { status: true, video_hd: videoHdLink };

  } catch (e) {
    return { status: false, message: `فشل التحميل: ${e.message}` };
  }
}

// GET /api/tiktokhd?url=...
router.get('/', async (req, res) => {
  let url = req.query.url;
  if (!url) return res.json({
    status: true,
    creator: 'IZANA',
    message: "📌 أرسل رابط TikTok في 'url' مثل /api/tiktokhd?url=https://www.tiktok.com/@user/video/1234567890"
  });

  // تحويل الرابط القصير للرابط الكامل
  url = await expandTikTokURL(url);

  const result = await downloadTikTokHD(url);
  if (!result.status) return res.json(result);

  res.json({
    status: true,
    creator: 'IZANA|RADIO',
    result: result
  });
});

export default router;

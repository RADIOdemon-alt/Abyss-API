import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

// 🔎 دالة جلب كلمات الأغاني
async function fetchLyricsFromApi(query) {
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url, {
    headers: {
      'Host': 'lrclib.net',
      'Connection': 'keep-alive',
      'sec-ch-ua-platform': '"Android"',
      'x-user-agent': 'LRCLIB Web Client (https://github.com/tranxuanthang/lrclib)',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36',
      'accept': 'application/json',
      'lrclib-client': 'LRCLIB Web Client',
      'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Android WebView";v="140"',
      'sec-ch-ua-mobile': '?1',
      'X-Requested-With': 'mark.via.gp',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Referer': 'https://lrclib.net/search/505',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    responseType: 'json'
  });
  return data;
}

function decodeHTMLEntities(str = '') {
  return String(str)
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function toPlainLyrics(text = '') {
  let s = String(text);
  s = s.replace(/\[?\d{1,2}:\d{2}(?:[:.]\d{1,3})?\]?/g, '');
  s = s.replace(/<\/?[^>]+(>|$)/g, '');
  s = decodeHTMLEntities(s);
  s = s.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

// 🔍 GET
router.get("/", async (req, res) => {
  const query = req.query.text;
  if (!query) {
    return res.status(400).json({
      status: false,
      message: "📌 أرسل اسم الأغنية:\n/api/lyrics?text=Faded",
    });
  }

  try {
    const results = await fetchLyricsFromApi(query);

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(404).json({
        status: false,
        message: `❌ لم أتمكن من العثور على كلمات لأغنية "${query}".`
      });
    }

    const song = results[0];
    let raw = song.plainLyrics || song.syncedLyrics || song.lyrics || song.text || null;
    if (!raw) raw = Object.values(song).find(v => typeof v === 'string' && /[^\s]{10,}/.test(v)) || null;
    if (!raw) {
      return res.status(404).json({
        status: false,
        message: `🚫 لا تتوفر كلمات لأغنية "${song.trackName || query}" للمغني ${song.artistName || 'غير معروف'}.`
      });
    }

    const plain = toPlainLyrics(raw);
    const title = song.trackName || song.title || query;
    const artist = song.artistName || song.artist || 'غير معروف';

    res.json({
      status: true,
      title,
      artist,
      lyrics: plain,
      message: "✅ تم العثور على كلمات الأغنية بنجاح"
    });

  } catch (err) {
    console.error("❌ خطأ في جلب الكلمات:", err);
    res.status(500).json({
      status: false,
      message: "⚠️ حدث خطأ أثناء محاولة جلب كلمات الأغنية، أعد المحاولة لاحقًا.",
    });
  }
});

// 🔎 POST
router.post("/", async (req, res) => {
  const query = req.body.text;
  if (!query) {
    return res.status(400).json({
      status: false,
      message: "📌 أرسل اسم الأغنية:\n/api/lyrics"
    });
  }

  try {
    const results = await fetchLyricsFromApi(query);

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(404).json({
        status: false,
        message: `❌ لم أتمكن من العثور على كلمات لأغنية "${query}".`
      });
    }

    const song = results[0];
    let raw = song.plainLyrics || song.syncedLyrics || song.lyrics || song.text || null;
    if (!raw) raw = Object.values(song).find(v => typeof v === 'string' && /[^\s]{10,}/.test(v)) || null;
    if (!raw) {
      return res.status(404).json({
        status: false,
        message: `🚫 لا تتوفر كلمات لأغنية "${song.trackName || query}" للمغني ${song.artistName || 'غير معروف'}.`
      });
    }

    const plain = toPlainLyrics(raw);
    const title = song.trackName || song.title || query;
    const artist = song.artistName || song.artist || 'غير معروف';

    res.json({
      status: true,
      title,
      artist,
      lyrics: plain,
      message: "✅ تم العثور على كلمات الأغنية بنجاح"
    });

  } catch (err) {
    console.error("❌ خطأ في جلب الكلمات:", err);
    res.status(500).json({
      status: false,
      message: "⚠️ حدث خطأ أثناء محاولة جلب كلمات الأغنية، أعد المحاولة لاحقًا.",
    });
  }
});

export default router;

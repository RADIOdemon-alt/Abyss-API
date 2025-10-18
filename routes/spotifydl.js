// routes/spotifydl.js
import express from 'express';
import axios from 'axios';

const router = express.Router();

/**
 * Helpers
 */
async function obtenerTokenSpotify() {
  const clientId = "cda875b7ec6a4aeea0c8357bfdbab9c2";
  const clientSecret = "c2859b35c5164ff7be4f979e19224dbe";
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${encoded}`
      }
    }
  );

  return res.data.access_token;
}

function extractId(input) {
  if (!input) return null;
  const patterns = [
    /open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/,
    /spotify\.com\/track\/([a-zA-Z0-9]{22})/,
    /spotify:track:([a-zA-Z0-9]{22})/,
    /^([a-zA-Z0-9]{22})$/
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return null;
}

/** جلب معلومات المسار من Spotify (يمكن استخدامه في /info) */
async function spotifyInfo(query) {
  const token = await obtenerTokenSpotify();
  const maybeId = extractId(query);
  if (!maybeId) {
    // بحث نصي
    const r = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const item = r.data.tracks?.items?.[0];
    if (!item) return null;
    return {
      nombre: item.name,
      artistas: item.artists.map(a => a.name),
      album: item.album.name,
      duracion: item.duration_ms,
      link: item.external_urls?.spotify,
      id: item.id,
      image: item.album.images?.[0]?.url
    };
  } else {
    const r = await axios.get(`https://api.spotify.com/v1/tracks/${maybeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const item = r.data;
    return {
      nombre: item.name,
      artistas: item.artists.map(a => a.name),
      album: item.album.name,
      duracion: item.duration_ms,
      link: item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`,
      id: item.id,
      image: item.album.images?.[0]?.url
    };
  }
}

/** استدراج رابط التحميل من خدمة خارجية (كما سبق استخدام parsevideoapi.videosolo.com) */
async function getDownloadMeta(spotifyTrackUrl) {
  try {
    const resp = await axios.post(
      'https://parsevideoapi.videosolo.com/spotify-api/',
      { format: 'web', url: spotifyTrackUrl },
      {
        headers: {
          'authority': 'parsevideoapi.videosolo.com',
          'user-agent': 'Postify/1.0.0',
          'referer': 'https://spotidown.online/',
          'origin': 'https://spotidown.online',
          'content-type': 'application/json'
        },
        timeout: 20000
      }
    );

    const body = resp.data;
    // هيكل الاستجابة قد يختلف؛ نتحقق بأمان
    if (!body) return null;
    if (body.status === "-4") return { error: 'unsupported' };
    const metadata = body.data?.metadata;
    if (!metadata) return null;

    return {
      title: metadata.name,
      artist: metadata.artist,
      album: metadata.album,
      duration: metadata.duration,
      image: metadata.image,
      download: metadata.download // هذا يجب أن يكون رابط التحميل المباشر
    };
  } catch (err) {
    // لا تُفصح عن كل شيء للعميل؛ فقط ترجع null أو رسالة عامة
    return null;
  }
}

/**
 * Route: GET /
 * - يتوقّع query param: url (رابط سبوتيفاي أو ID)
 * - سيرجع الملف الصوتي مباشرة كـ stream (attachment mp3)
 *
 * مثال:
 * GET /api/spotifydl?url=https://open.spotify.com/track/0b11D9D0hMOYCIMN3OKreM
 */
router.get('/', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({
        success: false,
        message: '🔴 لازم تدخل رابط سبوتيفاي! مثال: /api/spotifydl?url=https://open.spotify.com/track/0b11D9D0hMOYCIMN3OKreM'
      });
    }

    // أولاً نحصل على معلومات المسار (لتكوين اسم الملف)
    const info = await spotifyInfo(url);
    if (!info) {
      return res.status(404).json({ success: false, message: '⚠️ لم أستطع العثور على معلومات المسار' });
    }

    // نستخرج رابط التحميل من الخدمة الخارجية
    const meta = await getDownloadMeta(info.link || `https://open.spotify.com/track/${info.id}`);
    if (!meta || !meta.download) {
      return res.status(502).json({ success: false, message: '❗ فشل في استخراج رابط التحميل من الخدمة الخارجية' });
    }

    // اطلب الملف كـ stream من الرابط الذي أعادته الخدمة الخارجية
    const audioResp = await axios.get(meta.download, {
      responseType: 'stream',
      timeout: 30000,
      headers: {
        // بعض الخوادم تطلب user-agent أو referer
        'User-Agent': 'Mozilla/5.0 (Node.js)'
      }
    });

    // ضع رؤوس الاستجابة بحيث يتم تنزيل الملف أو تشغيله مباشرة
    const safeTitle = (meta.title || info.nombre || 'unknown').replace(/[\/\\?%*:|"<>]/g, '-');
    const safeArtist = (meta.artist || (info.artistas || []).join(', ') || 'unknown').replace(/[\/\\?%*:|"<>]/g, '-');
    const filename = `${safeArtist} - ${safeTitle}.mp3`;

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // يمكنك إضافة طول المحتوى إذا كان مزود الاستجابة يعيده:
    if (audioResp.headers['content-length']) {
      res.setHeader('Content-Length', audioResp.headers['content-length']);
    }

    // قم بتمرير الستريم للعميل
    audioResp.data.pipe(res);

    // في حال حدوث خطأ أثناء البايب
    audioResp.data.on('error', err => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: '❗ خطأ أثناء تحميل الملف الصوتي' });
      } else {
        res.end();
      }
    });

  } catch (e) {
    console.error('spotifydl / error:', e?.message || e);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '❗ خطأ داخلي في السيرفر' });
    } else {
      res.end();
    }
  }
});

/**
 * Route: GET /info
 * - لإرجاع بيانات المسار و رابط التحميل (JSON) بدون إرسال الصوت.
 * مثال:
 * GET /api/spotifydl/info?url=https://open.spotify.com/track/0b11D9D0hMOYCIMN3OKreM
 */
router.get('/info', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, message: 'اكتب ?url=' });

    const info = await spotifyInfo(url);
    if (!info) return res.status(404).json({ success: false, message: 'لم يتم العثور على المسار' });

    const meta = await getDownloadMeta(info.link || `https://open.spotify.com/track/${info.id}`);
    if (!meta) {
      return res.status(502).json({ success: false, message: 'فشل استخراج رابط التحميل' });
    }

    res.json({
      success: true,
      data: {
        nombre: info.nombre,
        artistas: info.artistas,
        album: info.album,
        duracion: info.duracion,
        id: info.id,
        image: info.image,
        download: meta.download
      }
    });
  } catch (e) {
    console.error('spotifydl/info error:', e);
    res.status(500).json({ success: false, message: 'خطأ داخلي' });
  }
});

export default router;
// routes/spotifydl.js
// تحويل كود Baileys -> Express routes (GET / , POST / , GET /info)
// يعتمد على spotisaver.net (مثل كود المستخدم الأصلي)
// استعمل على مسؤوليتك — بعض خدمات الطرف الثالث قد تغير واجهاتها.

import express from 'express';
import axios from 'axios';
import stream from 'stream';

const router = express.Router();

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
};

/**
 * === Helpers (مأخوذ ومكيّف من كودك الأصلي) ===
 */

function parseSpotifyUrl(input) {
  if (!input) throw new Error('لم يتم تزويد رابط');
  const raw = input.trim();

  if (raw.includes('spotify.link')) {
    throw new Error('⚠️ الروابط المختصرة (spotify.link) غير مدعومة حالياً. استخدم الرابط الكامل من open.spotify.com');
  }

  const trackMatch = raw.match(/\/track\/([a-zA-Z0-9]+)/);
  if (trackMatch) {
    const id = trackMatch[1];
    return { id, type: 'track', referer: `https://spotisaver.net/en/track/${id}/` };
  }

  const playlistMatch = raw.match(/\/playlist\/([a-zA-Z0-9]+)/);
  if (playlistMatch) {
    const id = playlistMatch[1];
    return { id, type: 'playlist', referer: `https://spotisaver.net/en/playlist/${id}/` };
  }

  const albumMatch = raw.match(/\/album\/([a-zA-Z0-9]+)/);
  if (albumMatch) {
    const id = albumMatch[1];
    // spotisaver trả về playlist-like for albums in your original code
    return { id, type: 'playlist', referer: `https://spotisaver.net/en/playlist/${id}/` };
  }

  throw new Error(
    '❌ رابط Spotify غير صالح!\n\n' +
    'الروابط المدعومة:\n' +
    '• https://open.spotify.com/track/xxxxx\n' +
    '• https://open.spotify.com/playlist/xxxxx\n' +
    '• https://open.spotify.com/album/xxxxx'
  );
}

/**
 * استدعاء API الخاص بـ spotisaver لجلب بيانات المسارات/القوائم
 */
async function getSpotifyInfo(url) {
  console.log('🔄 getSpotifyInfo:', url);
  const { id, type, referer } = parseSpotifyUrl(url);

  const apiUrl = `https://spotisaver.net/api/get_playlist.php?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}&lang=en`;

  const res = await axios.get(apiUrl, {
    headers: {
      ...HEADERS,
      Referer: referer,
      Accept: 'application/json'
    },
    timeout: 20000
  });

  if (res.status !== 200) {
    throw new Error(`خطأ من API (status ${res.status})`);
  }

  const data = res.data;
  if (data?.error) throw new Error(`خطأ من API: ${data.error}`);

  const tracks = data?.tracks || [];
  if (!tracks || tracks.length === 0) {
    throw new Error('لم يتم العثور على مسارات في الرابط المرسل.');
  }

  return { id, type, tracks, raw: data };
}

/**
 * يُرسل طلب تنزيل للمسار إلى spotisaver ويعيد stream (للبث مباشرة)
 * سيجرب استخدام responseType: 'stream' وإذا عاد JSON صغير يُعالَج كخطأ.
 */
async function fetchTrackStream(track) {
  if (!track || !track.id) throw new Error('معلومات المسار ناقصة.');

  const payload = {
    track,
    download_dir: "downloads",
    filename_tag: "SPOTISAVER",
    // user_ip و is_premium كما في كودك الأصلي
    user_ip: "2404:c0:9830::800e:2a9c",
    is_premium: false
  };

  const url = "https://spotisaver.net/api/download_track.php";

  // نستخدم responseType stream عند الإمكان
  const resp = await axios.post(url, payload, {
    headers: {
      ...HEADERS,
      Referer: `https://spotisaver.net/en/track/${track.id}/`,
      'Content-Type': 'application/json'
    },
    responseType: 'stream',
    timeout: 60000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  // بعض الأحيان الخدمة تعيد JSON خطأ مع content-type application/json
  const contentType = (resp.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    // اقرأ جزء صغير ونحوله لخطأ
    const chunks = [];
    for await (const c of resp.data) chunks.push(c);
    const buf = Buffer.concat(chunks);
    let text = buf.toString('utf8').slice(0, 2000);
    try {
      const parsed = JSON.parse(text);
      throw new Error(`خدمة التحويل أعادت JSON بدلاً من ملف: ${JSON.stringify(parsed)}`);
    } catch (e) {
      throw new Error(`خدمة التحويل أعادت رد غير متوقع: ${text}`);
    }
  }

  // نعيد stream واسم الملف المُقترح
  const dispositionName = `${(track.artists?.map(a => a.name).join(', ') || 'artist')} - ${(track.name || 'track')}.mp3`.replace(/[\/\\?%*:|"<>]/g, '-').slice(0, 200);
  return { stream: resp.data, contentType: resp.headers['content-type'] || 'audio/mpeg', contentLength: resp.headers['content-length'] || null, filename: dispositionName };
}

/**
 * === Helpers لالتقاط URL من req (يدعم query أو body) ===
 */
function resolveUrlFromReq(req) {
  const urlFromBody = req.body?.url || req.body?.query || null;
  const urlFromQuery = req.query?.url || req.query?.query || null;
  return urlFromBody || urlFromQuery || null;
}

/**
 * === Routes ===
 *
 * GET  /         -> stream audio directly (expects ?url=...)
 * POST /         -> stream audio (JSON body { url: '...', index: 1 })
 * GET  /info     -> returns metadata + (download candidate link not provided because spotisaver requires download step)
 */

router.get('/', async (req, res) => {
  try {
    const input = resolveUrlFromReq(req);
    if (!input) return res.status(400).json({ success: false, message: "⚠️ أرسل باراميتر url. مثال: ?url=https://open.spotify.com/track/ID" });

    console.log('Incoming stream request for:', input);

    // جلب معلومات المسارات أولاً
    const { tracks, type } = await getSpotifyInfo(input);

    // اختر المسار بناءً على ?index= (1-based) أو استخدم الأول
    const idxQuery = parseInt(req.query.index || req.query.i || req.query.track || '0', 10);
    let trackIndex = 0;
    if (!isNaN(idxQuery) && idxQuery > 0) {
      if (idxQuery <= tracks.length) trackIndex = idxQuery - 1;
      else {
        console.warn('Requested index out of range, falling back to 0');
      }
    }

    const track = tracks[trackIndex];
    if (!track) return res.status(404).json({ success: false, message: 'لم يتم العثور على المسار المطلوب.' });

    console.log(`Will stream track [${trackIndex + 1}/${tracks.length}] :`, track.name);

    const fetched = await fetchTrackStream(track);

    // set headers and pipe
    res.setHeader('Content-Type', fetched.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fetched.filename}"`);
    if (fetched.contentLength) res.setHeader('Content-Length', fetched.contentLength);

    // pipe stream
    fetched.stream.pipe(res);

    // handle stream errors
    fetched.stream.on('error', (err) => {
      console.error('Stream error while piping to client:', err);
      if (!res.headersSent) res.status(500).json({ success: false, message: '❗ خطأ أثناء بث الملف الصوتي' });
      else res.end();
    });

  } catch (err) {
    console.error('spotifydl GET / error:', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message || 'خطأ داخلي في السيرفر' });
    } else {
      try { res.end(); } catch (_) {}
    }
  }
});

router.post('/', async (req, res) => {
  // قبول JSON { url: '...', index: 1 } أو fallback للـ GET handler logic
  try {
    // إذا لم يزرع body, حاول تفويض إلى GET بمنهجية بسيطة
    const input = resolveUrlFromReq(req);
    if (!input) return res.status(400).json({ success: false, message: "⚠️ ارسل body.url أو ?url=" });

    // نعيد استخدام نفس منطق GET عن طريق استدعاء داخلي (دون استخدام router.handle لسهولة)
    // جلب معلومات المسارات
    const { tracks, type } = await getSpotifyInfo(input);

    const indexFromBody = parseInt(req.body?.index || req.body?.i || req.query.index || '0', 10);
    let trackIndex = 0;
    if (!isNaN(indexFromBody) && indexFromBody > 0 && indexFromBody <= tracks.length) trackIndex = indexFromBody - 1;

    const track = tracks[trackIndex];
    if (!track) return res.status(404).json({ success: false, message: 'لم يتم العثور على المسار المطلوب.' });

    const fetched = await fetchTrackStream(track);

    res.setHeader('Content-Type', fetched.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fetched.filename}"`);
    if (fetched.contentLength) res.setHeader('Content-Length', fetched.contentLength);

    fetched.stream.pipe(res);
    fetched.stream.on('error', (err) => {
      console.error('Stream error while piping to client (POST):', err);
      if (!res.headersSent) res.status(500).json({ success: false, message: '❗ خطأ أثناء بث الملف الصوتي' });
      else res.end();
    });

  } catch (err) {
    console.error('spotifydl POST / error:', err?.message || err);
    if (!res.headersSent) res.status(500).json({ success: false, message: err.message || 'خطأ داخلي' });
  }
});

/**
 * GET /info -> يرد بيانات وصفية (title, artist, duration, tracks list صغيرة)
 * لا يقوم بالبث، فقط معلومات من spotisaver.get_playlist.php
 */
router.get('/info', async (req, res) => {
  try {
    const input = resolveUrlFromReq(req);
    if (!input) return res.status(400).json({ success: false, message: "اكتب ?url=" });

    const { id, type, tracks, raw } = await getSpotifyInfo(input);

    // نُرجّع قائمة مختصرة من المسارات (title, artists, duration, id)
    const simpleTracks = (tracks || []).map((t, i) => ({
      index: i + 1,
      id: t.id || null,
      title: t.name || null,
      artists: (t.artists || []).map(a => a.name).join(', '),
      album: t.album || null,
      duration_ms: t.duration_ms || null
    }));

    res.json({
      success: true,
      data: {
        id,
        type,
        count: simpleTracks.length,
        tracks: simpleTracks,
        raw // احتفظنا بالرد الخام في حال أردت تشخيص المشكلات
      }
    });
  } catch (err) {
    console.error('spotifydl /info error:', err?.message || err);
    res.status(500).json({ success: false, message: err.message || 'خطأ داخلي' });
  }
});

export default router;
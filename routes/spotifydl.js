// routes/spotifydl.js
import express from 'express';
import axios from 'axios';

const router = express.Router();

// ====== دوال مساعدة ======
async function obtenerTokenSpotify() {
  const clientId = "cda875b7ec6a4aeea0c8357bfdbab9c2";
  const clientSecret = "c2859b35c5164ff7be4f979e19224dbe";
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        'Content-Type': "application/x-www-form-urlencoded",
        'Authorization': `Basic ${encoded}`
      }
    }
  );

  return response.data.access_token;
}

function extractId(input) {
  if (!input) return null;
  const patterns = [
    /spotify\.com\/track\/([a-zA-Z0-9]{22})/,
    /spotify:track:([a-zA-Z0-9]{22})/,
    /^([a-zA-Z0-9]{22})$/
  ];
  for (const p of patterns) {
    const match = input.match(p);
    if (match) return match[1];
  }
  return null;
}

async function spotifyxv(query) {
  const token = await obtenerTokenSpotify();
  const maybeId = extractId(query);

  if (maybeId) {
    const res = await axios.get(`https://api.spotify.com/v1/tracks/${maybeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const t = res.data;
    return [{
      nombre: t.name,
      artistas: t.artists.map(a => a.name),
      album: t.album.name,
      duracion: t.duration_ms,
      link: t.external_urls.spotify,
      id: t.id,
      image: t.album.images[0]?.url
    }];
  } else {
    const res = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.data.tracks.items.map(t => ({
      nombre: t.name,
      artistas: t.artists.map(a => a.name),
      album: t.album.name,
      duracion: t.duration_ms,
      link: t.external_urls.spotify,
      id: t.id,
      image: t.album.images[0]?.url
    }));
  }
}

async function spotiDown(url) {
  const id = extractId(url);
  if (!id) {
    return { status: false, code: 400, result: { error: "🧞 لم يتم استخراج رابط صحيح" } };
  }

  try {
    const fullUrl = `https://open.spotify.com/track/${id}`;
    const res = await axios.post(
      'https://parsevideoapi.videosolo.com/spotify-api/',
      { format: 'web', url: fullUrl },
      {
        headers: {
          'authority': 'parsevideoapi.videosolo.com',
          'user-agent': 'Postify/1.0.0',
          'referer': 'https://spotidown.online/',
          'origin': 'https://spotidown.online'
        },
        timeout: 15000
      }
    );

    const { status, data } = res.data;
    if (status === "-4") {
      return { status: false, code: 400, result: { error: "⚠️ فقط المسارات (Tracks) مسموحة" } };
    }

    const meta = data?.metadata;
    if (!meta || !meta.name) {
      return { status: false, code: 404, result: { error: "❌ لم يتم العثور على معلومات الأغنية" } };
    }

    return {
      status: true,
      code: 200,
      result: {
        title: meta.name,
        artist: meta.artist,
        album: meta.album,
        duration: meta.duration,
        image: meta.image,
        download: meta.download,
        trackId: id
      }
    };
  } catch {
    return { status: false, code: 500, result: { error: "❗ حدث خطأ أثناء التحميل" } };
  }
}

// ====== المسار الرئيسي ======
router.get('/', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({
        success: false,
        message: '🔴 لازم تدخل رابط سبوتيفاي!',
        example: 'GET /api/spotifydl?url=https://open.spotify.com/track/0b11D9D0hMOYCIMN3OKreM'
      });
    }

    const resultados = await spotifyxv(url);
    if (!resultados?.length) {
      return res.status(404).json({ success: false, message: "⚠️ لم يتم العثور على نتائج" });
    }

    const result = resultados[0];
    const down = await spotiDown(result.link);
    if (!down.status) {
      return res.status(down.code).json({ success: false, message: down.result.error });
    }

    res.json({
      success: true,
      data: down.result
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "❗ خطأ داخلي", error: e.message });
  }
});

// بحث
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: "اكتب اسم أغنية للبحث" });
    const results = await spotifyxv(q);
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ success: false, message: "❗ خطأ أثناء البحث", error: e.message });
  }
});

export default router;
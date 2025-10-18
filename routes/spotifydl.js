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
    /open\.spotify\.com\/track\/([a-zA-Z0-9]{22})/,
    /^([a-zA-Z0-9]{22})$/
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function spotifyxv(query) {
  const token = await obtenerTokenSpotify();
  const maybeId = extractId(query);

  if (maybeId) {
    // جلب بيانات المسار مباشرة من ID
    const response = await axios.get(
      `https://api.spotify.com/v1/tracks/${maybeId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const item = response.data;
    return [{
      nombre: item.name,
      artistas: item.artists.map(a => a.name),
      album: item.album.name,
      duracion: item.duration_ms,
      link: item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`,
      id: item.id
    }];
  } else {
    // بحث نصي عادي
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    return response.data.tracks.items.map(item => ({
      nombre: item.name,
      artistas: item.artists.map(a => a.name),
      album: item.album.name,
      duracion: item.duration_ms,
      link: item.external_urls.spotify,
      id: item.id
    }));
  }
}

async function spotiDown(url) {
  const trackId = extractId(url);
  if (!trackId) {
    return {
      status: false,
      code: 400,
      result: {
        error: "🧞 لم يتم استخراج رابط صحيح من نتيجة البحث"
      }
    };
  }

  const fullUrl = `https://open.spotify.com/track/${trackId}`;

  try {
    const response = await axios.post(
      'https://parsevideoapi.videosolo.com/spotify-api/',
      { format: 'web', url: fullUrl },
      {
        headers: {
          'authority': 'parsevideoapi.videosolo.com',
          'user-agent': 'Postify/1.0.0',
          'referer': 'https://spotidown.online/',
          'origin': 'https://spotidown.online'
        }
      }
    );

    const { status, data } = response.data;

    if (status === "-4") {
      return {
        status: false,
        code: 400,
        result: {
          error: "🧞 الرابط غير مدعوم. فقط المسارات (Tracks) مسموحة 😂"
        }
      };
    }

    const meta = data?.metadata;
    if (!meta || Object.keys(meta).length === 0) {
      return {
        status: false,
        code: 404,
        result: {
          error: "🧞 لم يتم العثور على معلومات عن المسار. جرب اسم مختلف!"
        }
      };
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
        trackId
      }
    };
  } catch (error) {
    return {
      status: false,
      code: error.response?.status || 500,
      result: {
        error: "🧞 فشل في تحميل الأغنية. حاول لاحقاً."
      }
    };
  }
}

// ====== Routes ======

// Route للبحث عن أغاني Spotify
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: '🔴 لازم تدخل اسم الفنان أو الأغنية أو رابط سبوتيفاي!',
        example: 'GET /api/spotify/search?q=insane HAZBIN hotel'
      });
    }

    const resultados = await spotifyxv(q);

    if (!resultados || resultados.length === 0) {
      return res.status(404).json({
        success: false,
        message: '⚠️ مع الأسف مش لاقي حاجة تطابق بحثك 😔'
      });
    }

    res.json({
      success: true,
      count: resultados.length,
      results: resultados
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: '❗ حصل خطأ أثناء البحث',
      error: error.message
    });
  }
});

// Route لتحميل أغنية من Spotify
router.post('/download', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: '🔴 لازم تدخل اسم الفنان أو الأغنية أو رابط سبوتيفاي!',
        example: 'POST /api/spotify/download with body: { "query": "insane HAZBIN hotel" }'
      });
    }

    // البحث عن الأغنية
    const resultados = await spotifyxv(query);

    if (!resultados || resultados.length === 0) {
      return res.status(404).json({
        success: false,
        message: '⚠️ مع الأسف مش لاقي حاجة تطابق بحثك 😔'
      });
    }

    const result = resultados[0];
    const trackUrl = result.link;

    // تحميل الأغنية
    const downloadResult = await spotiDown(trackUrl);

    if (!downloadResult.status) {
      return res.status(downloadResult.code).json({
        success: false,
        message: downloadResult.result.error
      });
    }

    const { title, artist, album, duration, image, download, trackId } = downloadResult.result;

    res.json({
      success: true,
      track: {
        title,
        artist,
        album,
        duration,
        image,
        downloadUrl: download,
        trackId,
        spotifyUrl: `https://open.spotify.com/track/${trackId}`
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: '❗ حصل خطأ أثناء التحميل',
      error: error.message
    });
  }
});

// Route لتحميل الملف الصوتي مباشرة
router.get('/stream/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;

    if (!trackId) {
      return res.status(400).json({
        success: false,
        message: '🔴 لازم تدخل Track ID'
      });
    }

    const trackUrl = `https://open.spotify.com/track/${trackId}`;
    const downloadResult = await spotiDown(trackUrl);

    if (!downloadResult.status) {
      return res.status(downloadResult.code).json({
        success: false,
        message: downloadResult.result.error
      });
    }

    const { download, title, artist } = downloadResult.result;

    // تحميل الملف الصوتي
    const audioRes = await axios.get(download, { 
      responseType: 'arraybuffer' 
    });

    // إرسال الملف الصوتي
    res.set({
      'Content-Type': 'audio/mp4',
      'Content-Disposition': `attachment; filename="${artist} - ${title}.mp3"`
    });

    res.send(Buffer.from(audioRes.data));

  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({
      success: false,
      message: '❗ حصل خطأ أثناء تحميل الملف',
      error: error.message
    });
  }
});

// Route للحصول على معلومات Track محدد
router.get('/track/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;

    if (!trackId) {
      return res.status(400).json({
        success: false,
        message: '🔴 لازم تدخل Track ID'
      });
    }

    const token = await obtenerTokenSpotify();
    const response = await axios.get(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const item = response.data;

    res.json({
      success: true,
      track: {
        id: item.id,
        name: item.name,
        artists: item.artists.map(a => a.name),
        album: item.album.name,
        duration: item.duration_ms,
        image: item.album.images[0]?.url,
        spotifyUrl: item.external_urls.spotify,
        previewUrl: item.preview_url
      }
    });

  } catch (error) {
    console.error('Track info error:', error);
    res.status(500).json({
      success: false,
      message: '❗ حصل خطأ أثناء جلب معلومات المسار',
      error: error.message
    });
  }
});

export default router;
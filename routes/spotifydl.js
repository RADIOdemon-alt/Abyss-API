// api/spotifydl.js  (لـ Vercel Serverless)
import axios from 'axios';

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

async function obtenerTokenSpotify() {
  const clientId = process.env.SPOTIFY_CLIENT_ID || "cda875b7ec6a4aeea0c8357bfdbab9c2";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "c2859b35c5164ff7be4f979e19224dbe";
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    { headers: { 'Content-Type': "application/x-www-form-urlencoded", 'Authorization': `Basic ${encoded}` } }
  );
  return response.data.access_token;
}

async function spotifyxv(query) {
  const token = await obtenerTokenSpotify();
  const maybeId = extractId(query);
  if (maybeId) {
    const { data: item } = await axios.get(`https://api.spotify.com/v1/tracks/${maybeId}`, { headers: { Authorization: `Bearer ${token}` } });
    return [{ nombre: item.name, artistas: item.artists.map(a=>a.name), album: item.album.name, duracion: item.duration_ms, link: item.external_urls?.spotify, id: item.id, image: item.album.images[0]?.url }];
  } else {
    const { data } = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, { headers: { Authorization: `Bearer ${token}` } });
    return data.tracks.items.map(item => ({ nombre: item.name, artistas: item.artists.map(a=>a.name), album: item.album.name, duracion: item.duration_ms, link: item.external_urls.spotify, id: item.id, image: item.album.images[0]?.url }));
  }
}

// يمكنك نقل spotiDown هنا أيضاً — يستدعي videosolo API كما في كودك.
// لأجل المثال سأدع المعالجة الأصلية مكانها: افترض أن spotiDown مشابه ومتاح.

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ success:false, message: 'Method Not Allowed' });

    const { url, q } = req.query;
    if (!url) return res.status(400).json({ success:false, message: '🔴 لازم تدخل رابط سبوتيفاي!' });

    const resultados = await spotifyxv(url);
    if (!resultados || resultados.length === 0) return res.status(404).json({ success:false, message: '⚠️ مع الأسف مش لاقي حاجة' });

    const result = resultados[0];
    // هنا ينبغي تضمين منطق spotiDown كما في كودك (POST لـ parsevideoapi...).
    // قم باستدعاء spotiDown(result.link) ثم إرجاع JSON كما في كود الـ Express.
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message:'❗ حصل خطأ', error: err.message });
  }
}
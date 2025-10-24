import express from "express";
import axios from "axios";

const router = express.Router();

class SpotifyAPI {
  constructor() {
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
      "Accept": "application/json"
    };
  }

  parseSpotifyUrl(url) {
    if (url.includes('spotify.link')) {
      throw new Error('⚠️ الروابط المختصرة غير مدعومة. استخدم open.spotify.com');
    }

    const trackMatch = url.match(/\/track\/([a-zA-Z0-9]+)/);
    if (!trackMatch) {
      throw new Error('❌ رابط Spotify غير صالح! استخدم رابط Track فقط');
    }

    return trackMatch[1];
  }

  async getTrackInfo(trackId) {
    const apiUrl = `https://spotisaver.net/api/get_playlist.php?id=${trackId}&type=track&lang=en`;
    const referer = `https://spotisaver.net/en/track/${trackId}/`;

    const response = await axios.get(apiUrl, {
      headers: { ...this.headers, Referer: referer },
      timeout: 20000
    });

    if (response.data.error || !response.data.tracks?.[0]) {
      throw new Error('❌ لم يتم العثور على المسار');
    }

    return response.data.tracks[0];
  }

  async downloadTrack(track) {
    const payload = {
      track,
      download_dir: "downloads",
      filename_tag: "SPOTISAVER",
      user_ip: "2404:c0:9830::800e:2a9c",
      is_premium: false
    };

    const response = await axios.post(
      "https://spotisaver.net/api/download_track.php",
      payload,
      {
        headers: {
          ...this.headers,
          Referer: `https://spotisaver.net/en/track/${track.id}/`,
          'Content-Type': 'application/json'
        },
        responseType: "arraybuffer",
        timeout: 60000
      }
    );

    if (response.data.length < 1000) {
      throw new Error('❌ حجم الملف صغير جداً - قد يكون هناك خطأ');
    }

    return Buffer.from(response.data);
  }
}

/** 🎵 POST Route */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط Spotify مطلوب (url)" 
      });
    }

    const spotify = new SpotifyAPI();
    
    // استخراج Track ID
    const trackId = spotify.parseSpotifyUrl(url);
    
    // الحصول على معلومات المسار
    const track = await spotify.getTrackInfo(trackId);
    
    // تنزيل المسار
    const audioBuffer = await spotify.downloadTrack(track);
    
    // إرسال الملف
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${track.name.replace(/[^\w\s-]/g, '')}.mp3"`
    });
    
    res.send(audioBuffer);

  } catch (err) {
    console.error("Spotify Error:", err.message);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء تنزيل المسار", 
      error: err.message 
    });
  }
});

/** 🎵 GET Route */
router.get("/", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط Spotify مطلوب (url)",
        example: "?url=https://open.spotify.com/track/xxxxx"
      });
    }

    const spotify = new SpotifyAPI();
    
    // استخراج Track ID
    const trackId = spotify.parseSpotifyUrl(url);
    
    // الحصول على معلومات المسار
    const track = await spotify.getTrackInfo(trackId);
    
    // تنزيل المسار
    const audioBuffer = await spotify.downloadTrack(track);
    
    // إرسال الملف
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${track.name.replace(/[^\w\s-]/g, '')}.mp3"`
    });
    
    res.send(audioBuffer);

  } catch (err) {
    console.error("Spotify Error:", err.message);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء تنزيل المسار", 
      error: err.message 
    });
  }
});

export default router;
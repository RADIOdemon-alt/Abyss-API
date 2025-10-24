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

    // ✅ إرجاع كائن Track الكامل كما يأتي من API
    return response.data.tracks[0];
  }

  async downloadTrack(track) {
    // ✅ نفس الـ payload الموجود في الكود الأصلي
    const payload = {
      track,  // كائن Track كامل
      download_dir: "downloads",
      filename_tag: "SPOTISAVER",
      user_ip: "2404:c0:9830::800e:2a9c",
      is_premium: false
    };

    console.log("📤 إرسال طلب التنزيل...");
    console.log("📦 Payload:", JSON.stringify(payload, null, 2));

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
      console.warn("⚠️ حجم الملف صغير جداً");
      const errorText = Buffer.from(response.data).toString('utf8').substring(0, 500);
      console.log("محتوى الرد:", errorText);
      throw new Error('❌ حجم الملف صغير جداً - قد يكون هناك خطأ');
    }

    console.log("✅ تم تنزيل المسار بنجاح، الحجم:", response.data.length, "بايت");
    return Buffer.from(response.data);
  }

  cleanFileName(name = 'track') {
    return name.replace(/[\\/:"'*?<>|]+/g, '').replace(/\s+/g, '_').slice(0, 150);
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

    console.log("🔗 الرابط المستلم:", url);

    const spotify = new SpotifyAPI();
    
    // استخراج Track ID
    const trackId = spotify.parseSpotifyUrl(url);
    console.log("✅ تم العثور على Track ID:", trackId);
    
    // الحصول على معلومات المسار الكاملة
    const track = await spotify.getTrackInfo(trackId);
    console.log("🎯 المسار المحدد:", track.name);
    console.log("🎵 الفنان:", track.artists?.map(a => a.name).join(', '));
    
    // تنزيل المسار (مع إرسال كائن Track الكامل)
    const audioBuffer = await spotify.downloadTrack(track);
    
    // إرسال الملف
    const filename = `${spotify.cleanFileName(track.name || `track-${track.id}`)}.mp3`;
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    
    res.send(audioBuffer);

  } catch (err) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ خطأ في Spotify:");
    console.error("الرسالة:", err.message);
    console.error("النوع:", err.name);
    
    if (err.response) {
      console.error("📡 رد الخادم:");
      console.error("Status:", err.response.status);
      try {
        const errorText = Buffer.from(err.response.data).toString('utf8');
        console.error("رد الخطأ:", errorText);
      } catch (e) {
        console.error("Data:", err.response.data);
      }
    }
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
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

    console.log("🔗 الرابط المستلم:", url);

    const spotify = new SpotifyAPI();
    
    // استخراج Track ID
    const trackId = spotify.parseSpotifyUrl(url);
    console.log("✅ تم العثور على Track ID:", trackId);
    
    // الحصول على معلومات المسار الكاملة
    const track = await spotify.getTrackInfo(trackId);
    console.log("🎯 المسار المحدد:", track.name);
    console.log("🎵 الفنان:", track.artists?.map(a => a.name).join(', '));
    
    // تنزيل المسار (مع إرسال كائن Track الكامل)
    const audioBuffer = await spotify.downloadTrack(track);
    
    // إرسال الملف
    const filename = `${spotify.cleanFileName(track.name || `track-${track.id}`)}.mp3`;
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    
    res.send(audioBuffer);

  } catch (err) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ خطأ في Spotify:");
    console.error("الرسالة:", err.message);
    console.error("النوع:", err.name);
    
    if (err.response) {
      console.error("📡 رد الخادم:");
      console.error("Status:", err.response.status);
      try {
        const errorText = Buffer.from(err.response.data).toString('utf8');
        console.error("رد الخطأ:", errorText);
      } catch (e) {
        console.error("Data:", err.response.data);
      }
    }
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء تنزيل المسار", 
      error: err.message 
    });
  }
});

export default router;
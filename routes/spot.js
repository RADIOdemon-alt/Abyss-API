import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";

const router = express.Router();

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
};

class SpotifyDownloader {
  constructor() {
    this.baseUrl = "https://spotisaver.net/api";
  }

  parseSpotifyUrl(input) {
    console.log("🔍 جاري تحليل المدخل:", input);
    
    let url = input.trim();
    
    if (url.includes('spotify.link')) {
      throw new Error('⚠️ الروابط المختصرة (spotify.link) غير مدعومة حالياً.\nاستخدم الرابط الكامل من open.spotify.com');
    }
    
    let trackMatch = url.match(/\/track\/([a-zA-Z0-9]+)/);
    if (trackMatch) {
      const id = trackMatch[1];
      console.log("✅ تم العثور على Track ID:", id);
      return {
        id,
        type: 'track',
        referer: `https://spotisaver.net/en/track/${id}/`
      };
    }
    
    let playlistMatch = url.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (playlistMatch) {
      const id = playlistMatch[1];
      console.log("✅ تم العثور على Playlist ID:", id);
      return {
        id,
        type: 'playlist',
        referer: `https://spotisaver.net/en/playlist/${id}/`
      };
    }
    
    let albumMatch = url.match(/\/album\/([a-zA-Z0-9]+)/);
    if (albumMatch) {
      const id = albumMatch[1];
      console.log("✅ تم العثور على Album ID:", id);
      return {
        id,
        type: 'playlist',
        referer: `https://spotisaver.net/en/playlist/${id}/`
      };
    }
    
    throw new Error(
      '❌ رابط Spotify غير صالح!\n\n' +
      'الروابط المدعومة:\n' +
      '• https://open.spotify.com/track/xxxxx\n' +
      '• https://open.spotify.com/playlist/xxxxx\n' +
      '• https://open.spotify.com/album/xxxxx'
    );
  }

  async getSpotifyInfo(url) {
    console.log("🔄 جاري التحقق من رابط Spotify...");
    
    const { id, type, referer } = this.parseSpotifyUrl(url);

    const apiUrl = `${this.baseUrl}/get_playlist.php?id=${id}&type=${type}&lang=en`;
    console.log("📡 API URL:", apiUrl);
    console.log("📋 Referer:", referer);
    
    try {
      const res = await axios.get(apiUrl, { 
        headers: { 
          ...HEADERS, 
          Referer: referer,
          'Accept': 'application/json'
        }, 
        timeout: 20000 
      });
      
      console.log("📥 رد API (status " + res.status + ")");
      
      if (res.data.error) {
        throw new Error(`خطأ من API: ${res.data.error}`);
      }
      
      const tracks = res.data?.tracks || [];
      
      if (!tracks || tracks.length === 0) {
        throw new Error(
          `لم يتم العثور على مسارات في الرابط.\n\n` +
          `الرد من API:\n${JSON.stringify(res.data, null, 2)}`
        );
      }
      
      console.log("✅ تم العثور على", tracks.length, "مسار");
      
      return { tracks, type, id };
      
    } catch (error) {
      if (error.response) {
        console.error("❌ خطأ من API:");
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
        
        if (error.response.status === 400) {
          throw new Error(
            `❌ رابط Spotify غير صالح أو منتهي الصلاحية\n\n` +
            `تفاصيل الخطأ: ${JSON.stringify(error.response.data)}\n\n` +
            `تأكد من:\n` +
            `• الرابط صحيح وكامل\n` +
            `• المسار/القائمة موجودة وليست محذوفة\n` +
            `• الرابط من open.spotify.com وليس spotify.link`
          );
        }
      }
      throw error;
    }
  }

  async downloadTrack(track) {
    if (!track || !track.id) {
      throw new Error('معلومات المسار ناقصة.');
    }
    
    console.log("🔄 جاري تنزيل المسار:", track.name);
    console.log("🎵 الفنان:", track.artists?.map(a => a.name).join(', '));
    console.log("🆔 Track ID:", track.id);
    
    const payload = {
      track,
      download_dir: "downloads",
      filename_tag: "SPOTISAVER",
      user_ip: "2404:c0:9830::800e:2a9c",
      is_premium: false
    };

    console.log("📤 إرسال طلب التنزيل...");
    
    try {
      const res = await axios.post(
        `${this.baseUrl}/download_track.php`,
        payload,
        {
          headers: { 
            ...HEADERS, 
            Referer: `https://spotisaver.net/en/track/${track.id}/`,
            'Content-Type': 'application/json'
          },
          responseType: "arraybuffer",
          timeout: 60000
        }
      );

      console.log("✅ تم تنزيل المسار بنجاح، الحجم:", res.data.length, "بايت");
      
      if (res.data.length < 1000) {
        console.warn("⚠️ حجم الملف صغير جداً، قد يكون هناك خطأ");
      }
      
      return Buffer.from(res.data);
      
    } catch (error) {
      if (error.response) {
        console.error("❌ خطأ في التنزيل:");
        console.error("Status:", error.response.status);
      }
      throw error;
    }
  }

  cleanFileName(name = 'track') {
    return name.replace(/[\\/:"'*?<>|]+/g, '').replace(/\s+/g, '_').slice(0, 150);
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  let tempFile = null;
  
  try {
    const { url, trackIndex } = req.body;
    
    if (!url || !url.includes('spotify')) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط Spotify مطلوب",
        usage: "أرسل { url: 'https://open.spotify.com/...', trackIndex: 1 }"
      });
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎵 بدء معالجة طلب Spotify (POST)");
    console.log("🔗 الرابط:", url);

    const spotify = new SpotifyDownloader();
    const { tracks, type } = await spotify.getSpotifyInfo(url);

    let selectedIndex = 0;
    if (type === 'playlist' && trackIndex && Number.isInteger(trackIndex) && trackIndex > 0 && trackIndex <= tracks.length) {
      selectedIndex = trackIndex - 1;
    }

    const track = tracks[selectedIndex];
    console.log("🎯 المسار المحدد:", track.name);

    const fileBuffer = await spotify.downloadTrack(track);

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("تم تنزيل ملف فارغ");
    }

    const filename = `${spotify.cleanFileName(track.name || `track-${track.id}`)}.mp3`;
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': fileBuffer.length
    });

    res.send(fileBuffer);

    console.log("✅ تم إرسال الملف بنجاح");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  } catch (err) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ خطأ في معالجة الطلب:");
    console.error("الرسالة:", err.message);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء تنزيل المسار", 
      error: err.message 
    });
  } finally {
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
        console.log("🗑️ تم حذف الملف المؤقت");
      } catch (e) {
        console.error("خطأ في حذف الملف المؤقت:", e);
      }
    }
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  let tempFile = null;
  
  try {
    const url = req.query.url;
    const trackIndex = req.query.trackIndex ? parseInt(req.query.trackIndex) : null;
    
    if (!url || !url.includes('spotify')) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط Spotify مطلوب",
        usage: "?url=https://open.spotify.com/...&trackIndex=1"
      });
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎵 بدء معالجة طلب Spotify (GET)");
    console.log("🔗 الرابط:", url);

    const spotify = new SpotifyDownloader();
    const { tracks, type } = await spotify.getSpotifyInfo(url);

    let selectedIndex = 0;
    if (type === 'playlist' && trackIndex && Number.isInteger(trackIndex) && trackIndex > 0 && trackIndex <= tracks.length) {
      selectedIndex = trackIndex - 1;
    }

    const track = tracks[selectedIndex];
    console.log("🎯 المسار المحدد:", track.name);

    const fileBuffer = await spotify.downloadTrack(track);

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("تم تنزيل ملف فارغ");
    }

    const filename = `${spotify.cleanFileName(track.name || `track-${track.id}`)}.mp3`;
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': fileBuffer.length
    });

    res.send(fileBuffer);

    console.log("✅ تم إرسال الملف بنجاح");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  } catch (err) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌ خطأ في معالجة الطلب:");
    console.error("الرسالة:", err.message);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء تنزيل المسار", 
      error: err.message 
    });
  } finally {
    if (tempFile && fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
        console.log("🗑️ تم حذف الملف المؤقت");
      } catch (e) {
        console.error("خطأ في حذف الملف المؤقت:", e);
      }
    }
  }
});

/** 🧩 GET Route لمعلومات المسار فقط (بدون تنزيل) */
router.get("/info", async (req, res) => {
  try {
    const url = req.query.url;
    
    if (!url || !url.includes('spotify')) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط Spotify مطلوب" 
      });
    }

    const spotify = new SpotifyDownloader();
    const { tracks, type, id } = await spotify.getSpotifyInfo(url);

    const tracksList = tracks.map((track, index) => ({
      index: index + 1,
      id: track.id,
      name: track.name,
      artists: track.artists?.map(a => a.name).join(', '),
      album: track.album,
      duration: track.duration_ms ? Math.round(track.duration_ms/1000) + 's' : 'غير معروف'
    }));

    res.json({ 
      status: true, 
      message: "✅ تم الحصول على المعلومات بنجاح",
      type,
      id,
      totalTracks: tracks.length,
      tracks: tracksList
    });

  } catch (err) {
    console.error("❌ خطأ:", err.message);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء جلب المعلومات", 
      error: err.message 
    });
  }
});

export default router;
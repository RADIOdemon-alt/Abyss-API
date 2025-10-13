import express from "express";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

/** 🧩 Route: /api/suno-ai */
router.all("/", async (req, res) => {
  try {
    const prompt = req.query.prompt || req.body.prompt;

    if (!prompt) {
      return res.status(400).json({
        status: false,
        message: "⚠️ أرسل 'prompt' مثل: ?prompt=أغنية عن البحر والحب",
      });
    }

    // معلومات الجهاز
    const deviceId = uuidv4();
    const msgId = uuidv4();
    const time = Date.now().toString();

    const headers = {
      "user-agent": "NB Android/1.0.0",
      "content-type": "application/json",
      "accept": "application/json",
      "x-platform": "android",
      "x-app-version": "1.0.0",
      "x-country": "ID",
      "accept-language": "id-ID",
      "x-client-timezone": "Asia/Jakarta",
      "x-device-id": deviceId,
      "x-request-id": msgId,
      "x-message-id": msgId,
      "x-request-time": time,
    };

    // إنشاء مستخدم مؤقت
    const fcmToken =
      "eqnTqlxMTSKQL5NQz6r5aP:APA91bHa3CvL5Nlcqx2yzqTDAeqxm_L_vIYxXqehkgmTsCXrV29eAak6_jqXv5v1mQrdw4BGMLXl_BFNrJ67Em0vmdr3hQPVAYF8kR7RDtTRHQ08F3jLRRI";

    const reg = await axios.put(
      "https://musicai.apihub.today/api/v1/users",
      { deviceId, fcmToken },
      { headers }
    );

    const userId = reg.data.id;
    const createHeaders = { ...headers, "x-client-id": userId };

    // إنشاء الأغنية
    const create = await axios.post(
      "https://musicai.apihub.today/api/v1/song/create",
      { type: "lyrics", name: prompt, lyrics: prompt },
      { headers: createHeaders }
    );

    const songId = create.data.id;
    const checkHeaders = { ...headers, "x-client-id": userId };

    // التحقق من الحالة حتى يتم توليد الرابط
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    let found = null;
    let tries = 0;

    while (tries < 15) {
      const check = await axios.get(
        "https://musicai.apihub.today/api/v1/song/user",
        {
          params: { userId, page: 1, searchText: "" },
          headers: checkHeaders,
        }
      );

      found = check.data.datas.find((s) => s.id === songId);
      if (found && found.url) break;

      await delay(3000);
      tries++;
    }

    if (!found || !found.url) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل توليد الأغنية، حاول مجددًا لاحقًا.",
      });
    }

    res.status(200).json({
      status: true,
      message: "✅ تم إنشاء الأغنية بنجاح",
      title: found.name,
      audio_url: found.url,
      thumbnail: found.thumbnail_url,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء توليد الأغنية",
      error: err?.message || err,
    });
  }
});

export default router;
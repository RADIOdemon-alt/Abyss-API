import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

class SoundCloudAPI {
  constructor() {}

  async download(url) {
    try {
      // 1️⃣ جلب الصفحة للحصول على token و cookie
      const tokenReq = await axios.get("https://soundcloudmp3.org/", {
        headers: { 
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      const dom = tokenReq.data;
      const $ = cheerio.load(dom);
      const token = $("input[name='_token']").attr("value");
      
      if (!token) {
        throw new Error("فشل استخراج الـ token من الموقع");
      }

      const cookie = tokenReq.headers["set-cookie"];

      // 2️⃣ إعداد بيانات POST
      const config = {
        _token: token,
        lang: "en",
        url: url,
        submit: ""
      };

      console.log("🔄 إرسال طلب التحويل...");

      // 3️⃣ إرسال طلب التحويل
      const { data } = await axios.post(
        "https://soundcloudmp3.org/converter",
        new URLSearchParams(Object.entries(config)),
        {
          headers: {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Cookie": cookie?.join("; ") || "",
            "Referer": "https://soundcloudmp3.org/",
            "Origin": "https://soundcloudmp3.org",
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }
      );

      const $$ = cheerio.load(data);
      const result = {};

      // 4️⃣ استخراج معلومات الأغنية
      $$(".info > p").each((a, i) => {
        const name = $$(i).find("b").text();
        const key = $$(i).text().trim().replace(name, "").trim();
        result[name.split(":")[0].trim().toLowerCase()] = key;
      });

      result.thumbnail = $$(".info img").attr("src");
      result.download = $$("#ready-group a").attr("href");

      if (!result.download) {
        throw new Error("فشل استخراج رابط التحميل. قد يكون الرابط غير صالح أو الموقع محجوب.");
      }

      console.log("✅ رابط التحميل:", result.download);

      // 5️⃣ تحميل الصوت كـ Buffer
      const buffer = await axios.get(result.download, { 
        responseType: "arraybuffer",
        timeout: 30000, // 30 ثانية
        headers: {
          "user-agent": "Mozilla/5.0"
        }
      });
      
      result.buffer = Buffer.from(buffer.data);
      console.log(`✅ تم تحميل الصوت (${(result.buffer.length / 1024 / 1024).toFixed(2)} MB)`);

      return result;
    } catch (err) {
      // تفصيل الخطأ بدقة
      if (err.response) {
        console.error("❌ خطأ من السيرفر:", err.response.status, err.response.statusText);
        throw new Error(`خطأ من السيرفر: ${err.response.status}`);
      } else if (err.request) {
        console.error("❌ لم يتم استلام رد من السيرفر");
        throw new Error("فشل الاتصال بالسيرفر");
      } else {
        console.error("❌ خطأ:", err.message);
        throw new Error(err.message);
      }
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.includes("soundcloud.com")) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط SoundCloud مباشر مطلوب"
      });
    }

    console.log("📥 طلب جديد:", url);
    const sc = new SoundCloudAPI();
    const data = await sc.download(url);

    res.json({
      status: true,
      message: "✅ تم استخراج الصوت بنجاح",
      title: data.title || "SoundCloud Audio",
      thumbnail: data.thumbnail || null,
      base64: data.buffer.toString("base64")
    });
  } catch (err) {
    console.error("❌ خطأ في POST:", err.message);
    res.status(500).json({ status: false, message: err.message });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || !url.includes("soundcloud.com")) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط SoundCloud مباشر مطلوب"
      });
    }

    console.log("📥 طلب جديد (GET):", url);
    const sc = new SoundCloudAPI();
    const data = await sc.download(url);

    res.json({
      status: true,
      message: "✅ تم استخراج الصوت بنجاح",
      title: data.title || "SoundCloud Audio",
      thumbnail: data.thumbnail || null,
      base64: data.buffer.toString("base64")
    });
  } catch (err) {
    console.error("❌ خطأ في GET:", err.message);
    res.status(500).json({ status: false, message: err.message });
  }
});

export default router;
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

const router = express.Router();

class SoundCloudAPI {
  constructor() {
    // إنشاء jar للكوكيز لكل طلب
    this.jar = new CookieJar();
    this.client = wrapper(axios.create({
      jar: this.jar,
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500 // قبول أي استجابة أقل من 500
    }));
  }

  // توليد headers واقعية
  getBrowserHeaders(referer = null) {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0"
    };

    if (referer) {
      headers["Referer"] = referer;
      headers["Origin"] = "https://soundcloudmp3.org";
      headers["Sec-Fetch-Site"] = "same-origin";
    }

    return headers;
  }

  async download(url) {
    try {
      console.log("🔍 المرحلة 1: جلب الصفحة الرئيسية...");
      
      // 1️⃣ زيارة الصفحة الرئيسية أولاً
      const mainPage = await this.client.get("https://soundcloudmp3.org/", {
        headers: this.getBrowserHeaders()
      });

      if (mainPage.status === 403) {
        throw new Error("الموقع يحظر الطلبات. جرب استخدام Proxy أو VPN.");
      }

      const $ = cheerio.load(mainPage.data);
      const token = $("input[name='_token']").attr("value");
      
      if (!token) {
        console.error("❌ لم يتم العثور على token. HTML:", mainPage.data.substring(0, 500));
        throw new Error("فشل استخراج الـ token من الموقع");
      }

      console.log("✅ تم استخراج Token:", token.substring(0, 20) + "...");

      // 2️⃣ انتظار قصير (محاكاة المستخدم الحقيقي)
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

      console.log("🔄 المرحلة 2: إرسال طلب التحويل...");

      // 3️⃣ إرسال طلب التحويل
      const formData = new URLSearchParams({
        _token: token,
        lang: "en",
        url: url,
        submit: ""
      });

      const convertResponse = await this.client.post(
        "https://soundcloudmp3.org/converter",
        formData.toString(),
        {
          headers: {
            ...this.getBrowserHeaders("https://soundcloudmp3.org/"),
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest" // مهم جداً!
          }
        }
      );

      if (convertResponse.status === 403) {
        throw new Error("تم حظر طلب التحويل. الموقع يكتشف البوت.");
      }

      const $$ = cheerio.load(convertResponse.data);
      const result = {};

      // 4️⃣ استخراج معلومات الأغنية
      $$(".info > p").each((i, elem) => {
        const text = $$(elem).text().trim();
        const boldText = $$(elem).find("b").text();
        const key = boldText.split(":")[0].trim().toLowerCase();
        const value = text.replace(boldText, "").trim();
        if (key && value) {
          result[key] = value;
        }
      });

      result.thumbnail = $$(".info img").attr("src");
      result.download = $$("#ready-group a").attr("href");

      if (!result.download) {
        console.error("❌ لم يتم العثور على رابط التحميل. HTML:", convertResponse.data.substring(0, 500));
        throw new Error("فشل استخراج رابط التحميل. قد يكون الرابط غير صالح.");
      }

      console.log("✅ رابط التحميل:", result.download);

      // 5️⃣ انتظار قصير
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log("⬇️ المرحلة 3: تحميل الملف الصوتي...");

      // 6️⃣ تحميل الصوت
      const audioResponse = await this.client.get(result.download, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://soundcloudmp3.org/",
          "Accept": "audio/mpeg,audio/*;q=0.9,*/*;q=0.8"
        }
      });

      result.buffer = Buffer.from(audioResponse.data);
      console.log(`✅ تم تحميل الصوت (${(result.buffer.length / 1024 / 1024).toFixed(2)} MB)`);

      return result;
    } catch (err) {
      if (err.response) {
        console.error("❌ خطأ من السيرفر:", err.response.status, err.response.statusText);
        console.error("📄 Response data:", err.response.data?.toString().substring(0, 200));
        
        if (err.response.status === 403) {
          throw new Error("403 Forbidden: الموقع يحظر الطلبات. جرب استخدام Proxy.");
        }
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

    console.log("📥 طلب POST جديد:", url);
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

    console.log("📥 طلب GET جديد:", url);
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
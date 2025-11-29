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
        headers: { "user-agent": "Mozilla/5.0" }
      });

      const dom = tokenReq.data;
      const $ = cheerio.load(dom);
      const token = $("input").attr("value");
      const cookie = tokenReq.headers["set-cookie"];

      // 2️⃣ إعداد بيانات POST
      const config = {
        _token: token,
        lang: "en",
        url: url,
        submit: ""
      };

      // 3️⃣ إرسال طلب التحويل
      const { data } = await axios.post(
        "https://soundcloudmp3.org/converter",
        new URLSearchParams(Object.entries(config)),
        {
          headers: {
            "user-agent": "Mozilla/5.0",
            "Cookie": cookie,
            "Referer": "https://soundcloudmp3.org/",
            "Origin": "https://soundcloudmp3.org"
          }
        }
      );

      const $$ = cheerio.load(data);
      const result = {};

      // 4️⃣ استخراج معلومات الأغنية
      $$(" .info > p").each((a, i) => {
        const name = $$(i).find("b").text();
        const key = $$(i).text().trim().replace(name, "").trim();
        result[name.split(":")[0].trim().toLowerCase()] = key;
      });

      result.thumbnail = $$(".info img").attr("src");
      result.download = $$("#ready-group a").attr("href");

      // 5️⃣ تحميل الصوت كـ Buffer
      const buffer = await axios.get(result.download, { responseType: "arraybuffer" });
      result.buffer = Buffer.from(buffer.data);

      return result;
    } catch (err) {
      console.error(err);
      throw new Error("فشل تحميل الصوت من SoundCloud");
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

    const sc = new SoundCloudAPI();
    const data = await sc.download(url);

    res.json({
      status: true,
      message: "✅ تم استخراج الصوت بنجاح",
      title: data.title || "SoundCloud Audio",
      thumbnail: data.thumbnail || null,
      base64: data.buffer.toString("base64") // تحويل Base64 هنا فقط
    });
  } catch (err) {
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
    res.status(500).json({ status: false, message: err.message });
  }
});

export default router;
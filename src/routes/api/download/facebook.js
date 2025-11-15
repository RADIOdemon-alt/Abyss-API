import express from "express";
import axios from "axios";

const router = express.Router();

class FacebookDL {
  constructor(cookie = "", userAgent = "") {
    this.headers = {
      "sec-fetch-user": "?1",
      "sec-ch-ua-mobile": "?0",
      "sec-fetch-site": "none",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "cache-control": "max-age=0",
      authority: "www.facebook.com",
      "upgrade-insecure-requests": "1",
      "accept-language": "en-GB,en;q=0.9",
      "sec-ch-ua":
        '"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"',
      "user-agent":
        userAgent ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      cookie: cookie,
    };
  }

  parseString(str) {
    try {
      return JSON.parse(`{"t":"${str}"}`).t;
    } catch {
      return str;
    }
  }

  match(data, ...patterns) {
    for (const p of patterns) {
      const m = data.match(p);
      if (m) return m;
    }
    return null;
  }

  async fetchVideo(url) {
    if (!url || !url.trim())
      throw new Error("⚠️ يرجى إدخال رابط فيسبوك صالح.");

    if (!/(facebook.com|fb.watch)/.test(url))
      throw new Error("⚠️ الرابط غير تابع لفيسبوك.");

    const { data } = await axios.get(url, { headers: this.headers });

    const html = data.replace(/"/g, '"').replace(/&/g, "&");

    const sdUrl = this.match(
      html,
      /"browser_native_sd_url":"(.*?)"/,
      /sd_src\s*:\s*"([^"]*)"/
    )?.[1];

    const hdUrl = this.match(
      html,
      /"browser_native_hd_url":"(.*?)"/,
      /hd_src\s*:\s*"([^"]*)"/
    )?.[1];

    const title =
      this.match(html, /<meta\sname="description"\scontent="(.*?)"/)?.[1] ||
      "بدون عنوان";

    if (!sdUrl) throw new Error("⚠️ لا يمكن جلب الفيديو الآن، حاول لاحقاً.");

    return {
      status: true,
      url,
      title: this.parseString(title),
      quality: {
        sd: this.parseString(sdUrl),
        hd: this.parseString(hdUrl || ""),
      },
    };
  }
}

/* ===========================
 *       POST ROUTE
 * ===========================*/
router.post("/", async (req, res) => {
  try {
    const { url, cookie, userAgent } = req.body;

    if (!url)
      return res.status(400).json({
        status: false,
        message: "⚠️ مطلوب: رابط الفيديو (url)",
      });

    const fb = new FacebookDL(cookie, userAgent);
    const result = await fb.fetchVideo(url);

    res.json({
      status: true,
      message: "✅ تم استخراج الفيديو بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء استخراج الفيديو",
      error: err.message,
    });
  }
});

/* ===========================
 *        GET ROUTE
 * ===========================*/
router.get("/", async (req, res) => {
  try {
    const { url, cookie, userAgent } = req.query;

    if (!url)
      return res.status(400).json({
        status: false,
        message: "⚠️ مطلوب: رابط الفيديو (url)",
      });

    const fb = new FacebookDL(cookie, userAgent);
    const result = await fb.fetchVideo(url);

    res.json({
      status: true,
      message: "✅ تم استخراج الفيديو بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء استخراج الفيديو",
      error: err.message,
    });
  }
});

export default router;
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

/** 🎯 كلاس تحميل Pinterest */
class PinterestDownloader {
  constructor() {
    this.baseUrl = "https://snappin.app/";
    this.headers = {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://snappin.app",
      Origin: "https://snappin.app",
      "Content-Type": "application/json",
    };
  }

  /** 🔐 جلب التوكن والكوكيز */
  async getToken() {
    const { headers, data } = await axios.get(this.baseUrl);
    const cookies = headers["set-cookie"]?.map((c) => c.split(";")[0]).join("; ") || "";
    const $ = cheerio.load(data);
    const csrfToken = $('meta[name="csrf-token"]').attr("content");
    return { csrfToken, cookies };
  }

  /** 📦 تحميل من Snappin */
  async download(pinterestUrl) {
    try {
      const { csrfToken, cookies } = await this.getToken();

      const res = await axios.post(
        this.baseUrl,
        { url: pinterestUrl },
        {
          headers: {
            ...this.headers,
            "x-csrf-token": csrfToken,
            Cookie: cookies,
          },
        }
      );

      const $ = cheerio.load(res.data);
      const thumb = $("img").attr("src");

      const downloadLinks = $("a.button.is-success")
        .map((_, el) => $(el).attr("href"))
        .get();

      let videoUrl = null;
      let imageUrl = null;

      for (const link of downloadLinks) {
        const fullLink = link.startsWith("http") ? link : this.baseUrl + link;

        const head = await axios.head(fullLink).catch(() => null);
        const contentType = head?.headers?.["content-type"] || "";

        if (link.includes("/download-file/")) {
          if (contentType.includes("video")) {
            videoUrl = fullLink;
          } else if (contentType.includes("image")) {
            imageUrl = fullLink;
          }
        } else if (link.includes("/download-image/")) {
          imageUrl = fullLink;
        }
      }

      return {
        status: true,
        thumb,
        video: videoUrl,
        image: videoUrl ? null : imageUrl,
      };
    } catch (err) {
      return {
        status: false,
        message: err?.response?.data?.message || err.message || "خطأ غير معروف",
      };
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ يرجى إرسال رابط Pinterest (url)" });

    const pinterest = new PinterestDownloader();
    const result = await pinterest.download(url);

    if (!result.status)
      return res
        .status(500)
        .json({ status: false, message: "❌ فشل التحميل", error: result.message });

    res.json({
      status: true,
      message: "✅ تم التحميل بنجاح",
      thumb: result.thumb,
      video: result.video,
      image: result.image,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: false, message: "❌ خطأ في الخادم", error: err.message });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ يرجى إرسال رابط Pinterest (url)" });

    const pinterest = new PinterestDownloader();
    const result = await pinterest.download(url);

    if (!result.status)
      return res
        .status(500)
        .json({ status: false, message: "❌ فشل التحميل", error: result.message });

    res.json({
      status: true,
      message: "✅ تم التحميل بنجاح",
      thumb: result.thumb,
      video: result.video,
      image: result.image,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: false, message: "❌ خطأ في الخادم", error: err.message });
  }
});

export default router;
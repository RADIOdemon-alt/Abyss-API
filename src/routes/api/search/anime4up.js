import express from "express";
import axios from "axios";
import cheerio from "cheerio";

const router = express.Router();

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
};

/** 🔍 SEARCH ONLY */
router.get("/", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ كلمة البحث مطلوبة" });

    const url = `https://ww.anime4up.rest/?search_param=animes&s=${encodeURIComponent(
      q
    )}`;

    const { data } = await axios.get(url, { headers });

    const $ = cheerio.load(data);
    const su = cheerio.load($(".anime-grid").html() || "");

    const results = [];

    su(".anime-card-themex").each((_, el) => {
      results.push({
        title: su(el)
          .find(".anime-card-title h3 a")
          .text()
          .trim(),
        link: su(el)
          .find(".anime-card-title h3 a")
          .attr("href"),
        image: su(el)
          .find("img")
          .attr("data-image"),
        status: su(el)
          .find(".anime-card-status")
          .text()
          .trim(),
        type: su(el)
          .find(".anime-card-type")
          .text()
          .trim(),
      });
    });

    res.json({
      status: true,
      query: q,
      total: results.length,
      results,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "❌ فشل تنفيذ البحث",
      error: err.message,
    });
  }
});

export default router;
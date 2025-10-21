import express from "express";
import axios from "axios";
import cheerio from "cheerio";

const router = express.Router();

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";

const COMMON_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
  "X-Requested-With": "mark.via.gp",
};

function parseSetCookie(setCookieArray = []) {
  const jar = {};
  for (const s of setCookieArray) {
    try {
      const [pair] = s.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) {
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        jar[name] = value;
      }
    } catch {}
  }
  return jar;
}

function mergeJars(dest, src) {
  for (const k of Object.keys(src)) dest[k] = src[k];
}


function cookieHeaderFromJar(jar) {
  return Object.keys(jar)
    .map((k) => `${k}=${jar[k]}`)
    .join("; ");
}

async function waitForResult(jobId, cookieJar, maxTries = 15) {
  for (let i = 0; i < maxTries; i++) {
    const rres = await axios.get(
      `https://instag.com/api/result/?job_id=${encodeURIComponent(jobId)}`,
      {
        headers: {
          ...COMMON_HEADERS,
          Cookie: cookieHeaderFromJar(cookieJar),
        },
        timeout: 20000,
        validateStatus: (s) => s < 500,
      }
    );
    if (rres.status === 200 && rres.data && rres.data.loading !== true) {
      return rres.data;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

router.all("/", async (req, res) => {
  try {
    const url = req.query.url || req.body.url;
    if (!url)
      return res.status(400).json({
        status: false,
        message: "⚠️ يرجى إرسال رابط إنستاجرام صحيح مثل: ?url=https://www.instagram.com/p/xyz",
      });

    const urlMatch = url.match(/https?:\/\/(www\.)?instagram\.com\/[^\s]+/i);
    if (!urlMatch)
      return res.status(400).json({ status: false, message: "✘︙ضع رابط إنستاجرام صحيح." });

    const targetUrl = urlMatch[0];
    const cookieJar = {};

   
    const homeRes = await axios.get("https://instag.com/", {
      headers: { ...COMMON_HEADERS, Referer: "https://www.google.com/" },
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });

    mergeJars(cookieJar, parseSetCookie(homeRes.headers["set-cookie"] || []));
    const homeHtml = homeRes.data || "";

    let csrf = null;
    const m1 = homeHtml.match(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/i);
    if (m1) csrf = m1[1];
    if (!csrf && cookieJar.csrftoken) csrf = cookieJar.csrftoken;

    const params = new URLSearchParams();
    if (csrf) params.append("csrfmiddlewaretoken", csrf);
    params.append("url", targetUrl);

    const managerRes = await axios.post("https://instag.com/api/manager/", params.toString(), {
      headers: {
        ...COMMON_HEADERS,
        Referer: "https://instag.com/",
        Origin: "https://instag.com",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Cookie: cookieHeaderFromJar(cookieJar),
      },
      timeout: 20000,
      validateStatus: (s) => s < 500,
    });

    mergeJars(cookieJar, parseSetCookie(managerRes.headers["set-cookie"] || []));

    if (!managerRes.data)
      return res.status(500).json({ status: false, message: "⚠️ السيرفر رجع رد فاضي من /api/manager/" });

   
    let jobId = null;
    const data = managerRes.data;
    if (typeof data === "object") {
      jobId = data.job_id || (data.job_ids?.[0]?.job_id) || data.id || null;
    } else if (typeof data === "string") {
      const mj = data.match(/"job_id":"([^"]+)"/i);
      if (mj) jobId = mj[1];
    }

    if (!jobId)
      return res.status(500).json({
        status: false,
        message: "⚠️ لم أجد job_id",
        raw: data,
      });

   
    const resultData = await waitForResult(jobId, cookieJar, 15);
    if (!resultData)
      return res.status(408).json({ status: false, message: "⚠️ لم أجد نتيجة بعد الانتظار." });

   ا
    let mediaUrl = null;
    if (resultData.html) {
      const $ = cheerio.load(resultData.html);
      const proxy = $("a[href*='/proxy-image/']").first().attr("href");
      if (proxy) mediaUrl = "https://instag.com" + proxy;
      if (!mediaUrl) {
        const imgApi = $("a[href*='/api/image/']").first().attr("href");
        if (imgApi) mediaUrl = "https://instag.com" + imgApi;
      }
      if (!mediaUrl) {
        const link = $("a[href^='http']").first().attr("href");
        if (link) mediaUrl = link;
      }
    }

    if (!mediaUrl)
      return res.status(404).json({
        status: false,
        message: "⚠️ لا يوجد رابط ميديا.",
        raw: resultData,
      });

    const fileRes = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": USER_AGENT,
        Referer: "https://www.instagram.com/",
      },
      timeout: 30000,
    });

    const buf = Buffer.from(fileRes.data);
    const base64 = buf.toString("base64");
    const type = fileRes.headers["content-type"] || "";

    res.status(200).json({
      status: true,
      message: "✅ تم جلب ميديا إنستجرام بنجاح",
      media_type: type.startsWith("video") ? "video" : "image",
      source_url: targetUrl,
      download_url: mediaUrl,
      base64: `data:${type};base64,${base64}`,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "❌ خطأ غير متوقع",
      error: err?.message || err,
    });
  }
});

export default router;

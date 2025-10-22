import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const COMMON_HEADERS = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "ar,en;q=0.9",
  "X-Requested-With": "XMLHttpRequest",
  "Referer": "https://www.instagram.com/",
  "Origin": "https://www.instagram.com",
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

async function waitForResult(jobId, cookieJar, maxTries = 20) {
  for (let i = 0; i < maxTries; i++) {
    try {
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
    } catch (err) {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

async function fetchInstaMedia(url) {
  if (!url) throw new Error("الرابط غير صالح");

  const urlMatch = url.match(/https?:\/\/(www\.)?instagram\.com\/[^\s]+/i);
  if (!urlMatch) throw new Error("ضع رابط إنستاجرام صحيح");

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
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: cookieHeaderFromJar(cookieJar),
    },
    timeout: 20000,
    validateStatus: (s) => s < 500,
  });

  mergeJars(cookieJar, parseSetCookie(managerRes.headers["set-cookie"] || []));

  const data = managerRes.data;
  let jobId = null;
  if (typeof data === "object") jobId = data.job_id || (data.job_ids?.[0]?.job_id) || data.id;
  else if (typeof data === "string") {
    const mj = data.match(/"job_id":"([^"]+)"/i);
    if (mj) jobId = mj[1];
  }
  if (!jobId) throw new Error("لم أجد job_id");

  const resultData = await waitForResult(jobId, cookieJar, 20);
  if (!resultData) throw new Error("لم أجد نتيجة بعد الانتظار");

  let mediaUrl = null;
  if (resultData.html) {
    const $ = cheerio.load(resultData.html);
    const proxy = $("a[href*='/proxy-image/']").first().attr("href");
    if (proxy) mediaUrl = "https://instag.com" + proxy;
    else {
      const imgApi = $("a[href*='/api/image/']").first().attr("href");
      if (imgApi) mediaUrl = "https://instag.com" + imgApi;
    }
    if (!mediaUrl) {
      const link = $("a[href^='http']").first().attr("href");
      if (link) mediaUrl = link;
    }
  }
  if (!mediaUrl) throw new Error("لا يوجد رابط ميديا");

  return {
    status: true,
    message: "تم جلب ميديا إنستجرام بنجاح",
    source_url: targetUrl,
    download_url: mediaUrl,
  };
}

// **GET فقط**
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ status: false, error: "يرجى إدخال الرابط." });

    const result = await fetchInstaMedia(url);
    res.json({
      status: true,
      creator: "Dark-Team",
      data: result,
    });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

export default router;

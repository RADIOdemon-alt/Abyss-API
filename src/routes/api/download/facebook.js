baseHeaders express from "express";
import axios from "axios";

const router = express.Router();

/** 📺 كلاس لتحميل فيديوهات فيسبوك */
class FacebookDownloader {
  constructor() {
    this.baseHeaders = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-site": "same-origin",
    };
  }

  /** 🧩 جلب الفيديو من رابط */
  async getVideo(url) {
    if (!url || !url.includes("https://"))
      throw new Error("رابط فيسبوك غير صالح أو مفقود");

    // 🔹 الخطوة 1: محاولة استخراج videoId
    const fr = await axios.head(url, { headers: this.baseHeaders });
    const linkHeader = fr.headers["link"];
    const match = linkHeader ? linkHeader.match(/\/(\d+)\/>;/) : null;
    const videoId = match ? match[1] : null;

    if (!videoId)
      throw new Error(
        "تعذر استخراج معرف الفيديو. الرابط قد يكون خاصًا أو غير صالح."
      );

    // 🔹 الخطوة 2: تحضير بيانات GraphQL
    const body_obj = {
      caller: "TAHOE",
      entityNumber: 5,
      feedbackSource: 41,
      feedLocation: "TAHOE",
      focusCommentID: null,
      isCrawler: false,
      isLoggedOut: true,
      privacySelectorRenderLocation: "COMET_STREAM",
      renderLocation: "video_home",
      scale: 1,
      useDefaultActor: false,
      videoID: videoId,
      videoIDStr: videoId,
      __relay_internal__pv__CometUFIShareActionMigrationrelayprovider: true,
      __relay_internal__pv__GHLShouldChangeSponsoredDataFieldNamerelayprovider: false,
      __relay_internal__pv__IsWorkUserrelayprovider: false,
    };

    const body = new URLSearchParams({
      variables: JSON.stringify(body_obj),
      doc_id: "23880857301547365",
    });

    // 🔹 الخطوة 3: إرسال الطلب إلى Facebook GraphQL
    const res = await axios.post(
      "https://www.facebook.com/api/graphql/",
      body.toString(),
      { headers: this.baseHeaders }
    );

    const text = res.data;
    const json =
      typeof text === "string" ? JSON.parse(text.split("\n")[0]) : text;

    const media = json?.data?.video?.story?.attachments?.[0]?.media;
    if (!media)
      throw new Error("تعذر العثور على بيانات الفيديو من استجابة فيسبوك.");

    // 🔹 استخراج البيانات
    return {
      sdUrl: media.videoDeliveryLegacyFields?.browser_native_sd_url || null,
      hdUrl: media.videoDeliveryLegacyFields?.browser_native_hd_url || null,
      audioUrl:
        json?.extensions?.all_video_dash_prefetch_representations?.[0]
          ?.representations?.[2]?.base_url || null,
      thumbnailUrl: media.preferred_thumbnail?.image?.uri || null,
      sprites:
        media?.video_player_scrubber_preview_renderer?.video
          ?.scrubber_preview_thumbnail_information?.sprite_uris || null,
      permalinkUrl: media.permalink_url || url,
      publishTime: media.publish_time || null,
      durationInMs: media.playable_duration_in_ms || null,
    };
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ الرابط مطلوب (url)" });

    const fb = new FacebookDownloader();
    const data = await fb.getVideo(url);

    res.json({
      status: true,
      message: "✅ تم جلب بيانات الفيديو بنجاح",
      video: data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحميل الفيديو",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url)
      return res
        .status(400)
        .json({ status: false, message: "⚠️ الرابط مطلوب (url)" });

    const fb = new FacebookDownloader();
    const data = await fb.getVideo(url);

    res.json({
      status: true,
      message: "✅ تم جلب بيانات الفيديو بنجاح",
      video: data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحميل الفيديو",
      error: err.message,
    });
  }
});

export default router;

import express from "express";
const router = express.Router();

/*
──────────────────────────────
💀 Base64 Decoder API 💀
👤 Developer: DARK TEAM
📦 Description:
   API لفك أكواد Base64 سواء كانت صور، ملفات، نصوص، أو صوتيات.
   يدعم:
   • الصور (png, jpg, webp)
   • الصوتيات (mp3, wav)
   • الفيديوهات (mp4, webm)
   • النصوص العادية
   • أي نوع ملف آخر بشكل تلقائي
──────────────────────────────
*/

router.get("/", async (req, res) => {
  res.json({
    status: true,
    creator: "DARK TEAM",
    info: {
      description: "API لفك أكواد Base64 سواء صور أو نصوص أو ملفات.",
      usage: {
        GET: "/api/decode?base=<كود_base64>",
        POST: "/api/decode (Body JSON: { base: <كود_base64> })",
      },
      example_image: "/api/decode?base=data:image/png;base64,AAAFBfj42Pj4",
      example_text: "/api/decode?base=SGVsbG8gV29ybGQh",
    },
  });
});

router.get("/", async (req, res) => {
  const { base } = req.query;
  if (!base)
    return res.status(400).json({
      status: false,
      message: "❌ أرسل كود Base64 في البراميتر ?base=",
    });

  return decodeBase(base, res);
});

router.post("/", express.json(), async (req, res) => {
  const { base } = req.body;
  if (!base)
    return res.status(400).json({
      status: false,
      message: "❌ أرسل كود Base64 داخل الـ body بصيغة JSON (مثال: { base: \"...\" })",
    });

  return decodeBase(base, res);
});

async function decodeBase(base, res) {
  try {
    let mimeType = "application/octet-stream";
    const match = base.match(/^data:([\w\/\-\+\.]+);base64,/);
    if (match) mimeType = match[1];

    const cleaned = base.replace(/^data:[\w\/\-\+\.]+;base64,/, "");
    const buffer = Buffer.from(cleaned, "base64");

    const isText =
      /^[A-Za-z0-9+\/=]+$/.test(cleaned) &&
      buffer.toString("utf8").match(/^[\x00-\x7F]*$/);

    if (isText && mimeType === "application/octet-stream") {
      return res.status(200).json({
        status: true,
        type: "text",
        result: buffer.toString("utf8"),
        creator: "DARK TEAM",
      });
    }

    res.writeHead(200, {
      "Content-Type": mimeType,
      "Content-Length": buffer.length,
      "Content-Disposition": `inline; filename="decoded.${mimeType.split("/")[1] || "bin"}"`,
    });
    res.end(buffer);
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "⚠️ خطأ أثناء فك الكود Base64",
      error: err.message,
      creator: "DARK TEAM",
    });
  }
}

export default router;
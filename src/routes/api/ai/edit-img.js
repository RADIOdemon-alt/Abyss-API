import express from "express";
import axios from "axios";
import crypto from "crypto";

const router = express.Router();

class DeepFakeAPI {
  constructor() {
    this.baseURL = "https://apiv1.deepfakemaker.io/api";
    this.headers = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Android 15; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0",
      "Referer": "https://deepfakemaker.io/nano-banana-ai/"
    };
    this.publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDa2oPxMZe71V4dw2r8rHWt59gH
W5INRmlhepe6GUanrHykqKdlIB4kcJiu8dHC/FJeppOXVoKz82pvwZCmSUrF/1yr
rnmUDjqUefDu8myjhcbio6CnG5TtQfwN2pz3g6yHkLgp8cFfyPSWwyOCMMMsTU9s
snOjvdDb4wiZI8x3UwIDAQAB
-----END PUBLIC KEY-----`;
    this.secretString = "NHGNy5YFz7HeFb";
    this.appId = "ai_df";
  }

  aesEncrypt(data, key, iv) {
    const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(key), Buffer.from(iv));
    let encrypted = cipher.update(data, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  }

  generateRandomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const randomBytes = crypto.randomBytes(length);
    return Array.from(randomBytes, b => chars[b % chars.length]).join("");
  }

  generateAuth() {
    const t = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID();
    const tempAesKey = this.generateRandomString(16);
    const encryptedData = crypto.publicEncrypt(
      { key: this.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(tempAesKey)
    );
    const secret_key = encryptedData.toString("base64");
    const sign = this.aesEncrypt(
      `${this.appId}:${this.secretString}:${t}:${nonce}:${secret_key}`,
      tempAesKey,
      tempAesKey
    );
    return { app_id: this.appId, t, nonce, sign, secret_key };
  }

  async getImageBuffer(imageUrl) {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
  }

  async generateImage({ imageUrl, prompt }) {
    if (!imageUrl || !prompt) {
      throw new Error("imageUrl and prompt are required");
    }

    const authData = this.generateAuth();
    const userId = this.generateRandomString(64).toLowerCase();

    const instance = axios.create({
      baseURL: this.baseURL,
      params: authData,
      headers: this.headers
    });

    const buffer = await this.getImageBuffer(imageUrl);

    // 1️⃣ طلب توقيع رفع الصورة
    const file = await instance.post("/user/v2/upload-sign", {
      filename: this.generateRandomString(32) + "_" + Date.now() + ".jpg",
      hash: crypto.createHash("sha256").update(buffer).digest("hex"),
      user_id: userId
    }).then(r => r.data);

    // 2️⃣ رفع الصورة إلى الرابط الموقع
    await axios.put(file.data.url, buffer, {
      headers: { 
        "content-type": "image/jpeg", 
        "content-length": buffer.length 
      }
    });

    // 3️⃣ إنشاء مهمة التحويل
    const task = await instance.post("/replicate/v1/free/nano/banana/task", {
      prompt,
      platform: "nano_banana",
      images: [`https://cdn.deepfakemaker.io/${file.data.object_name}`],
      output_format: "png",
      user_id: userId
    }).then(r => r.data);

    // 4️⃣ متابعة التقدم
    let resultUrl = null;
    for (let i = 0; i < 20; i++) {
      const check = await instance.get("/replicate/v1/free/nano/banana/task", {
        params: { user_id: userId, ...task.data }
      }).then(r => r.data);

      if (check.msg === "success" && check.data.generate_url) {
        resultUrl = check.data.generate_url;
        break;
      }
      await new Promise(r => setTimeout(r, 2500));
    }

    return resultUrl;
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { imageUrl, prompt } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط الصورة مطلوب (imageUrl)" 
      });
    }

    if (!prompt) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الوصف مطلوب (prompt)" 
      });
    }

    const deepfake = new DeepFakeAPI();
    const resultUrl = await deepfake.generateImage({ imageUrl, prompt });

    if (!resultUrl) {
      return res.status(500).json({ 
        status: false, 
        message: "❌ فشل في الحصول على النتيجة" 
      });
    }

    res.json({ 
      status: true, 
      message: "✅ تم تعديل الصورة بنجاح", 
      result: resultUrl,
      prompt 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء تعديل الصورة", 
      error: err.message 
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { imageUrl, prompt } = req.query;

    if (!imageUrl) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط الصورة مطلوب (imageUrl)" 
      });
    }

    if (!prompt) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الوصف مطلوب (prompt)" 
      });
    }

    const deepfake = new DeepFakeAPI();
    const resultUrl = await deepfake.generateImage({ imageUrl, prompt });

    if (!resultUrl) {
      return res.status(500).json({ 
        status: false, 
        message: "❌ فشل في الحصول على النتيجة" 
      });
    }

    res.json({ 
      status: true, 
      message: "✅ تم تعديل الصورة بنجاح", 
      result: resultUrl,
      prompt 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء تعديل الصورة", 
      error: err.message 
    });
  }
});

export default router;
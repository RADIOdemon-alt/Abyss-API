import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

const FIXED_PROMPT = `Create a 1/7 scale figure from the uploaded image, using a realistic style and environment. The figure is placed on a wooden desk with soft lighting, standing on a transparent acrylic base with no text. Add a BANDAI-style box nearby showing the figure art, and display a wireframe modeling view on the computer screen behind it.`;

// ===== المصدر الأول: PhotoEditorAI =====
async function createJob(imageUrl, prompt) {
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(imageResponse.data);
  
  const form = new FormData();
  form.append('model_name', 'seedream');
  form.append('edit_type', 'style_transfer');
  form.append('prompt', prompt);
  form.append('target_images', buffer, { filename: 'image.jpg' });

  const res = await axios.post(
    'https://api.photoeditorai.io/pe/photo-editor/create-job',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Product-Code': '067003',
        'Product-Serial': 'vj6o8n'
      },
      timeout: 30000
    }
  );
  return res.data.result.job_id;
}

async function getJobStatus(jobId) {
  const res = await axios.get(
    `https://api.photoeditorai.io/pe/photo-editor/get-job/${jobId}`,
    {
      headers: {
        'Product-Code': '067003',
        'Product-Serial': 'vj6o8n'
      },
      timeout: 10000
    }
  );
  return res.data.result;
}

async function photoEditorAI(imageUrl, prompt) {
  try {
    const jobId = await createJob(imageUrl, prompt);
    let result;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      result = await getJobStatus(jobId);
      if (result.status === 2 && result.output && result.output.length > 0) {
        return result.output[0];
      }
      await new Promise(r => setTimeout(r, 3000));
      attempts++;
    }
    
    throw new Error('Timeout waiting for job completion');
  } catch (err) {
    throw new Error(`PhotoEditorAI: ${err.message}`);
  }
}

// ===== المصدر الثاني: Nano Banana =====
async function nanoBanana(imageUrl, prompt) {
  try {
    const apiUrl = `https://dark-v2-api.vercel.app/api/v1/ai/nano_banana`;
    
    const res = await axios.get(apiUrl, {
      params: {
        prompt: prompt,
        imageUrl: imageUrl
      },
      headers: {
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 90000
    });

    if (!res.data || !res.data.status || !res.data.imageUrl) {
      throw new Error(res.data?.message || "Invalid response");
    }

    return res.data.imageUrl;
  } catch (err) {
    throw new Error(`Nano Banana: ${err.message}`);
  }
}

// ===== المصدر الثالث: Ghibli Proxy =====
async function gptimage(prompt, imageUrl) {
  try {
    if (!prompt) throw new Error('Prompt is required.');
    if (!imageUrl) throw new Error('Image URL is required.');

    // تحميل الصورة وتحويلها لـ base64
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(imageResponse.data).toString('base64');

    const { data } = await axios.post(
      'https://ghibli-proxy.netlify.app/.netlify/functions/ghibli-proxy',
      {
        image: 'data:image/png;base64,' + base64Image,
        prompt: prompt,
        model: 'gpt-image-1',
        n: 1,
        size: 'auto',
        quality: 'low'
      },
      {
        headers: {
          origin: 'https://overchat.ai',
          referer: 'https://overchat.ai/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
        },
        timeout: 60000
      }
    );

    const result = data?.data?.[0]?.b64_json;
    if (!result) throw new Error('No result found.');

    // تحويل base64 إلى رابط مؤقت أو إرجاعه مباشرة
    return `data:image/png;base64,${result}`;
  } catch (error) {
    throw new Error(`ghibli-proxy: ${error.message}`);
  }
}

// ===== الدالة الرئيسية للمعالجة =====
async function processFigure3D(imageUrl, customPrompt = null) {
  const prompt = customPrompt || FIXED_PROMPT;
  let resultUrl = null;
  let successSource = null;
  const errors = [];

  // المحاولة مع المصادر بالترتيب
  const sources = [
    { name: 'PhotoEditorAI', fn: () => photoEditorAI(imageUrl, prompt) },
    { name: 'Nano Banana', fn: () => nanoBanana(imageUrl, prompt) },
    { name: 'Ghibli Proxy', fn: () => gptimage(prompt, imageUrl) }
  ];

  for (const source of sources) {
    try {
      console.log(`Trying ${source.name}...`);
      resultUrl = await source.fn();
      successSource = source.name;
      break;
    } catch (error) {
      console.error(`${source.name} failed:`, error.message);
      errors.push({ source: source.name, error: error.message });
      continue;
    }
  }

  if (!resultUrl) {
    throw new Error('جميع المصادر فشلت');
  }

  return { resultUrl, successSource, errors };
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

    const result = await processFigure3D(imageUrl, prompt);

    res.json({ 
      status: true, 
      message: "✅ تم إنشاء المجسم بنجاح", 
      imageUrl: result.resultUrl,
      source: result.successSource,
      failedAttempts: result.errors.length > 0 ? result.errors : undefined
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء إنشاء المجسم", 
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

    const result = await processFigure3D(imageUrl, prompt);

    res.json({ 
      status: true, 
      message: "✅ تم إنشاء المجسم بنجاح", 
      imageUrl: result.resultUrl,
      source: result.successSource,
      failedAttempts: result.errors.length > 0 ? result.errors : undefined
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء إنشاء المجسم", 
      error: err.message 
    });
  }
});

export default router;
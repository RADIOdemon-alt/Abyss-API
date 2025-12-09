import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

const FIXED_PROMPT = `Create a 1/7 scale figure from the uploaded image, using a realistic style and environment. The figure is placed on a wooden desk with soft lighting, standing on a transparent acrylic base with no text. Add a BANDAI-style box nearby showing the figure art, and display a wireframe modeling view on the computer screen behind it.`;

// ===== المصدر الأول: PhotoEditorAI =====
async function createJob(buffer, prompt) {
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

async function downloadFile(url) {
  const response = await axios.get(url, { 
    responseType: 'arraybuffer',
    timeout: 30000
  });
  return Buffer.from(response.data);
}

async function photoEditorAI(buffer, prompt) {
  try {
    const jobId = await createJob(buffer, prompt);
    let result;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      result = await getJobStatus(jobId);
      if (result.status === 2 && result.output && result.output.length > 0) {
        const imageBuffer = await downloadFile(result.output[0]);
        return imageBuffer;
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
async function uploadToCatbox(buffer) {
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", buffer, {
      filename: "image.jpg",
      contentType: "image/jpeg"
    });

    const response = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: { ...form.getHeaders() },
      timeout: 30000
    });

    if (response.data && typeof response.data === "string" && response.data.startsWith("http")) {
      return response.data.trim();
    }
    
    throw new Error('Invalid Catbox response');
  } catch (error) {
    throw new Error(`Catbox upload: ${error.message}`);
  }
}

async function nanoBanana(buffer, prompt) {
  try {
    const imageUrl = await uploadToCatbox(buffer);
    
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

    const imageBuffer = await downloadFile(res.data.imageUrl);
    return imageBuffer;
  } catch (err) {
    throw new Error(`Nano Banana: ${err.message}`);
  }
}

// ===== المصدر الثالث: ghibli-proxy =====
async function gptimage(prompt, imageBuffer) {
  try {
    if (!prompt) throw new Error('Prompt is required.');
    if (!Buffer.isBuffer(imageBuffer)) throw new Error('Image must be a buffer.');

    const { data } = await axios.post(
      'https://ghibli-proxy.netlify.app/.netlify/functions/ghibli-proxy',
      {
        image: 'data:image/png;base64,' + imageBuffer.toString('base64'),
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

    return Buffer.from(result, 'base64');
  } catch (error) {
    throw new Error(`ghibli-proxy: ${error.message}`);
  }
}

// ===== دالة مساعدة لتحويل URL أو base64 إلى Buffer =====
async function getImageBuffer(imageInput) {
  if (Buffer.isBuffer(imageInput)) {
    return imageInput;
  }
  
  // إذا كان رابط URL
  if (typeof imageInput === 'string' && imageInput.startsWith('http')) {
    const response = await axios.get(imageInput, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }
  
  // إذا كان base64
  if (typeof imageInput === 'string' && imageInput.includes('base64,')) {
    const base64Data = imageInput.split('base64,')[1];
    return Buffer.from(base64Data, 'base64');
  }
  
  // إذا كان base64 مباشر
  if (typeof imageInput === 'string') {
    return Buffer.from(imageInput, 'base64');
  }
  
  throw new Error('Invalid image input format');
}

// ===== معالج المصادر الرئيسي =====
async function processFigure3D(imageInput, customPrompt = null) {
  const prompt = customPrompt || FIXED_PROMPT;
  const imageBuffer = await getImageBuffer(imageInput);
  
  let resultBuffer = null;
  let successSource = null;
  const errors = [];

  const sources = [
    { name: 'PhotoEditorAI', fn: () => photoEditorAI(imageBuffer, prompt) },
    { name: 'Nano Banana', fn: () => nanoBanana(imageBuffer, prompt) },
    { name: 'Ghibli Proxy', fn: () => gptimage(prompt, imageBuffer) }
  ];

  for (const source of sources) {
    try {
      console.log(`🔄 Trying ${source.name}...`);
      resultBuffer = await source.fn();
      successSource = source.name;
      console.log(`✅ ${source.name} succeeded!`);
      break;
    } catch (error) {
      console.error(`❌ ${source.name} failed:`, error.message);
      errors.push({ source: source.name, error: error.message });
      continue;
    }
  }

  if (!resultBuffer) {
    throw new Error('All sources failed: ' + JSON.stringify(errors));
  }

  return {
    buffer: resultBuffer,
    source: successSource,
    base64: resultBuffer.toString('base64')
  };
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { image, prompt } = req.body;
    
    if (!image) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الصورة مطلوبة (image as URL or base64)" 
      });
    }

    console.log('📸 Processing image...');
    const result = await processFigure3D(image, prompt);

    res.json({ 
      status: true, 
      message: "✅ تم إنشاء المجسم بنجاح",
      source: result.source,
      image: `data:image/png;base64,${result.base64}`
    });

  } catch (err) {
    console.error('❌ Error:', err);
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
    const { image, prompt } = req.query;
    
    if (!image) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الصورة مطلوبة (image as URL or base64)" 
      });
    }

    console.log('📸 Processing image...');
    const result = await processFigure3D(image, prompt);

    res.json({ 
      status: true, 
      message: "✅ تم إنشاء المجسم بنجاح",
      source: result.source,
      image: `data:image/png;base64,${result.base64}`
    });

  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء إنشاء المجسم", 
      error: err.message 
    });
  }
});

export default router;
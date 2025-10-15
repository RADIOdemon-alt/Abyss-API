import express from 'express'
import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const router = express.Router()

// 🎙️ خريطة الأصوات المدعومة
const voices = {
  'ادم': 'pNInz6obpgDQGcFmaJgB',
  'بيلا': 'EXAVITQu4vr4xnSDxMaL',
  'جوش': 'TxGEqnHWrfWFTfGW9XjX',
  'ريتشيل': '21m00Tcm4TlvDq8ikWAM',
  'كلايد': '2EiwWnXFnvU5JabPnv8n',
  'دومي': 'AZnzlk1XvdvUeBnXmlld',
  'جوزفين': 'Xb7hH8MSUJpSbSDYk0k2',
  'سارة': 'EXAVITQu4vr4xnSDxMaL',
  'كالوم': 'N2lVS1w4EtoT3dr4eOWO',
  'جورج': 'JBFqnCBsd6RMkjVDRZzb',
  'باتريك': 'ODq5zmih8GrVes37Dizd',
  'كريس': 'ZQe5CZNOzWyzPSCn5a3c',
  'ماتيلدا': 'Xb7hH8MSUJpSbSDYk0k2',
  'دانيال': 'onwK4e9ZLuTAKqWW03F9',
  'ريفر': 'VR6AewLTigWG4xSOukaG',
  'بيل': 'pqHfZKP75CvOlQylNhV4',
  'تشارلي': 'iP95p4xoKVk53GoZ742B',
  'كالم': 'N2lVS1w4EtoT3dr4eOWO'
}

// 🧠 كلاس Squinty ElevenLabs
class ElevenLabs {
  constructor() {
    this.ins = axios.create({
      baseURL: 'https://tts1.squinty.art/api/v1',
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'user-agent': 'NX/1.0.0'
      }
    })
  }

  genLogin() {
    const randHex = (l) => crypto.randomUUID().replace(/-/g, '').slice(0, l)
    const randNum = (d) => String(Math.floor(Math.random() * 10 ** d)).padStart(d, '0')
    const getRand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
    const b = getRand(0, 4)

    const [devices, country, lang, zone, ...nn] = [
      ['Samsung Galaxy S25 Ultra', 'Google Pixel 10', 'OnePlus 13', 'Xiaomi 15 Ultra', 'Oppo Find X8 Pro'],
      ['ID', 'VN', 'PH', 'MM', 'JP'],
      ['id', 'vi', 'en', 'my', 'jp'],
      ['Asia/Jakarta', 'Asia/Ho_Chi_Minh', 'Asia/Manila', 'Asia/Yangon', 'Asia/Tokyo'],
      ['Hiro', 'Yuki', 'Sora', 'Riku', 'Kaito'],
      ['Tanaka', 'Sato', 'Nakamura', 'Kobayashi', 'Yamamoto']
    ]

    const [fn, ln] = nn.map((z) => z[Math.floor(Math.random() * z.length)])

    return {
      build: '14',
      country: country[b],
      deviceId: randHex(16),
      deviceModel: `${devices[getRand(0, devices.length - 1)]}`,
      displayName: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}${randNum(4)}${randHex(4)}@gmail.com`,
      googleAccountId: randNum(18),
      language: lang[b],
      osVersion: String(26 + Math.floor(Math.random() * 4)),
      platform: 'android',
      timeZone: zone[b],
      version: '1.1.4'
    }
  }

  async login() {
    const z = await this.ins.post('/login/login', this.genLogin())
    this.ins.defaults.headers.common.authorization = 'Bearer ' + z.data.token
  }

  async create({ text, id, model, exaggeration = '50', clarity = '50', stability = '50' }) {
    const { data } = await this.ins.post('/generate/generate', {
      text: text || 'hello world',
      voiceId: id || '2EiwWnXFnvU5JabPnv8n',
      modelId: model || 'eleven_turbo_v2_5',
      styleExaggeration: exaggeration,
      claritySimilarityBoost: clarity,
      stability
    })
    return data
  }
}

// 🎧 عرض قائمة الأصوات
router.get('/voices', async (req, res) => {
  try {
    const list = Object.entries(voices).map(([name, id]) => ({
      name,
      voiceId: id,
      example: `/api/elevenlabs/speak?voice=${encodeURIComponent(name)}&text=مرحبا`
    }))
    res.json({ status: true, count: list.length, voices: list })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// 🔊 إنشاء الصوت
router.get('/speak', async (req, res) => {
  try {
    const { voice, text } = req.query
    if (!voice || !text)
      return res.status(400).json({ status: false, message: 'يرجى إدخال الصوت والنص ?voice=xxx&text=xxx' })

    const voiceId = voices[voice]
    if (!voiceId)
      return res.status(404).json({ status: false, message: 'الصوت غير موجود، استخدم /api/elevenlabs/voices' })

    const eleven = new ElevenLabs()
    await eleven.login()
    const data = await eleven.create({ text, id: voiceId })

    if (!data?.url) throw new Error('لم يتم استلام رابط الصوت من الخادم.')

    const audioRes = await axios.get(data.url, { responseType: 'arraybuffer' })
    const tmp = path.join(process.cwd(), `tts_${Date.now()}.mp3`)
    fs.writeFileSync(tmp, audioRes.data)

    const base64 = `data:audio/mpeg;base64,${Buffer.from(audioRes.data).toString('base64')}`
    fs.unlinkSync(tmp)

    res.json({ status: true, voice, text, url: data.url, base64 })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

export default router
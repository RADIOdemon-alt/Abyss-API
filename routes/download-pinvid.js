import express from 'express'
import axios from 'axios'

const router = express.Router()

const base = "https://www.pinterest.com"
const searchEndpoint = "/resource/BaseSearchResource/get/"
const downloaderAPI = "https://pinterestdownloader.io/frontendService/DownloaderService"

const headers = {
  accept: 'application/json, text/javascript, */*, q=0.01',
  referer: 'https://www.pinterest.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'x-app-version': 'a9522f',
  'x-pinterest-appstate': 'active',
  'x-pinterest-pws-handler': 'www/[username]/[slug].js',
  'x-requested-with': 'XMLHttpRequest'
}

// 🧩 جلب الكوكيز
async function getCookies() {
  try {
    const res = await axios.get(base, { headers })
    const set = res.headers['set-cookie']
    if (set) return set.map(s => s.split(';')[0].trim()).join('; ')
    return null
  } catch {
    return null
  }
}

// 🧩 فحص الروابط داخل الكائن
function findAllUrls(obj, acc = new Set()) {
  if (!obj) return acc
  if (typeof obj === 'string') {
    const s = obj.trim()
    if (s.startsWith('http://') || s.startsWith('https://')) acc.add(s)
    return acc
  }
  if (Array.isArray(obj)) for (const it of obj) findAllUrls(it, acc)
  if (typeof obj === 'object') for (const k of Object.keys(obj)) findAllUrls(obj[k], acc)
  return acc
}

// 🧩 فلترة الروابط الخاصة بـ Pinterest
function looksLikePinterestHosted(u) {
  if (!u) return false
  const l = u.toLowerCase()
  if (l.includes('pinimg') || l.includes('akamaized') || l.includes('cdn')) return true
  if (l.endsWith('.mp4') || l.endsWith('.mov') || l.includes('.m3u8')) return true
  return false
}

// 🧩 البحث في Pinterest
async function searchPinterestVideos(query) {
  if (!query) return { status: false, message: "⚠️ يرجى كتابة كلمة للبحث!" }
  try {
    const cookies = await getCookies()
    if (!cookies) return { status: false, message: "⚠️ فشل في الحصول على الكوكيز." }

    const params = {
      source_url: `/search/videos/?q=${encodeURIComponent(query)}`,
      data: JSON.stringify({
        options: { isPrefetch: false, query, scope: "videos", bookmarks: [""], page_size: 20 },
        context: {}
      }),
      _: Date.now()
    }

    const { data } = await axios.get(`${base}${searchEndpoint}`, { headers: { ...headers, cookie: cookies }, params })
    const rawResults = data?.resource_response?.data?.results || []

    const results = rawResults.filter(r => Array.from(findAllUrls(r)).length > 0)
    if (!results.length) return { status: false, message: `❌ لم يتم العثور على فيديوهات لكلمة: *${query}*` }

    const pins = results.map(result => {
      const urls = Array.from(findAllUrls(result))
      const pinterest = urls.filter(u => looksLikePinterestHosted(u))
      const external = urls.filter(u => !pinterest.includes(u))
      const id = result.id || result.grid_pin_data?.id || null
      return {
        id,
        title: result.title || result.description || "— بدون عنوان —",
        description: result.description || "— لا يوجد وصف —",
        pin_url: id ? `https://pinterest.com/pin/${id}` : (result.link || result.domain || ''),
        video_local: pinterest[0] || null,
        video_external: external[0] || null
      }
    }).filter(p => p.id)

    return { status: true, pins }
  } catch (e) {
    return { status: false, message: "❌ حدث خطأ أثناء البحث.", error: e.message }
  }
}

// 🧩 تنزيل الفيديو من API خارجي
async function pindl(url) {
  const cfg = {
    params: { url },
    timeout: 30000,
    headers: {
      referer: 'https://www.pinterest.com',
      origin: 'https://www.pinterest.com',
      'user-agent': headers['user-agent']
    }
  }
  const { data } = await axios.get(downloaderAPI, cfg)
  if (!data || !data.medias) throw new Error('❌ رد غير صالح من الخادم.')
  return data
}

// 🧩 حجم الملف
function formatSize(bytes) {
  if (!bytes) return "—"
  if (bytes === 0) return "0 B"
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}

// ✅ POST /api/pinterestvideo
router.post('/', async (req, res) => {
  const { query } = req.body
  if (!query) return res.status(400).json({ status: false, message: "⚠️ أرسل { query: 'كلمة البحث' }" })

  const result = await searchPinterestVideos(query)
  if (!result.status) return res.status(500).json(result)

  const selected = result.pins[0]
  try {
    const info = await pindl(selected.pin_url)
    const { medias, title } = info
    if (!medias?.length) return res.status(404).json({ status: false, message: "⚠️ لا يوجد وسائط متاحة." })
    const mp4s = medias.filter(v => v.extension === 'mp4')
    const chosen = mp4s.sort((a, b) => (b.size || 0) - (a.size || 0))[0] || medias[0]

    res.json({
      status: true,
      creator: "Anas Radio",
      title: title || selected.title,
      description: selected.description,
      pin_url: selected.pin_url,
      quality: chosen.quality || "—",
      size: formatSize(chosen.size),
      download_url: chosen.url
    })
  } catch (e) {
    res.status(500).json({ status: false, message: "⚠️ فشل تنزيل الفيديو.", error: e.message })
  }
})

// ✅ GET /api/pinterestvideo
router.get('/', async (req, res) => {
  const { query } = req.query
  if (!query) {
    return res.json({
      status: true,
      message: "📌 أرسل POST مع { query: 'كلمة البحث' } أو استخدم GET ?query=",
      example: "/api/pinterestvideo?query=anime"
    })
  }

  const result = await searchPinterestVideos(query)
  res.status(result.status ? 200 : 500).json(result)
})

export default router

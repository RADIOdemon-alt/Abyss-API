// file: routes/pixelArt.js
import express from 'express'
import axios from 'axios'
import multer from 'multer'
import FormData from 'form-data'
import { fileTypeFromBuffer } from 'file-type'

const router = express.Router()
const upload = multer()

class PixelArt {
  async img2pixel(buffer, ratio = '1:1') {
    const { data: a } = await axios.post('https://pixelartgenerator.app/api/upload/presigned-url', {
      filename: `zenn_${Date.now()}.jpg`,
      contentType: 'image/jpeg',
      type: 'pixel-art-source'
    }, { headers: { 'content-type': 'application/json', referer: 'https://pixelartgenerator.app/' } })

    await axios.put(a.data.uploadUrl, buffer, { headers: { 'content-type': 'image/jpeg', 'content-length': buffer.length } })

    const { data: b } = await axios.post('https://pixelartgenerator.app/api/pixel/generate', {
      imageKey: a.data.key,
      prompt: '',
      size: ratio,
      type: 'image'
    }, { headers: { 'content-type': 'application/json', referer: 'https://pixelartgenerator.app/' } })

    while (true) {
      const { data } = await axios.get(`https://pixelartgenerator.app/api/pixel/status?taskId=${b.data.taskId}`, { headers: { 'content-type': 'application/json', referer: 'https://pixelartgenerator.app/' } })
      if (data.data.status === 'SUCCESS') return data.data.images[0]
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

// POST /api/pixelart
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ status: false, message: 'Image file is required' })
    const ratio = req.body.ratio || '1:1'
    const p = new PixelArt()
    const result = await p.img2pixel(req.file.buffer, ratio)

    const fileRes = await axios.get(result.url, { responseType: 'arraybuffer' })
    const base64 = `data:${fileRes.headers['content-type']};base64,${Buffer.from(fileRes.data).toString('base64')}`

    res.json({ status: true, url: result.url, base64 })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

// GET /api/pixelart?imageUrl=...
router.get('/', async (req, res) => {
  try {
    const { imageUrl, ratio = '1:1' } = req.query
    if (!imageUrl) return res.status(400).json({ status: false, message: 'Image URL is required' })

    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' })
    const buffer = Buffer.from(imgRes.data)

    const p = new PixelArt()
    const result = await p.img2pixel(buffer, ratio)

    const fileRes = await axios.get(result.url, { responseType: 'arraybuffer' })
    const base64 = `data:${fileRes.headers['content-type']};base64,${Buffer.from(fileRes.data).toString('base64')}`

    res.json({ status: true, url: result.url, base64 })
  } catch (e) {
    res.status(500).json({ status: false, message: e.message })
  }
})

export default router
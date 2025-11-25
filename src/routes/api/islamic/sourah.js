import express from "express";
import axios from "axios";
import fs from "fs";
import { tmpdir } from "os";
import { join } from "path";

const router = express.Router();

/* -------------------------------------------------
   🎧 دالة تحويل اسم السورة → رقم السورة
---------------------------------------------------*/
function getSurahNumber(surahName) {
  const surahs = {
    'الفاتحة': 1, 'البقرة': 2, 'آل عمران': 3, 'النساء': 4, 'المائدة': 5,
    'الأنعام': 6, 'الأعراف': 7, 'الأنفال': 8, 'التوبة': 9, 'يونس': 10,
    'هود': 11, 'يوسف': 12, 'الرعد': 13, 'إبراهيم': 14, 'الحجر': 15,
    'النحل': 16, 'الإسراء': 17, 'الكهف': 18, 'مريم': 19, 'طه': 20,
    'الأنبياء': 21, 'الحج': 22, 'المؤمنون': 23, 'النور': 24, 'الفرقان': 25,
    'الشعراء': 26, 'النمل': 27, 'القصص': 28, 'العنكبوت': 29, 'الروم': 30,
    'لقمان': 31, 'السجدة': 32, 'الأحزاب': 33, 'سبأ': 34, 'فاطر': 35,
    'يس': 36, 'الصافات': 37, 'ص': 38, 'الزمر': 39, 'غافر': 40,
    'فصلت': 41, 'الشورى': 42, 'الزخرف': 43, 'الدخان': 44, 'الجاثية': 45,
    'الأحقاف': 46, 'محمد': 47, 'الفتح': 48, 'الحجرات': 49, 'ق': 50,
    'الذاريات': 51, 'الطور': 52, 'النجم': 53, 'القمر': 54, 'الرحمن': 55,
    'الواقعة': 56, 'الحديد': 57, 'المجادلة': 58, 'الحشر': 59,
    'الممتحنة': 60, 'الصف': 61, 'الجمعة': 62, 'المنافقون': 63,
    'التغابن': 64, 'الطلاق': 65, 'التحريم': 66, 'الملك': 67, 'القلم': 68,
    'الحاقة': 69, 'المعارج': 70, 'نوح': 71, 'الجن': 72, 'المزمل': 73,
    'المدثر': 74, 'القيامة': 75, 'الإنسان': 76, 'المرسلات': 77,
    'النبأ': 78, 'النازعات': 79, 'عبس': 80, 'التكوير': 81,
    'الانفطار': 82, 'المطففين': 83, 'الانشقاق': 84, 'البروج': 85,
    'الطارق': 86, 'الأعلى': 87, 'الغاشية': 88, 'الفجر': 89, 'البلد': 90,
    'الشمس': 91, 'الليل': 92, 'الضحى': 93, 'الشرح': 94, 'التين': 95,
    'العلق': 96, 'القدر': 97, 'البينة': 98, 'الزلزلة': 99,
    'العاديات': 100, 'القارعة': 101, 'التكاثر': 102, 'العصر': 103,
    'الهمزة': 104, 'الفيل': 105, 'قريش': 106, 'الماعون': 107,
    'الكوثر': 108, 'الكافرون': 109, 'النصر': 110, 'المسد': 111,
    'الإخلاص': 112, 'الفلق': 113, 'الناس': 114
  };

  return surahs[surahName] || null;
}

/* -------------------------------------------------
   🎧 دالة تحميل السورة من موقع mp3quran
---------------------------------------------------*/
async function downloadSurah(surahNumber) {
  const url = `https://server10.mp3quran.net/ajm/128/${String(
    surahNumber
  ).padStart(3, "0")}.mp3`;

  const tempPath = join(tmpdir(), `${surahNumber}.mp3`);

  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
    headers: {
      "Accept-Encoding": "identity",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/136 Mobile Safari",
      Referer: `https://surahquran.com/mp3/Al-Ajmy/${surahNumber}.html`,
      Host: "server10.mp3quran.net",
    },
  });

  const writer = fs.createWriteStream(tempPath);
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return tempPath;
}

/* -------------------------------------------------
   📌 POST → /quran
---------------------------------------------------*/
router.post("/", async (req, res) => {
  try {
    const surahName = req.body.surah;
    if (!surahName)
      return res.json({ status: false, message: "⚠️ اسم السورة مطلوب" });

    const number = getSurahNumber(surahName);
    if (!number)
      return res.json({ status: false, message: "❌ السورة غير موجودة" });

    const file = await downloadSurah(number);

    const mp3Buffer = fs.readFileSync(file);
    fs.unlinkSync(file);

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(mp3Buffer);
  } catch (err) {
    res.json({ status: false, message: "❌ خطأ أثناء تحميل السورة", error: err.message });
  }
});

/* -------------------------------------------------
   📌 GET → /quran?name=الفاتحة
---------------------------------------------------*/
router.get("/", async (req, res) => {
  try {
    const name = req.query.name;

    if (!name)
      return res.json({ status: false, message: "⚠️ اسم السورة مطلوب" });

    const number = getSurahNumber(name);
    if (!number)
      return res.json({ status: false, message: "❌ السورة غير موجودة" });

    const file = await downloadSurah(number);
    const mp3Buffer = fs.readFileSync(file);
    fs.unlinkSync(file);

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(mp3Buffer);
  } catch (err) {
    res.json({ status: false, message: "❌ خطأ", error: err.message });
  }
});

export default router;
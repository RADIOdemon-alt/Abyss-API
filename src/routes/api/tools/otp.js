import express from "express";
import makeWASocket from "baileys-pro";
import { useMultiFileAuthState } from "baileys-pro";

const router = express.Router();

/* ===========================
 *   WhatsApp Sender Class
 * ===========================*/
class WhatsAppSender {
  constructor(sock) {
    this.sock = sock;
  }

  formatNumber(num) {
    return num.toString().replace(/[^0-9]/g, "") + "@s.whatsapp.net";
  }

  async sendMessage(number, msg) {
    if (!number || !msg)
      throw new Error("⚠️ مطلوب رقم ورسالـة.");

    const jid = this.formatNumber(number);

    await this.sock.sendMessage(jid, { text: msg });

    return {
      number,
      jid,
      message: msg,
      delivered: true,
      timestamp: Date.now()
    };
  }
}

/* ===========================
 *     WA SOCKET INIT
 * ===========================*/
let sock;
async function initWA() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
  });

  sock.ev.on("creds.update", saveCreds);
}

initWA();

/* ===========================
 *        POST ROUTE
 * ===========================*/
router.post("/", async (req, res) => {
  try {
    const { number, msg } = req.body;

    if (!number)
      return res.status(400).json({
        status: false,
        message: "⚠️ مطلوب: الرقم (number)",
      });

    if (!msg)
      return res.status(400).json({
        status: false,
        message: "⚠️ مطلوب: الرسالة (msg)",
      });

    const wa = new WhatsAppSender(sock);
    const result = await wa.sendMessage(number, msg);

    res.json({
      status: true,
      message: "✅ تم إرسال الرسالة بنجاح",
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "❌ فشل الإرسال",
      error: err.message,
    });
  }
});

/* ===========================
 *        GET ROUTE
 * ===========================*/
router.get("/", async (req, res) => {
  try {
    const { number, msg } = req.query;

    if (!number)
      return res.status(400).json({
        status: false,
        message: "⚠️ مطلوب: الرقم (number)",
      });

    if (!msg)
      return res.status(400).json({
        status: false,
        message: "⚠️ مطلوب: الرسالة (msg)",
      });

    const wa = new WhatsAppSender(sock);
    const result = await wa.sendMessage(number, msg);

    res.json({
      status: true,
      message: "✅ تم إرسال الرسالة بنجاح",
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "❌ فشل الإرسال",
      error: err.message,
    });
  }
});

export default router;

// api/start.js
import axios from "axios";
import * as cheerio from "cheerio";
import { v4 as uuidv4 } from "uuid";

export default async function handler(req, res) {
  try {
    const response = await axios.post(
      "https://ar.akinator.com/game",
      new URLSearchParams({ cm: "false", sid: "1" }),
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      }
    );

    const $ = cheerio.load(response.data);

    const question = $("#question-label").text();
    const session = $('form#askSoundlike input[name="session"]').val();
    const signature = $('form#askSoundlike input[name="signature"]').val();

    if (!session || !signature) {
      return res.status(500).json({ error: "Session or signature missing" });
    }

    return res.status(200).json({
      id: uuidv4(),
      session,
      signature,
      question
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
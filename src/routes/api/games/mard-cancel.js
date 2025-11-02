// /pages/api/marid2.js
import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await axios.post(
      "https://ar.akinator.com/cancel_answer",
      new URLSearchParams({
        step: req.body.step,
        progression: req.body.progression,
        session: req.body.session,
        signature: req.body.signature,
        cm: "false",
        sid: "NaN"
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      }
    );

    let result = response.data;

    if (result.akitude) {
      result.akitude_url = `https://ar.akinator.com/assets/img/akitudes_520x650/${result.akitude}`;
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message, raw: err.response?.data });
  }
}
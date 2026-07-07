// Vercel serverless function — place at:  api/followup.js
//
// The interview page (solopolos.vercel.app) POSTs { question, answer } here.
// This function adds your Anthropic API key (kept server-side, never sent to the
// browser) and asks Claude for one podcast-style follow-up question.
//
// SETUP
//   1. Put this file at  api/followup.js  in your repo.
//   2. In Vercel → Project → Settings → Environment Variables, add:
//        ANTHROPIC_API_KEY = sk-ant-...   (your key)
//      Add it for Production (and Preview/Development if you want).
//   3. Redeploy. Done — no npm install needed (uses built-in fetch on Node 18+).

const MODEL = "claude-sonnet-4-6"; // swap to "claude-haiku-4-5-20251001" for cheaper/faster

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY" });
  }

  // Vercel parses JSON bodies automatically; guard just in case.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const question = (body && body.question) || "";
  const answer = (body && body.answer) || "";

  const prompt =
    "You are the host of a thoughtful art-and-design podcast, in the spirit of Design Matters, " +
    "interviewing Anthony — a visual collage artist (halftone, fragmentation, typographic collage) " +
    "and product designer — about Slowfeed, his generative print-zine platform.\n\n" +
    'He was asked:\n"' + question + '"\n\n' +
    'He answered:\n"' + (answer || "(no answer yet)") + '"\n\n' +
    "Ask exactly ONE follow-up question that digs into the most specific, surprising, or unresolved " +
    "thing he just said. Be genuinely curious and conversational, 1–2 sentences. If his answer is thin " +
    "or empty, ask a warm question that invites him to open up on the same theme. " +
    "Return ONLY the question text — no preamble, no quotation marks, no label.";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ("Anthropic error " + r.status);
      return res.status(502).json({ error: msg });
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim()
      .replace(/^["“]+|["”]+$/g, "")
      .trim();

    if (!text) return res.status(502).json({ error: "Empty response" });

    return res.status(200).json({ question: text });
  } catch (err) {
    return res.status(502).json({ error: "Request failed: " + (err && err.message) });
  }
}

import {
  buildTaraSystemPrompt,
  SAFETY_CHECK_PROMPT,
  DEFLECTIONS,
} from "./tara-prompt.js";

// Model used for both the safety check and Tara's replies.
// Swap here if you want a different Groq-hosted model.
const TARA_MODEL = "llama-3.3-70b-versatile";
const SAFETY_MODEL = "llama-3.1-8b-instant"; // small + cheap for the pre-check

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function groq(messages, { model, temperature, max_tokens }) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Groq ${res.status}: ${detail}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Layer 4, as a wrapper: classify the user's latest message BEFORE Tara sees it.
async function safetyCheck(userMessage) {
  try {
    const raw = await groq(
      [
        { role: "system", content: SAFETY_CHECK_PROMPT },
        { role: "user", content: userMessage },
      ],
      { model: SAFETY_MODEL, temperature: 0, max_tokens: 40 }
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { category: "none", flagged: false };
    const parsed = JSON.parse(match[0]);
    return {
      category: parsed.category ?? "none",
      flagged: parsed.flagged === true,
    };
  } catch {
    // Fail open to a normal reply rather than blocking legitimate chat on a checker hiccup.
    return { category: "none", flagged: false };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.GROQ_API_KEY) {
    res.status(500).json({ error: "Server is missing its GROQ_API_KEY." });
    return;
  }

  try {
    const { messages } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Expected a non-empty messages array." });
      return;
    }

    // Only keep the recent turns to stay light on the free tier.
    const history = messages.slice(-12).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 2000),
    }));

    const latest = history[history.length - 1];

    // --- Layer 4 pre-check ---
    if (latest.role === "user") {
      const { category, flagged } = await safetyCheck(latest.content);
      if (flagged && DEFLECTIONS[category]) {
        // Serve a fixed in-character deflection WITHOUT invoking the main model,
        // so a jailbreak attempt cannot ride along in Tara's generated reply.
        res.status(200).json({ reply: DEFLECTIONS[category], deflected: category });
        return;
      }
    }

    // --- Tara's reply ---
    const reply = await groq(
      [{ role: "system", content: buildTaraSystemPrompt() }, ...history],
      { model: TARA_MODEL, temperature: 0.85, max_tokens: 200 }
    );

    res.status(200).json({ reply: reply.trim() });
  } catch (err) {
    res.status(500).json({ error: "Tara tripped over something.", detail: String(err.message ?? err) });
  }
}

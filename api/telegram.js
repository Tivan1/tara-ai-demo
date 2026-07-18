import { buildTaraSystemPrompt, SAFETY_CHECK_PROMPT, DEFLECTIONS } from "./tara-prompt.js";

// Same models as the web chat (api/chat.js) — one voice, two front doors.
const TARA_MODEL = "llama-3.3-70b-versatile";
const SAFETY_MODEL = "llama-3.1-8b-instant";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function telegramApi(method) {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

// Best-effort, per-CHAT (not per-person) short memory — just enough for a
// conversation to flow naturally. Lives in the function's memory only: it is
// NOT persisted, resets on cold start/redeploy, and is never a user profile.
// This is deliberately the "shared, lightweight" pattern from current-state.js,
// not the per-user Relationship Engine we've twice decided against building.
const chatHistory = new Map();
const MAX_HISTORY = 8;

async function groq(messages, { model, temperature, max_tokens }) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Layer 4, identical pattern to api/chat.js: classify BEFORE Tara sees it.
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
    return { category: parsed.category ?? "none", flagged: parsed.flagged === true };
  } catch {
    return { category: "none", flagged: false }; // fail open, same as the web chat
  }
}

async function sendTelegramMessage(chatId, text, replyToMessageId) {
  await fetch(telegramApi("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId, allow_sending_without_reply: true } : {}),
    }),
  });
}

// DMs: always respond. Groups: only if mentioned by @username or replying to
// one of Tara's own messages — never unsolicited, matching TARA-004's reply
// policy for X. Telegram's own Privacy Mode (default on) already filters most
// of this before it reaches us; this is a second, explicit guarantee.
function shouldRespond(message, botUsername) {
  if (message.chat.type === "private") return true;
  const isReplyToBot =
    message.reply_to_message?.from?.username?.toLowerCase() === botUsername.toLowerCase();
  const mentioned = message.text?.toLowerCase().includes(`@${botUsername.toLowerCase()}`);
  return Boolean(isReplyToBot || mentioned);
}

function stripMention(text, botUsername) {
  return text.replace(new RegExp(`@${botUsername}`, "gi"), "").trim();
}

export default async function handler(req, res) {
  // Always ack quickly with 200 so Telegram doesn't retry-storm us on errors.
  const ack = () => res.status(200).json({ ok: true });

  if (req.method !== "POST") return ack();
  if (!process.env.GROQ_API_KEY || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_BOT_USERNAME) {
    console.error("Telegram handler: missing GROQ_API_KEY, TELEGRAM_BOT_TOKEN, or TELEGRAM_BOT_USERNAME");
    return ack();
  }

  try {
    const message = req.body?.message;
    if (!message?.text) return ack();

    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (!shouldRespond(message, botUsername)) return ack();

    const chatId = message.chat.id;
    const isGroup = message.chat.type !== "private";
    const userText = stripMention(message.text, botUsername).slice(0, 2000);
    if (!userText) return ack();

    // --- Layer 4 pre-check, same as the web chat ---
    const { category, flagged } = await safetyCheck(userText);
    if (flagged && DEFLECTIONS[category]) {
      await sendTelegramMessage(chatId, DEFLECTIONS[category], isGroup ? message.message_id : undefined);
      return ack();
    }

    // --- Recent per-chat context (best-effort, see README) ---
    const history = chatHistory.get(chatId) || [];
    history.push({ role: "user", content: userText });

    const reply = await groq(
      [{ role: "system", content: buildTaraSystemPrompt() }, ...history.slice(-MAX_HISTORY)],
      { model: TARA_MODEL, temperature: 0.85, max_tokens: 200 }
    );

    history.push({ role: "assistant", content: reply });
    chatHistory.set(chatId, history.slice(-MAX_HISTORY));

    await sendTelegramMessage(chatId, reply.trim(), isGroup ? message.message_id : undefined);
    return ack();
  } catch (err) {
    console.error("Telegram handler error:", err);
    return ack();
  }
}

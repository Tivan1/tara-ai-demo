# AI-Tara — Phase 0 Prototype

A live, conversational Tara for the Turbo Ecosystem. Implements the TARA-003 architecture:
Layer 1 (identity), Layer 2 (canon — CANON lines only, no open hooks), and Layer 4 (hard
safety rules), the last of which runs as a **separate pre-check pass** that wraps the roleplay
rather than sitting inside it.

This is a **conceptual prototype**. Nothing here is final or production-hardened.

---

## How it works

```
browser (index.html)  ──POST /api/chat──►  Vercel function  ──►  Groq API
      ▲                                          │
      └────────────── reply ─────────────────────┘
```

- The Groq key lives **only** on the server (Vercel env var). The browser never sees it.
- Every user message is first sent to a small, cheap **safety classifier**. If it trips one
  of the disallowed categories (financial advice, romantic/sexual, real public figures,
  copyright, jailbreak), Tara returns a **fixed in-character deflection** and the main model
  is never called — so a jailbreak can't ride along in a generated reply.
- Otherwise the message goes to Tara (the larger model) with the full system prompt.

Two models are used (both Groq-hosted, both on the free tier):
- `llama-3.3-70b-versatile` — Tara's replies (stronger character).
- `llama-3.1-8b-instant` — the safety pre-check (fast + cheap).

Change either in `api/chat.js` (top of the file).

---

## Files

| File | What it is |
|------|-----------|
| `index.html` | The chat interface. Talks only to `/api/chat`. |
| `api/chat.js` | Vercel serverless proxy: safety check, then Tara. |
| `api/tara-prompt.js` | The system prompt, canon, and deflection lines. Edit Tara here. |
| `package.json` | Declares ES modules. |

**To change Tara's personality or canon, edit `api/tara-prompt.js` only.** Keep it consistent
with TARA-001 (personality) and TARA-005 (canon). Do not add open hooks as stated facts.

---

## Deploy (GitHub + Vercel + Groq) — about 10 minutes

### 1. Get a free Groq key
1. Go to https://console.groq.com and sign in.
2. Open **API Keys** → **Create API Key**. Copy it (you only see it once).

### 2. Put this project on GitHub
From the project folder:
```bash
git init
git add .
git commit -m "AI-Tara Phase 0 prototype"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tara-ai-demo.git
git push -u origin main
```
(Create the empty repo on github.com first, then use its URL above.)

### 3. Deploy on Vercel
1. Go to https://vercel.com and sign in with GitHub.
2. **Add New → Project**, import the `tara-ai-demo` repo.
3. Framework preset: **Other**. Leave build/output settings empty — it's static + functions.
4. Before deploying, open **Environment Variables** and add:
   - Name: `GROQ_API_KEY`
   - Value: *(paste your Groq key)*
5. Click **Deploy**.

Vercel gives you a URL like `https://tara-ai-demo.vercel.app`. Open it — Tara greets you.

> If you add the env var *after* the first deploy, trigger a redeploy so it takes effect
> (Deployments → ⋯ → Redeploy).

### 4. (Optional) run it locally
```bash
npm i -g vercel
cp .env.example .env.local     # paste your key into .env.local
vercel dev
```
Then open the local URL it prints. `vercel dev` runs the serverless function locally.

---

## Cost & limits

Groq's free tier is generous but rate-limited per minute/day. Two calls happen per message
(one small safety check, one reply). If you hit a limit, the safety checker fails open to a
normal reply, and Tara returns a soft error if the main call fails. For a demo shown to a
handful of people this stays comfortably free.

## Honest limits (read before showing anyone)

- The safety layer is a **classifier + fixed deflections**, not a guarantee. It's much stronger
  than putting rules in the prompt alone, but a determined adversary can still find edges.
  Fine for a Phase 0 demo; not a production safety system.
- Open-weight Llama follows the character well but isn't identical run to run.
- No memory between sessions, no mood engine (Layer 3), no on-chain or X integration —
  all of that is Phase 1+ by design.

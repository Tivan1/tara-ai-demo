# Tara — Turbo Ecosystem Site

A small multi-page site for Tara: a homepage, the canon lore, a live "what's happening now"
page, an honest Phase 0 progress tracker, three light zone pages (Marketplace, Laboratory,
The Nest), and the live AI chat. Implements the TARA-003 architecture in the chat: Layer 1
(identity), Layer 2 (canon — CANON lines only, no open hooks), and Layer 4 (hard safety
rules), the last of which runs as a **separate pre-check pass** that wraps the roleplay
rather than sitting inside it.

This is a **conceptual prototype**. Nothing here is final or production-hardened.

## Pages

| Page | File | Notes |
|------|------|-------|
| Home | `index.html` | Hero, the duo, a meme gallery, links to everything else. |
| Lore | `lore.html` | The origin + the four canon events. The one page with real prose. |
| Last Events | `events.html` | Fetches `/api/events` live — same data Tara's prompt uses. |
| Results | `results.html` | Honest Phase 0 checklist — live vs. coming. |
| Marketplace | `marketplace.html` | Light zone page. Marked "coming, later phase." |
| Laboratory | `laboratory.html` | Light zone page. Marked "coming, later phase." |
| The Nest | `nest.html` | Overview tying the four zones together. |
| Chat | `chat.html` | The live AI conversation (was the whole site before). |

All pages share `/assets/styles.css` (one design system: dark ink, bubblegum pink, gold
accents, the sticker motif from the character sheet) and `/assets/nav.js` (mobile menu
toggle only — no other JS is shared).

### Updating the Last Events page

`events.html` fetches `/api/events`, a tiny read-only endpoint that just returns
`api/current-state.js` as JSON. Edit `current-state.js` and both the chat and this page
pick it up immediately — no rebuild step, nothing else to touch.

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
| `index.html`, `lore.html`, `events.html`, `results.html`, `marketplace.html`, `laboratory.html`, `nest.html` | The static site pages. |
| `chat.html` | The chat interface. Talks only to `/api/chat`. |
| `assets/styles.css` | The shared design system — one file, every page. |
| `assets/nav.js` | Mobile nav toggle. The only shared page script. |
| `assets/*.jpg`, `assets/*.png` | Character art, used across the site. |
| `api/chat.js` | Vercel serverless proxy: safety check, then Tara. |
| `api/tara-prompt.js` | The system prompt, canon, and deflection lines. Edit Tara here. |
| `api/current-state.js` | Shared "what's happening right now" memory. Edit this often. |
| `api/events.js` | Read-only endpoint that serves `current-state.js` as JSON for `events.html`. |
| `package.json` | Declares ES modules. |

**To change Tara's personality or canon, edit `api/tara-prompt.js`.** Keep it consistent
with TARA-001 (personality) and TARA-005 (canon). Do not add open hooks as stated facts.

### Shared memory, not per-user memory

Tara does **not** remember individual users between sessions — no database, no login, no
per-person profile. That's deliberate: at real scale, per-user memory means a growing
database, real per-message cost, privacy/GDPR obligations, and an attack surface for people
trying to poison what she "remembers." TARA-003 already scopes that kind of memory to
Phase 3+, for when there's a concrete reason (e.g. a paid tier) to justify the cost.

Instead, `api/current-state.js` holds a small, **shared** memory: the same handful of facts
for every user — the last burn, the community's current mood, the meme everyone's talking
about, Tara's own "status." Update that one file whenever something happens (a burn, a
milestone, a great meme) and every conversation picks it up immediately — no redeploy of the
chat logic needed, and nothing that scales with the number of users.

The prompt instructs Tara to weave this in only when relevant, never to announce it
unprompted — so it reads as her being aware of what's going on, not as a news ticker.

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

Vercel gives you a URL like `https://tara-ai-demo.vercel.app`. Open it for the homepage,
or add `/chat.html` to go straight to the conversation.

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

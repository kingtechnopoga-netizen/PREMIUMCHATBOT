# NULLSEC — Elite AI Operating System

A premium, hacker-grade AI chatbot web app powered by [Puter.js](https://js.puter.com) — multi-model, streaming, with a built-in code workspace, web search, vision, and local-first memory.

> A covert AI workspace. Streaming. Multi-model. Zero-trace local memory.

---

## Highlights

- Cinematic encrypted boot sequence
- Refined dark-tech aesthetic — matte black + subtle emerald & cyan accents
- Floating particles, ultra-subtle matrix rain, ambient fog, scanlines
- 20+ free AI models (GPT-5.5, Claude Opus 4.7, Gemini 2.5 Pro, DeepSeek, Grok, Llama, Mistral, …)
- Real-time streaming responses with smart auto-scroll and abort
- Vision (image attachments) — supported on capable models
- Modes: standard · deep reason · coding · web search · vision
- 5 personas: operator · red team · architect · ghost · sensei
- Web search via DuckDuckGo Instant Answer + Wikipedia REST (no key required, CORS-friendly)
- Hacker-styled markdown with copy / save / open-in-workspace per code block
- Built-in HTML/CSS/JS workspace with sandboxed live preview
- Session list, pinning, search, rename, delete, import / export JSON
- Long-term memory (toggleable), system prompt, persona, temperature
- Local-first persistence — no servers, no telemetry
- Mobile-optimized — gestures, tap-friendly, low-end Android friendly
- Donation footer with one-tap GCash copy

---

## Run locally

This is a static site. Just open `index.html` over HTTP.

Pick any of:

```sh
python3 -m http.server 8080
# then open http://localhost:8080
```

```sh
npx serve .
```

> Note: opening `index.html` via the `file://` protocol may break some features (clipboard write, fetch to https endpoints depending on browser policy). A local web server is recommended.

---

## Deploy to Render (Blueprint)

This repo ships with a [`render.yaml`](./render.yaml) Blueprint — Render will read it and provision a free static site in one click.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kingtechnopoga-netizen/PREMIUMCHATBOT)

### Step-by-step

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Go to **[dashboard.render.com](https://dashboard.render.com)** → **New** → **Blueprint**.
3. Connect your GitHub account if you haven't already, then pick the `PREMIUMCHATBOT` repo.
4. Render auto-detects `render.yaml` and shows a preview — service name `nullsec`, type **Static Site**, plan **Free**.
5. Click **Apply** → Render builds and deploys.
6. Your app will be live at `https://nullsec.onrender.com` (or whatever subdomain you chose).

### What the blueprint configures

- Static site on Render's free tier (`runtime: static`, `plan: free`)
- No build step — files are served as-is from the repo root
- SPA-style rewrite (`/*` → `/index.html`) so deep links work
- Long cache (`max-age=86400` + `stale-while-revalidate`) for `/css/*` and `/js/*`
- No-cache for `index.html` so updates roll out instantly
- Mild security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`) that don't break Puter.js, Google Fonts, or the CDN libs

### After deploy

- Open the Render dashboard → your service → **Settings** to:
  - Add a **custom domain** (e.g. `nullsec.yourdomain.com`)
  - Enable **auto-deploy** (already on by default — every push to `main` redeploys)
  - Toggle **PR previews** (already on — every PR gets its own preview URL)

### Tweaks

- Change the region in `render.yaml` (`region:` line) — closer = faster.
- Want a paid plan with custom SSL on apex domains? Change `plan: free` to `plan: starter`.

---

## Project structure

```
.
├── index.html              # app shell + boot sequence
├── css/
│   ├── core.css           # design tokens, reset, typography
│   ├── layout.css         # app shell, sidebar, topbar, codex, responsive
│   ├── chat.css           # chat stream, messages, code cards, composer, donation
│   ├── components.css     # buttons, modals, toasts, tooltips
│   └── animations.css     # boot sequence, entrances, ambient effects
└── js/
    ├── effects.js         # particles, matrix rain, boot sequence
    ├── storage.js         # localStorage persistence (sessions, settings, memory)
    ├── markdown.js        # marked + DOMPurify + highlight.js + code-card actions
    ├── ai.js              # puter.js integration, models, personas, modes, web search
    ├── codex.js           # HTML/CSS/JS workspace + sandboxed preview
    ├── chat.js            # message rendering, composer, streaming, regenerate
    ├── ui.js              # sidebar, model picker, modes, settings, donation, gestures
    └── main.js            # entry — orchestrates startup
```

All app state is exposed under `window.NULLSEC`.

---

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| New session | `⌘ / Ctrl + K` |
| Focus input | `⌘ / Ctrl + /` |
| Toggle sidebar | `⌘ / Ctrl + B` |
| Toggle code workspace | `⌘ / Ctrl + L` |
| Send | `Enter` |
| Newline | `Shift + Enter` |

---

## Models

The default model is `gpt-5-nano`. Models are organized by group in the picker:

- **default** — GPT-5 Nano / Mini / 5 / 5.4 / 5.5 / 5.5 Pro / 5.3 Codex / 4.1 / 4o
- **reasoning** — o1, o3
- **anthropic** — Claude Opus 4.7 / 4.6 · Claude Sonnet 4.6 / 4.5 / 4 · Claude Haiku 4.5
- **google** — Gemini 2.5 Flash · Gemini 2.5 Pro
- **open weights** — DeepSeek v4 · DeepSeek R1 · Grok 4 · Llama 4 Maverick · Mistral Large

All models are available **for free** via Puter.js. The free tier is metered by Puter — see their docs for details.

---

## Privacy

- Conversations, settings, memory, and workspace files live entirely in your browser's `localStorage`.
- Nothing is sent to any backend except the Puter.js endpoint when you send a message. (And, in **web search** mode, requests to DuckDuckGo and Wikipedia.)
- No analytics, no tracking. Wipe everything from `Settings → wipe all sessions`.

---

## Support the creator

If NULLSEC helps you ship faster, you can drop a tip — *kahit barya lang*.

**GCash:** `0948 288 7486`

The donation card has a one-tap copy button at the bottom of the app.

---

## License

MIT — do whatever you'd like, just don't repackage it as a service that pretends to be original.

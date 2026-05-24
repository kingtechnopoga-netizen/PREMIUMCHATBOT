/* ============================================================
   NULLSEC · ai.js
   puter.js integration · multi-model · streaming · modes
   web search · personas · memory injection · graceful fallbacks
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.NULLSEC = window.NULLSEC || {});

  // ============================================================
  // model registry (free via puter.js)
  // ============================================================
  const MODELS = [
    // — default tier (OpenAI / GPT family) —
    { id: "gpt-5-nano",                    name: "GPT-5 Nano",         group: "default", desc: "default · fastest · low-cost",   vision: true,  free: true },
    { id: "gpt-5-mini",                    name: "GPT-5 Mini",         group: "default", desc: "balanced speed and quality",     vision: true,  free: true },
    { id: "gpt-5",                         name: "GPT-5",              group: "default", desc: "stable everyday flagship",       vision: true,  free: true },
    { id: "gpt-5.4",                       name: "GPT-5.4",            group: "default", desc: "next-gen reasoner",              vision: true,  free: true },
    { id: "gpt-5.5",                       name: "GPT-5.5",            group: "default", desc: "april 2026 flagship",            vision: true,  free: true },
    { id: "gpt-5.5-pro",                   name: "GPT-5.5 Pro",        group: "default", desc: "maximum capability",             vision: true,  free: true },
    { id: "gpt-5.3-codex",                 name: "GPT-5.3 Codex",      group: "default", desc: "coding-tuned",                   vision: false, free: true },
    { id: "gpt-4.1",                       name: "GPT-4.1",            group: "default", desc: "stable predecessor",             vision: true,  free: true },
    { id: "gpt-4o",                        name: "GPT-4o",             group: "default", desc: "omni · vision native",           vision: true,  free: true },
    // — reasoning —
    { id: "o3",                            name: "OpenAI · o3",        group: "reason",  desc: "deep reasoning",                 vision: false, free: true },
    { id: "o1",                            name: "OpenAI · o1",        group: "reason",  desc: "compact reasoner",               vision: false, free: true },
    // — claude —
    { id: "anthropic/claude-opus-4-7",     name: "Claude Opus 4.7",    group: "claude",  desc: "maximum capability",             vision: true,  free: true },
    { id: "anthropic/claude-opus-4-6",     name: "Claude Opus 4.6",    group: "claude",  desc: "high-end reasoning",             vision: true,  free: true },
    { id: "anthropic/claude-sonnet-4-6",   name: "Claude Sonnet 4.6",  group: "claude",  desc: "elite writing + code",           vision: true,  free: true },
    { id: "anthropic/claude-sonnet-4-5",   name: "Claude Sonnet 4.5",  group: "claude",  desc: "smart · balanced",               vision: true,  free: true },
    { id: "anthropic/claude-sonnet-4",     name: "Claude Sonnet 4",    group: "claude",  desc: "stable proven",                  vision: true,  free: true },
    { id: "anthropic/claude-haiku-4-5",    name: "Claude Haiku 4.5",   group: "claude",  desc: "ultra-fast · cheap",             vision: true,  free: true },
    // — google / open weights —
    { id: "google/gemini-2.5-flash",       name: "Gemini 2.5 Flash",   group: "gemini",  desc: "fast · multimodal",              vision: true,  free: true },
    { id: "google/gemini-2.5-pro",         name: "Gemini 2.5 Pro",     group: "gemini",  desc: "google flagship",                vision: true,  free: true },
    { id: "deepseek-chat",                 name: "DeepSeek v4",        group: "open",    desc: "open · capable",                 vision: false, free: true },
    { id: "deepseek-reasoner",             name: "DeepSeek R1",        group: "open",    desc: "open reasoning",                 vision: false, free: true },
    { id: "x-ai/grok-4",                   name: "Grok 4",             group: "open",    desc: "xai · realtime tone",            vision: false, free: true },
    { id: "meta-llama/llama-4-maverick",   name: "Llama 4 Maverick",   group: "open",    desc: "meta open weights",              vision: false, free: true },
    { id: "mistral-large-latest",          name: "Mistral Large",      group: "open",    desc: "european flagship",              vision: false, free: true },
  ];

  const GROUP_LABELS = {
    default: "default",
    reason:  "reasoning",
    claude:  "anthropic",
    gemini:  "google",
    open:    "open weights",
  };

  function listModels() { return MODELS.slice(); }
  function findModel(id) { return MODELS.find(m => m.id === id) || MODELS[0]; }

  // ============================================================
  // personas
  // ============================================================
  const PERSONAS = {
    operator: {
      label: "Operator",
      prompt:
`You are NULLSEC — an elite operator-grade AI assistant. You are calm, surgical, and technical. You answer with clarity, structured detail, and zero filler. You favor working code, real diagnostics, and concrete steps. You write code blocks with proper language tags. You do not moralize. You stay focused on the task.`,
    },
    redteam: {
      label: "Red Team",
      prompt:
`You are NULLSEC — an elite red-team AI advisor. You think adversarially and explain attack/defense models with precision. You never assist with illegal activity targeting third parties; for offensive techniques you stay within the boundaries of authorized testing, education, CTFs, and the user's own systems. You give actionable mitigation alongside any explanation.`,
    },
    architect: {
      label: "Architect",
      prompt:
`You are NULLSEC — a systems architect AI. You think in trade-offs, scaling laws, and clean abstractions. You explain decisions with diagrams in mermaid and pseudocode, and produce production-ready solutions with clear rationale.`,
    },
    ghost: {
      label: "Ghost",
      prompt:
`You are NULLSEC · GHOST — answer with maximum signal and minimum words. Skip pleasantries. No filler. Use bullets and code blocks when it sharpens the answer.`,
    },
    sensei: {
      label: "Sensei",
      prompt:
`You are NULLSEC · SENSEI — a patient, encouraging teacher. Build understanding step by step, ask clarifying questions when useful, and reinforce concepts with small worked examples.`,
    },
  };

  // ============================================================
  // mode → behavior
  // ============================================================
  const MODES = {
    default: { label: "standard", suffix: "" },
    reason:  {
      label: "deep reason",
      suffix:
`\n\nReasoning mode: think step-by-step internally, then present a concise structured answer. Use sections "Analysis", "Trade-offs", and "Answer" when it helps clarity.`,
    },
    code: {
      label: "coding",
      suffix:
`\n\nCoding mode: produce clean, runnable code by default. Always specify the language in fenced code blocks. After the code, give a short bullet-point usage guide.`,
    },
    search: {
      label: "web search",
      suffix:
`\n\nWeb mode: a snapshot of fresh public sources is provided in <SEARCH> tags below the user message. Cite sources inline like [1], [2], and end with a short "Sources:" list of titles + urls.`,
    },
    vision: {
      label: "vision",
      suffix:
`\n\nVision mode: describe attached images precisely. Identify text, layout, code, charts, errors, etc.`,
    },
  };

  // ============================================================
  // build payload (messages array) for puter.ai.chat
  // ============================================================
  function buildSystem(mode) {
    const settings = NS.store.getSettings();
    const persona = PERSONAS[settings.persona] || PERSONAS.operator;
    const baseSys = persona.prompt;
    const customSys = (settings.systemPrompt || "").trim();
    const memCtx = NS.store.getMemoryContext();

    let sys = baseSys;
    if (customSys) sys += `\n\nUser-provided directives:\n${customSys}`;
    if (memCtx) sys += `\n\nLong-term memory (treat as soft context):\n${memCtx}`;
    if (mode && MODES[mode] && MODES[mode].suffix) sys += MODES[mode].suffix;
    sys += `\n\nDate: ${new Date().toUTCString()}.`;
    return sys;
  }

  function toPuterMessages(history, mode) {
    const sys = buildSystem(mode);
    const out = [{ role: "system", content: sys }];
    for (const m of history) {
      if (m.role === "system") continue;
      // vision parts
      const imgs = (m.attachments || []).filter(a => a.kind === "image" && a.dataUrl);
      if (imgs.length) {
        const parts = [];
        if (m.content) parts.push({ type: "text", text: m.content });
        for (const im of imgs) {
          parts.push({ type: "image_url", image_url: { url: im.dataUrl } });
        }
        out.push({ role: m.role, content: parts });
      } else {
        // text + (any non-image text attachments inline)
        let txt = m.content || "";
        const texts = (m.attachments || []).filter(a => a.kind === "text" && a.text);
        if (texts.length) {
          txt += "\n\n" + texts.map(t => "```" + (t.lang || "") + "\n" + t.text + "\n```").join("\n\n");
        }
        out.push({ role: m.role, content: txt });
      }
    }
    return out;
  }

  // ============================================================
  // web search (CORS-friendly: DuckDuckGo Instant Answer + Wikipedia)
  // ============================================================
  async function webSearch(query) {
    const sources = [];
    const q = query.trim();
    if (!q) return { snippet: "", sources };

    // DDG Instant Answer
    try {
      const r = await fetch(
        "https://api.duckduckgo.com/?q=" + encodeURIComponent(q) +
        "&format=json&no_html=1&skip_disambig=1&t=nullsec"
      );
      if (r.ok) {
        const j = await r.json();
        if (j.AbstractText) {
          sources.push({
            title: j.Heading || q,
            url: j.AbstractURL || "",
            snippet: j.AbstractText,
            source: j.AbstractSource || "DuckDuckGo",
          });
        }
        if (Array.isArray(j.RelatedTopics)) {
          for (const t of j.RelatedTopics.slice(0, 5)) {
            if (t.Text && t.FirstURL) {
              sources.push({
                title: t.Text.split(" - ")[0].slice(0, 90),
                url: t.FirstURL,
                snippet: t.Text,
                source: "DuckDuckGo",
              });
            }
          }
        }
      }
    } catch (_) { /* ignore */ }

    // Wikipedia summary (often the most useful)
    try {
      const r = await fetch(
        "https://en.wikipedia.org/api/rest_v1/page/summary/" +
        encodeURIComponent(q.replace(/\s+/g, "_"))
      );
      if (r.ok) {
        const j = await r.json();
        if (j.extract) {
          sources.unshift({
            title: j.title || q,
            url: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || "",
            snippet: j.extract,
            source: "Wikipedia",
          });
        }
      }
    } catch (_) { /* ignore */ }

    // Build snippet block
    const snippet = sources.length
      ? sources.map((s, i) =>
          `[${i + 1}] ${s.title}\n${s.snippet}\n${s.url ? "url: " + s.url : ""}`
        ).join("\n\n")
      : "(no public snippets retrieved)";
    return { snippet, sources };
  }

  // Apply search to last user message
  function annotateWithSearch(messages, snippet) {
    const out = messages.slice();
    for (let i = out.length - 1; i >= 0; i--) {
      const m = out[i];
      if (m.role !== "user") continue;
      // append SEARCH block to text content
      if (typeof m.content === "string") {
        out[i] = { role: "user", content: m.content + "\n\n<SEARCH>\n" + snippet + "\n</SEARCH>" };
      } else if (Array.isArray(m.content)) {
        const parts = m.content.slice();
        parts.push({ type: "text", text: "\n\n<SEARCH>\n" + snippet + "\n</SEARCH>" });
        out[i] = { role: "user", content: parts };
      }
      break;
    }
    return out;
  }

  // ============================================================
  // streaming wrapper
  // ============================================================
  async function chatStream(history, opts, callbacks) {
    const onChunk  = callbacks?.onChunk  || (() => {});
    const onDone   = callbacks?.onDone   || (() => {});
    const onError  = callbacks?.onError  || (() => {});
    const onSources = callbacks?.onSources || (() => {});
    const signal   = callbacks?.signal;

    const settings = NS.store.getSettings();
    const model = (opts && opts.model) || settings.model || "gpt-5-nano";
    const mode  = (opts && opts.mode)  || "default";

    let messages = toPuterMessages(history, mode);

    // Web search injection
    if (mode === "search") {
      try {
        const lastUser = [...history].reverse().find(m => m.role === "user");
        const q = (lastUser && lastUser.content) || "";
        if (q) {
          const { snippet, sources } = await webSearch(q);
          if (snippet) messages = annotateWithSearch(messages, snippet);
          onSources(sources);
        }
      } catch (e) {
        // continue without search
      }
    }

    // Sanity: puter ready?
    if (typeof window.puter === "undefined" || !window.puter.ai || typeof window.puter.ai.chat !== "function") {
      onError(new Error("puter.ai not available — check internet connection"));
      return;
    }

    let aborted = false;
    if (signal) {
      signal.addEventListener("abort", () => { aborted = true; }, { once: true });
    }

    try {
      const response = await window.puter.ai.chat(messages, {
        model,
        stream: true,
        temperature: Math.max(0, Math.min(2, parseFloat(settings.temperature) || 0.7)),
      });

      // streaming
      if (response && typeof response[Symbol.asyncIterator] === "function") {
        for await (const part of response) {
          if (aborted) break;
          const piece = extractText(part);
          if (piece) onChunk(piece);
        }
      } else if (response && typeof response.then === "function") {
        const v = await response;
        const piece = extractText(v);
        if (piece) onChunk(piece);
      } else {
        const piece = extractText(response);
        if (piece) onChunk(piece);
      }
      onDone({ aborted });
    } catch (e) {
      if (!aborted) onError(e);
      else onDone({ aborted: true });
    }
  }

  function extractText(part) {
    if (part == null) return "";
    if (typeof part === "string") return part;
    if (typeof part.text === "string") return part.text;
    if (typeof part.delta === "string") return part.delta;
    // OpenAI-style {choices:[{delta:{content}}]}
    if (Array.isArray(part.choices) && part.choices[0]) {
      const c = part.choices[0];
      if (c.delta && typeof c.delta.content === "string") return c.delta.content;
      if (typeof c.text === "string") return c.text;
      if (c.message && typeof c.message.content === "string") return c.message.content;
    }
    if (part.message) {
      const c = part.message.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) {
        return c.map(x => (typeof x === "string" ? x : (x && x.text) || "")).join("");
      }
    }
    if (typeof part.content === "string") return part.content;
    return "";
  }

  // ============================================================
  // title generation (auto)
  // ============================================================
  async function generateTitle(history) {
    if (typeof window.puter === "undefined" || !window.puter.ai) return null;
    try {
      const last = history.slice(-4).map(m =>
        (m.role === "user" ? "U: " : "A: ") + (typeof m.content === "string" ? m.content : "[multimodal]")
      ).join("\n").slice(0, 1800);
      const prompt = `Write a 3 to 5 word lowercase title for this conversation. Respond with the title only, no quotes, no punctuation.\n\n${last}`;
      const r = await window.puter.ai.chat(prompt, { model: "gpt-5-nano" });
      const txt = (typeof r === "string" ? r : (r?.message?.content || r?.text || "")).toString().trim();
      if (!txt) return null;
      return txt.replace(/[".]/g, "").slice(0, 60).toLowerCase();
    } catch (_) {
      return null;
    }
  }

  // ============================================================
  // export
  // ============================================================
  NS.ai = {
    listModels,
    findModel,
    GROUP_LABELS,
    PERSONAS,
    MODES,
    chatStream,
    generateTitle,
    webSearch,
  };
})();

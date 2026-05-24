/* ============================================================
   NULLSEC · chat.js
   message rendering · streaming · composer · attachments
   regenerate · edit · stop · copy
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.NULLSEC = window.NULLSEC || {});

  // ---------- DOM refs (lazy) ----------
  let $chat, $welcome, $input, $sendBtn, $sendIc, $sendStop, $attachBtn, $fileInput, $attachBar, $ctxHint;
  let $title, $metaModel, $metaCount;

  // ---------- runtime state ----------
  let pendingAttachments = []; // [{ kind, name, size, type, dataUrl?, text?, lang? }]
  let streamCtrl = null;       // { abort: () => void, signalEt }
  let streamingMsgId = null;
  let streamingBuffer = "";
  let lastFlushAt = 0;
  let rafScheduled = false;

  function init() {
    $chat       = document.getElementById("chat");
    $welcome    = document.getElementById("welcome");
    $input      = document.getElementById("input");
    $sendBtn    = document.getElementById("send-btn");
    $sendIc     = $sendBtn.querySelector(".send-ic");
    $sendStop   = $sendBtn.querySelector(".send-stop");
    $attachBtn  = document.getElementById("attach-btn");
    $fileInput  = document.getElementById("file-input");
    $attachBar  = document.getElementById("attach-bar");
    $ctxHint    = document.getElementById("ctx-hint");

    $title      = document.getElementById("chat-title");
    $metaModel  = document.getElementById("chat-meta-model");
    $metaCount  = document.getElementById("chat-meta-count");

    bindComposer();
    bindMessageActions();
    NS.md && NS.md.bindCodeActions && NS.md.bindCodeActions(document);

    // welcome quick prompts
    document.querySelectorAll(".prompt-card").forEach((c) => {
      c.addEventListener("click", () => {
        const p = c.getAttribute("data-prompt");
        if (!p) return;
        $input.value = p;
        autosize();
        send();
      });
    });
  }

  // ============================================================
  // composer
  // ============================================================
  function bindComposer() {
    $input.addEventListener("input", autosize);
    $input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (streamCtrl) abortStream();
        else send();
      }
    });

    $sendBtn.addEventListener("click", () => {
      if (streamCtrl) abortStream();
      else send();
    });

    $attachBtn.addEventListener("click", () => $fileInput.click());
    $fileInput.addEventListener("change", onFiles);

    // paste images
    $input.addEventListener("paste", async (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const files = [];
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        await ingestFiles(files);
      }
    });

    // drag & drop
    const dropZone = document.querySelector(".composer-wrap");
    if (dropZone) {
      dropZone.addEventListener("dragover", (e) => { e.preventDefault(); });
      dropZone.addEventListener("drop", async (e) => {
        e.preventDefault();
        if (!e.dataTransfer || !e.dataTransfer.files.length) return;
        await ingestFiles(Array.from(e.dataTransfer.files));
      });
    }

    autosize();
  }

  function autosize() {
    $input.style.height = "auto";
    const max = 220;
    $input.style.height = Math.min(max, $input.scrollHeight) + "px";
    if ($ctxHint) {
      const total = String($input.value || "").length;
      $ctxHint.textContent = `ctx · ${total.toLocaleString()} ch`;
    }
  }

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    await ingestFiles(files);
  }

  async function ingestFiles(files) {
    for (const f of files) {
      try {
        if (f.type.startsWith("image/")) {
          const dataUrl = await readAsDataURL(f);
          pendingAttachments.push({
            kind: "image",
            name: f.name,
            size: f.size,
            type: f.type,
            dataUrl,
          });
        } else if (f.size <= 256 * 1024) {
          const text = await readAsText(f);
          pendingAttachments.push({
            kind: "text",
            name: f.name,
            size: f.size,
            type: f.type,
            text,
            lang: extToLang(f.name),
          });
        } else {
          NS.toast && NS.toast.warn(`${f.name} skipped — too large (>256KB)`);
        }
      } catch (err) {
        NS.toast && NS.toast.warn(`failed to read ${f.name}`);
      }
    }
    renderAttachBar();
  }

  function readAsDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }
  function readAsText(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsText(file);
    });
  }
  function extToLang(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    const m = {
      js: "javascript", ts: "typescript", tsx: "tsx", jsx: "jsx",
      py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
      kt: "kotlin", swift: "swift", sh: "bash", bash: "bash",
      html: "html", htm: "html", css: "css", scss: "scss",
      json: "json", yml: "yaml", yaml: "yaml", xml: "xml",
      md: "markdown", txt: "", csv: "", log: "",
      cpp: "cpp", cc: "cpp", c: "c", h: "c", hpp: "cpp",
      cs: "csharp", php: "php", sql: "sql",
    };
    return m[ext] || "";
  }

  function renderAttachBar() {
    if (!pendingAttachments.length) {
      $attachBar.hidden = true;
      $attachBar.innerHTML = "";
      return;
    }
    $attachBar.hidden = false;
    $attachBar.innerHTML = pendingAttachments.map((a, i) => `
      <div class="attach-pill" data-idx="${i}">
        ${a.kind === "image"
          ? `<img src="${a.dataUrl}" alt=""/>`
          : `<span class="mono small dim">${escapeHtml((a.lang || "doc"))}</span>`}
        <span>${escapeHtml(truncate(a.name, 22))}</span>
        <span class="mono small dim">${humanSize(a.size)}</span>
        <button class="ap-rm" data-rm="${i}" aria-label="Remove">✕</button>
      </div>
    `).join("");
    $attachBar.querySelectorAll("[data-rm]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.getAttribute("data-rm"), 10);
        pendingAttachments.splice(i, 1);
        renderAttachBar();
      });
    });
  }

  function humanSize(n) {
    if (n < 1024) return n + "B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + "K";
    return (n / 1048576).toFixed(1) + "M";
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  // ============================================================
  // sending
  // ============================================================
  async function send(opts) {
    const text = ($input.value || "").trim();
    const atts = pendingAttachments.slice();
    if (!text && !atts.length) return;

    const conv = NS.store.ensureActive();

    // ensure mode is appropriate
    const settings = NS.store.getSettings();
    let effectiveMode = settings.mode || "default";
    if (atts.some(a => a.kind === "image") && effectiveMode !== "vision") {
      effectiveMode = "vision";
    }

    // append user msg
    const userMsg = NS.store.appendMessage(conv.id, {
      role: "user",
      content: text,
      attachments: atts,
      mode: effectiveMode,
    });

    pendingAttachments = [];
    renderAttachBar();
    $input.value = "";
    autosize();

    hideWelcome();
    appendMessageElement(userMsg);
    scrollToBottom(true);

    await runAssistant(conv.id, effectiveMode);

    // auto-title after first exchange
    const c = NS.store.getConversation(conv.id);
    if (c && c.messages.length >= 2 && (c.title === "untitled session" || !c.title)) {
      const title = await NS.ai.generateTitle(c.messages);
      if (title) {
        NS.store.renameConversation(c.id, title);
        if ($title) $title.textContent = title;
        NS.ui && NS.ui.refreshSidebar && NS.ui.refreshSidebar();
      }
    }
    updateMeta();
  }

  async function runAssistant(convId, mode) {
    const conv = NS.store.getConversation(convId);
    if (!conv) return;

    const settings = NS.store.getSettings();
    const model = settings.model;

    // append empty assistant msg
    const aMsg = NS.store.appendMessage(convId, {
      role: "assistant",
      content: "",
      model,
      mode,
    });
    streamingMsgId = aMsg.id;
    streamingBuffer = "";
    lastFlushAt = 0;

    const el = appendMessageElement(aMsg, { streaming: true });
    showThinking(el);
    scrollToBottom();

    setSendingUI(true);
    const aborter = makeAborter();
    streamCtrl = aborter;

    let firstChunk = true;
    let sources = null;

    await NS.ai.chatStream(conv.messages.slice(0, -1), { model, mode }, {
      signal: aborter.signal,
      onSources(s) { sources = s; },
      onChunk(piece) {
        if (firstChunk) {
          firstChunk = false;
          hideThinking(el);
        }
        streamingBuffer += piece;
        scheduleFlush(el);
      },
      onDone({ aborted }) {
        flushNow(el);
        const final = streamingBuffer || (aborted ? "_(stopped by user)_" : "_(no response)_");
        NS.store.patchMessage(convId, aMsg.id, {
          content: final,
          sources: sources || null,
        });
        finalizeBubble(el, final, sources);
        cleanupStream(el);
      },
      onError(err) {
        flushNow(el);
        const errText = `\n\n> error: ${escapeHtml(err && err.message || String(err))}`;
        const final = (streamingBuffer || "") + errText;
        NS.store.patchMessage(convId, aMsg.id, { content: final });
        finalizeBubble(el, final, sources);
        cleanupStream(el);
        NS.toast && NS.toast.warn("model error — see message");
      },
    });
  }

  function makeAborter() {
    const ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    if (ctrl) return { signal: ctrl.signal, abort: () => ctrl.abort() };
    // fallback: tiny event-target shim
    const target = new EventTarget();
    let aborted = false;
    return {
      signal: {
        addEventListener: (ev, cb) => target.addEventListener(ev, cb),
        get aborted() { return aborted; },
      },
      abort: () => { aborted = true; target.dispatchEvent(new Event("abort")); },
    };
  }

  function abortStream() {
    if (streamCtrl) {
      try { streamCtrl.abort(); } catch (_) {}
      streamCtrl = null;
      setSendingUI(false);
    }
  }

  function setSendingUI(busy) {
    if (busy) {
      $sendBtn.classList.add("streaming");
      $sendIc && $sendIc.setAttribute("hidden", "");
      $sendStop && $sendStop.removeAttribute("hidden");
      $sendBtn.setAttribute("aria-label", "Stop");
    } else {
      $sendBtn.classList.remove("streaming");
      $sendIc && $sendIc.removeAttribute("hidden");
      $sendStop && $sendStop.setAttribute("hidden", "");
      $sendBtn.setAttribute("aria-label", "Send");
    }
  }

  function cleanupStream(el) {
    streamingMsgId = null;
    streamingBuffer = "";
    streamCtrl = null;
    setSendingUI(false);
    if (el) el.classList.remove("streaming");
    updateMeta();
    NS.ui && NS.ui.refreshSidebar && NS.ui.refreshSidebar();
  }

  // ============================================================
  // streaming flush — debounced via rAF
  // ============================================================
  function scheduleFlush(el) {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      flushNow(el);
    });
  }
  function flushNow(el) {
    if (!el) return;
    const bubble = el.querySelector(".bubble");
    if (!bubble) return;
    // use textContent for streaming (fast, safe), then re-render at end
    const stream = bubble.querySelector(".stream-text");
    if (stream) {
      stream.textContent = streamingBuffer;
    }
    // smart auto-scroll: only if user is near bottom
    smartScroll();
  }
  function finalizeBubble(el, finalText, sources) {
    const bubble = el && el.querySelector(".bubble");
    if (!bubble) return;
    const html = NS.md ? NS.md.render(finalText) : escapeHtml(finalText);
    let extra = "";
    if (sources && sources.length) extra = renderSourcesCard(sources);
    bubble.innerHTML = html + extra;
    NS.md && NS.md.highlightAllIn(bubble);
    el.classList.remove("streaming");
    smartScroll();
  }

  function renderSourcesCard(sources) {
    const items = sources.map((s, i) => `
      <a class="search-card-item" href="${escapeAttr(s.url || "#")}" target="_blank" rel="noopener noreferrer">
        <div>${i + 1}. ${escapeHtml(s.title || "untitled")}</div>
        ${s.url ? `<div class="sci-host">${escapeHtml(hostOf(s.url))}</div>` : ""}
      </a>
    `).join("");
    return `
<div class="search-card">
  <div class="search-card-head">◯ web sources · ${sources.length} matches</div>
  <div class="search-card-list">${items}</div>
</div>`;
  }
  function hostOf(u) { try { return new URL(u).host; } catch { return u; } }

  // ============================================================
  // rendering (full conversation)
  // ============================================================
  function renderConversation(conv) {
    if (!conv) {
      // empty state
      $chat.innerHTML = "";
      $chat.appendChild($welcome);
      $welcome.hidden = false;
      updateMeta();
      return;
    }
    $chat.innerHTML = "";
    const stream = document.createElement("div");
    stream.className = "chat-stream";
    $chat.appendChild(stream);

    if (!conv.messages || !conv.messages.length) {
      $chat.appendChild($welcome);
      $welcome.hidden = false;
    } else {
      $welcome.hidden = true;
      for (const m of conv.messages) {
        const el = buildMessageEl(m);
        stream.appendChild(el);
        const bubble = el.querySelector(".bubble");
        const html = NS.md ? NS.md.render(m.content || "") : escapeHtml(m.content || "");
        let extra = "";
        if (m.sources && m.sources.length) extra = renderSourcesCard(m.sources);
        bubble.innerHTML = (html || "<em class='dim'>(empty)</em>") + extra;
        NS.md && NS.md.highlightAllIn(bubble);
      }
    }
    updateMeta();
    requestAnimationFrame(() => scrollToBottom(true));
  }

  function appendMessageElement(msg, opts = {}) {
    let stream = $chat.querySelector(".chat-stream");
    if (!stream) {
      stream = document.createElement("div");
      stream.className = "chat-stream";
      $chat.innerHTML = "";
      $chat.appendChild(stream);
    }
    const el = buildMessageEl(msg, opts);
    stream.appendChild(el);

    const bubble = el.querySelector(".bubble");
    if (opts.streaming) {
      bubble.innerHTML = `<span class="stream-text"></span><span class="cursor"></span>`;
    } else {
      const html = NS.md ? NS.md.render(msg.content || "") : escapeHtml(msg.content || "");
      bubble.innerHTML = html;
      NS.md && NS.md.highlightAllIn(bubble);
    }
    return el;
  }

  function buildMessageEl(msg, opts = {}) {
    const wrap = document.createElement("article");
    wrap.className = `msg ${msg.role}`;
    if (opts.streaming) wrap.classList.add("streaming");
    wrap.dataset.id = msg.id;

    const tag = msg.role === "user"
      ? `<span class="who">you</span>`
      : `<span class="who">nullsec</span><span class="tag model">${escapeHtml(short(msg.model || "ai"))}</span>${msg.mode && msg.mode !== "default" ? `<span class="tag">${escapeHtml(msg.mode)}</span>` : ""}`;

    const att = (msg.attachments && msg.attachments.length)
      ? `<div class="msg-attachments">${msg.attachments.map(renderAttachInMsg).join("")}</div>`
      : "";

    const actions = `
      <div class="msg-actions">
        <button data-act="copy" data-tip="copy">⌘ copy</button>
        ${msg.role === "user"
          ? `<button data-act="edit" data-tip="edit">✎ edit</button>`
          : `<button data-act="regen" data-tip="regenerate">↻ regenerate</button>`}
        <button class="warn" data-act="del" data-tip="delete">✕ delete</button>
      </div>`;

    wrap.innerHTML = `
      <div class="msg-avatar">${msg.role === "user" ? "U" : "AI"}</div>
      <div class="msg-body">
        <div class="msg-meta">${tag}<span class="time mono small dim">${fmtTime(msg.createdAt)}</span></div>
        ${att}
        <div class="bubble"></div>
        ${actions}
      </div>
    `;
    return wrap;
  }

  function renderAttachInMsg(a) {
    if (a.kind === "image") {
      return `<div class="att-chip">
        <img src="${escapeAttr(a.dataUrl || "")}" alt="${escapeAttr(a.name)}"/>
        <div><div class="att-name">${escapeHtml(a.name)}</div><div class="att-size mono">${humanSize(a.size || 0)} · image</div></div>
      </div>`;
    }
    return `<div class="att-chip">
      <span class="mono small">${escapeHtml(a.lang || "doc")}</span>
      <div><div class="att-name">${escapeHtml(a.name)}</div><div class="att-size mono">${humanSize(a.size || 0)}</div></div>
    </div>`;
  }

  function showThinking(el) {
    const bubble = el && el.querySelector(".bubble");
    if (!bubble) return;
    bubble.innerHTML = `
      <div class="thinking">
        <span class="thinking-dots"><i></i><i></i><i></i></span>
        <span>thinking</span>
        <div class="thinking-bar"></div>
      </div>
    `;
  }
  function hideThinking(el) {
    const bubble = el && el.querySelector(".bubble");
    if (!bubble) return;
    bubble.innerHTML = `<span class="stream-text"></span><span class="cursor"></span>`;
  }

  function hideWelcome() {
    if ($welcome && !$welcome.hidden) {
      $welcome.hidden = true;
      // re-mount stream container
      if (!$chat.querySelector(".chat-stream")) {
        const stream = document.createElement("div");
        stream.className = "chat-stream";
        $chat.innerHTML = "";
        $chat.appendChild(stream);
      }
    }
  }

  // ============================================================
  // message actions (delegated)
  // ============================================================
  function bindMessageActions() {
    $chat.addEventListener("click", (e) => {
      const btn = e.target.closest(".msg-actions button[data-act]");
      if (!btn) return;
      const wrap = btn.closest(".msg");
      if (!wrap) return;
      const id = wrap.dataset.id;
      const act = btn.getAttribute("data-act");
      const conv = NS.store.getActive();
      if (!conv) return;
      const msg = conv.messages.find(m => m.id === id);
      if (!msg) return;

      if (act === "copy") {
        NS.md.copyText(msg.content || "");
        flashBtn(btn, "copied ✓");
        NS.toast && NS.toast.ok("message copied");
      } else if (act === "edit") {
        editMessage(conv.id, msg);
      } else if (act === "regen") {
        regenerate(conv.id, msg);
      } else if (act === "del") {
        deleteMessage(conv.id, msg);
      }
    });
  }

  function editMessage(convId, msg) {
    if (msg.role !== "user") return;
    // truncate everything from this user message onward
    const conv = NS.store.getConversation(convId);
    const idx = conv.messages.findIndex(m => m.id === msg.id);
    if (idx < 0) return;
    conv.messages = conv.messages.slice(0, idx);
    NS.store.updateConversation(convId, { messages: conv.messages });

    pendingAttachments = (msg.attachments || []).slice();
    renderAttachBar();
    $input.value = msg.content || "";
    autosize();
    $input.focus();
    renderConversation(NS.store.getConversation(convId));
  }

  async function regenerate(convId, msg) {
    if (msg.role !== "assistant") return;
    const conv = NS.store.getConversation(convId);
    const idx = conv.messages.findIndex(m => m.id === msg.id);
    if (idx < 0) return;
    // remove this assistant msg + any after it
    conv.messages = conv.messages.slice(0, idx);
    NS.store.updateConversation(convId, { messages: conv.messages });
    renderConversation(NS.store.getConversation(convId));
    const settings = NS.store.getSettings();
    const lastUser = [...conv.messages].reverse().find(m => m.role === "user");
    const mode = (lastUser && lastUser.mode) || settings.mode || "default";
    await runAssistant(convId, mode);
  }

  function deleteMessage(convId, msg) {
    NS.store.removeMessage(convId, msg.id);
    renderConversation(NS.store.getConversation(convId));
    NS.toast && NS.toast.info("message deleted");
  }

  function flashBtn(btn, label) {
    const orig = btn.textContent;
    btn.textContent = label;
    btn.style.color = "#2ce5a0";
    setTimeout(() => { btn.textContent = orig; btn.style.color = ""; }, 1100);
  }

  // ============================================================
  // scroll
  // ============================================================
  function smartScroll() {
    if (!$chat) return;
    const distance = $chat.scrollHeight - $chat.scrollTop - $chat.clientHeight;
    if (distance < 180) $chat.scrollTop = $chat.scrollHeight;
  }
  function scrollToBottom(force) {
    if (!$chat) return;
    if (force) {
      $chat.scrollTop = $chat.scrollHeight;
    } else {
      smartScroll();
    }
  }

  // ============================================================
  // meta
  // ============================================================
  function updateMeta() {
    const conv = NS.store.getActive();
    const settings = NS.store.getSettings();
    if ($title && conv && conv.title) $title.textContent = conv.title;
    if ($metaModel) {
      const m = NS.ai && NS.ai.findModel ? NS.ai.findModel(settings.model) : null;
      $metaModel.textContent = short((m && m.name) || settings.model || "—");
    }
    if ($metaCount) $metaCount.textContent = `${conv ? Math.floor(conv.messages.length / 2) : 0} turns`;
  }

  // ============================================================
  // helpers
  // ============================================================
  function short(model) {
    return String(model).replace(/^.+\//, "");
  }
  function fmtTime(ts) {
    const d = new Date(ts || Date.now());
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // expose
  NS.chat = {
    init,
    send,
    abortStream,
    renderConversation,
    appendMessageElement,
    updateMeta,
    setInputText: (t) => { $input.value = t || ""; autosize(); $input.focus(); },
    focusInput: () => $input && $input.focus(),
  };
})();

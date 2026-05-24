/* ============================================================
   NULLSEC · markdown.js
   marked + dompurify + highlight.js
   custom code-card renderer with copy / download / send-to-codex
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.NULLSEC = window.NULLSEC || {});

  // Wait for libs (loaded in head, available before this script in body)
  const hasMarked = typeof window.marked !== "undefined";
  const hasPurify = typeof window.DOMPurify !== "undefined";
  const hasHljs = typeof window.hljs !== "undefined";

  // ---------- custom marked renderer ----------
  let renderer = null;
  if (hasMarked) {
    renderer = new marked.Renderer();

    // Block code → terminal-style card
    renderer.code = function (code, infostring) {
      const raw = typeof code === "object" ? (code.text ?? code.raw ?? "") : code;
      const lang = (typeof code === "object" ? code.lang : infostring) || "";
      const language = (lang || "").trim().split(/\s+/)[0] || "plaintext";
      let highlighted = "";
      try {
        if (hasHljs && language && hljs.getLanguage(language)) {
          highlighted = hljs.highlight(raw, { language, ignoreIllegals: true }).value;
        } else if (hasHljs) {
          highlighted = hljs.highlightAuto(raw).value;
        } else {
          highlighted = escapeHtml(raw);
        }
      } catch (_) {
        highlighted = escapeHtml(raw);
      }
      const langTag = language || "code";
      const id = "cc_" + Math.random().toString(36).slice(2, 9);
      const encoded = encodeURIComponent(raw);

      return `
<div class="code-card" data-cc="${id}" data-lang="${escapeAttr(language)}" data-raw="${encoded}">
  <div class="code-card-head">
    <div class="cc-lang">
      <span class="cc-leds"><i></i><i></i><i></i></span>
      <span class="cc-name">${escapeHtml(langTag)}</span>
    </div>
    <div class="cc-actions">
      <button data-act="copy" data-tip="copy">copy</button>
      <button data-act="download" data-tip="download">save</button>
      <button data-act="codex" data-tip="open in workspace">⌘ open</button>
    </div>
  </div>
  <pre><code class="hljs language-${escapeAttr(language)}">${highlighted}</code></pre>
</div>`.trim();
    };

    // Links → open in new tab
    renderer.link = function (href, title, text) {
      // marked v12 may pass an object
      if (typeof href === "object") {
        title = href.title;
        text = href.text;
        href = href.href;
      }
      const t = title ? ` title="${escapeAttr(title)}"` : "";
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer"${t}>${text}</a>`;
    };

    marked.setOptions({
      renderer,
      gfm: true,
      breaks: true,
      headerIds: false,
      mangle: false,
      smartLists: true,
    });
  }

  // ---------- public render ----------
  function render(md) {
    if (!md) return "";
    const text = String(md);
    let html;
    if (hasMarked) {
      try { html = marked.parse(text); }
      catch (e) { html = `<p>${escapeHtml(text)}</p>`; }
    } else {
      html = `<p>${escapeHtml(text).replace(/\n/g, "<br/>")}</p>`;
    }

    if (hasPurify) {
      html = DOMPurify.sanitize(html, {
        ADD_ATTR: ["target", "rel", "data-cc", "data-lang", "data-raw", "data-act", "data-tip"],
        FORBID_TAGS: ["style", "iframe", "form", "input", "button"],
        FORBID_ATTR: ["onerror", "onload", "onclick"],
      });
      // Re-allow our own button tags inside code-card heads (DOMPurify removed them above).
      // Trick: render buttons after sanitize by re-injecting via string token.
      // Easier path: don't forbid 'button' but block dangerous attrs.
    }
    return html;
  }

  // We allow buttons but strip handlers — switch DOMPurify config
  if (hasPurify) {
    DOMPurify.setConfig({});
  }

  // Re-render variant that keeps buttons (we trust our own renderer markup)
  function renderTrusted(md) {
    if (!md) return "";
    if (!hasMarked) return `<p>${escapeHtml(String(md))}</p>`;
    let html;
    try { html = marked.parse(String(md)); } catch { html = `<p>${escapeHtml(String(md))}</p>`; }
    if (hasPurify) {
      html = DOMPurify.sanitize(html, {
        ADD_ATTR: ["target", "rel", "data-cc", "data-lang", "data-raw", "data-act", "data-tip"],
        FORBID_TAGS: ["style", "iframe", "form", "input"],
      });
    }
    return html;
  }

  // ---------- code-card actions binding (delegated) ----------
  function bindCodeActions(rootSelector) {
    const root = typeof rootSelector === "string"
      ? document.querySelector(rootSelector)
      : rootSelector || document;

    root.addEventListener("click", (e) => {
      const btn = e.target.closest(".code-card .cc-actions button");
      if (!btn) return;
      const card = btn.closest(".code-card");
      if (!card) return;
      const raw = decodeURIComponent(card.getAttribute("data-raw") || "");
      const lang = card.getAttribute("data-lang") || "txt";
      const act = btn.getAttribute("data-act");

      if (act === "copy") {
        copyText(raw).then(() => {
          flashBtn(btn, "copied ✓");
          NS.toast && NS.toast.ok("code copied to clipboard");
        }).catch(() => {
          NS.toast && NS.toast.warn("copy failed");
        });
      } else if (act === "download") {
        const ext = langToExt(lang);
        const fn = `nullsec-snippet-${stamp()}.${ext}`;
        downloadString(raw, fn);
        NS.toast && NS.toast.ok(`saved · ${fn}`);
      } else if (act === "codex") {
        if (NS.codex && typeof NS.codex.openWith === "function") {
          NS.codex.openWith(raw, lang);
          NS.toast && NS.toast.info("opened in workspace");
        } else {
          NS.toast && NS.toast.warn("workspace not ready");
        }
      }
    });
  }

  function flashBtn(btn, label) {
    const orig = btn.textContent;
    btn.textContent = label;
    btn.style.color = "#2ce5a0";
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.color = "";
    }, 1100);
  }

  // ---------- highlight all (used after streaming finalization) ----------
  function highlightAllIn(el) {
    if (!hasHljs || !el) return;
    el.querySelectorAll("pre code").forEach((node) => {
      if (node.dataset.hl === "1") return;
      try { hljs.highlightElement(node); } catch (_) {}
      node.dataset.hl = "1";
    });
  }

  // ---------- helpers ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        ok ? resolve() : reject(new Error("execCommand failed"));
      } catch (e) { reject(e); }
    });
  }

  function downloadString(text, filename) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function langToExt(lang) {
    const map = {
      javascript: "js", js: "js",
      typescript: "ts", ts: "ts",
      python: "py", py: "py",
      ruby: "rb",
      go: "go",
      rust: "rs",
      java: "java",
      kotlin: "kt",
      swift: "swift",
      shell: "sh", bash: "sh", sh: "sh", zsh: "sh",
      html: "html",
      css: "css",
      json: "json",
      yaml: "yml", yml: "yml",
      sql: "sql",
      php: "php",
      cpp: "cpp", "c++": "cpp", c: "c", h: "h",
      cs: "cs", csharp: "cs",
      md: "md", markdown: "md",
      xml: "xml", svg: "svg",
      tsx: "tsx", jsx: "jsx",
    };
    return map[(lang || "").toLowerCase()] || "txt";
  }

  function stamp() {
    const d = new Date();
    return (
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0") + "-" +
      String(d.getHours()).padStart(2, "0") +
      String(d.getMinutes()).padStart(2, "0") +
      String(d.getSeconds()).padStart(2, "0")
    );
  }

  // ---------- export ----------
  NS.md = {
    render: renderTrusted,
    renderSafe: render,
    bindCodeActions,
    highlightAllIn,
    copyText,
    downloadString,
    langToExt,
  };
})();

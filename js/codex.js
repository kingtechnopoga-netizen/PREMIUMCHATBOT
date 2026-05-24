/* ============================================================
   NULLSEC · codex.js
   live HTML/CSS/JS workspace · sandboxed preview
   AI explain/debug · open-from-chat · download
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.NULLSEC = window.NULLSEC || {});

  // refs
  let $codex, $tabs, $html, $css, $js, $frame, $explain, $debug, $download, $run, $close;
  let activeTab = "html";
  let runDebounce = null;

  const STARTER = {
    html:
`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>NULLSEC · workspace</title>
</head>
<body>
  <main class="card">
    <h1>hello, operator.</h1>
    <p>edit me · live preview is on the right.</p>
    <button id="ping">ping</button>
    <pre id="out"></pre>
  </main>
</body>
</html>`,
    css:
`:root { color-scheme: dark; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Inter", sans-serif;
  background: radial-gradient(900px 500px at 30% -10%, #0e1f1a, #06080b);
  color: #e7ecf3;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
}
.card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 14px;
  padding: 24px 28px;
  max-width: 480px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5);
  text-align: center;
}
h1 { margin: 0 0 8px; font-size: 22px; letter-spacing: -0.01em; }
p  { margin: 0 0 16px; color: #b6bdc7; }
button {
  appearance: none; border: 0;
  padding: 10px 16px; border-radius: 10px;
  background: linear-gradient(135deg, #2ce5a0, #6ff0c1);
  color: #06080a; font-weight: 600; cursor: pointer;
  box-shadow: 0 6px 18px rgba(44,229,160,0.35);
}
pre { margin-top: 14px; color: #2ce5a0; font-family: ui-monospace, monospace; }`,
    js:
`document.getElementById("ping").addEventListener("click", () => {
  const out = document.getElementById("out");
  out.textContent = "[" + new Date().toLocaleTimeString() + "] pong";
});`
  };

  function init() {
    $codex   = document.getElementById("codex");
    $tabs    = document.querySelectorAll(".cx-tab");
    $html    = document.getElementById("cx-html");
    $css     = document.getElementById("cx-css");
    $js      = document.getElementById("cx-js");
    $frame   = document.getElementById("cx-frame");
    $explain = document.getElementById("cx-explain");
    $debug   = document.getElementById("cx-debug");
    $download = document.getElementById("cx-download");
    $run     = document.getElementById("cx-run");
    $close   = document.getElementById("cx-close");

    if (!$codex) return;

    // load persisted or starter
    const persisted = loadPersisted();
    $html.value = persisted.html;
    $css.value  = persisted.css;
    $js.value   = persisted.js;

    // tabs
    $tabs.forEach((t) => {
      t.addEventListener("click", () => activate(t.dataset.cx));
    });

    // input → debounced live run + persist
    [$html, $css, $js].forEach((ta) => {
      ta.addEventListener("input", () => {
        scheduleRun();
        persist();
      });
      // Tab key inserts spaces
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = ta.selectionStart, end = ta.selectionEnd;
          const v = ta.value;
          ta.value = v.slice(0, start) + "  " + v.slice(end);
          ta.selectionStart = ta.selectionEnd = start + 2;
          scheduleRun();
          persist();
        }
      });
    });

    $run && $run.addEventListener("click", run);
    $close && $close.addEventListener("click", close);
    $explain && $explain.addEventListener("click", () => sendToChat("explain"));
    $debug && $debug.addEventListener("click", () => sendToChat("debug"));
    $download && $download.addEventListener("click", download);

    // initial render
    activate("html");
    run();
  }

  function activate(tab) {
    activeTab = tab;
    $tabs.forEach((t) => t.classList.toggle("active", t.dataset.cx === tab));
    [["html", $html], ["css", $css], ["js", $js]].forEach(([k, el]) => {
      if (!el) return;
      el.hidden = (k !== tab);
    });
    setTimeout(() => {
      const visible = tab === "html" ? $html : tab === "css" ? $css : $js;
      visible && visible.focus();
    }, 0);
  }

  function scheduleRun() {
    clearTimeout(runDebounce);
    runDebounce = setTimeout(run, 350);
  }

  function compose() {
    const html = $html.value || "";
    const css  = $css.value  || "";
    const js   = $js.value   || "";

    // If user gave a full document, inject css/js before </head> and </body>.
    if (/<html[\s>]/i.test(html)) {
      let out = html;
      if (css) {
        if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `<style>${css}</style></head>`);
        else out = `<style>${css}</style>` + out;
      }
      if (js) {
        if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `<script>${js}<\/script></body>`);
        else out = out + `<script>${js}<\/script>`;
      }
      return out;
    }
    // Otherwise wrap a fragment.
    return `<!doctype html><html><head><meta charset="utf-8"/><title>preview</title>${css ? `<style>${css}</style>` : ""}</head><body>${html}${js ? `<script>${js}<\/script>` : ""}</body></html>`;
  }

  function run() {
    if (!$frame) return;
    const doc = compose();
    try {
      $frame.srcdoc = doc;
    } catch (_) {
      try {
        const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
        $frame.src = url;
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (_) {}
    }
  }

  function open() {
    if (!$codex) return;
    $codex.hidden = false;
    document.getElementById("app").setAttribute("data-codex", "1");
    requestAnimationFrame(run);
  }
  function close() {
    if (!$codex) return;
    $codex.hidden = true;
    document.getElementById("app").removeAttribute("data-codex");
  }
  function toggle() { $codex.hidden ? open() : close(); }

  function openWith(code, lang) {
    open();
    const l = (lang || "").toLowerCase();
    if (l === "html" || l === "htm") {
      $html.value = code;
      activate("html");
    } else if (l === "css" || l === "scss") {
      $css.value = code;
      activate("css");
    } else if (l === "javascript" || l === "js" || l === "ts" || l === "typescript") {
      $js.value = code;
      activate("js");
    } else {
      // pass everything through HTML pane
      $html.value = code;
      activate("html");
    }
    persist();
    run();
  }

  function download() {
    const doc = compose();
    const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nullsec-workspace-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    NS.toast && NS.toast.ok("workspace exported");
  }

  function sendToChat(kind) {
    const html = $html.value || "";
    const css  = $css.value  || "";
    const js   = $js.value   || "";
    const intro = kind === "debug"
      ? "debug this code · find issues · suggest fixes · explain reasoning"
      : "explain this code · what does it do · key concepts · improvement notes";

    const block = [
      "```html\n" + html + "\n```",
      css ? "```css\n" + css + "\n```" : "",
      js  ? "```javascript\n" + js  + "\n```" : "",
    ].filter(Boolean).join("\n\n");

    if (NS.chat && typeof NS.chat.setInputText === "function") {
      NS.chat.setInputText(`${intro}\n\n${block}`);
      // also flip mode to coding
      const settings = NS.store.getSettings();
      NS.store.setSettings({ mode: "code" });
      NS.ui && NS.ui.setMode && NS.ui.setMode("code");
      NS.chat.focusInput();
    }
  }

  function persist() {
    try {
      localStorage.setItem("nullsec.codex", JSON.stringify({
        html: $html.value, css: $css.value, js: $js.value,
      }));
    } catch (_) {}
  }
  function loadPersisted() {
    try {
      const raw = localStorage.getItem("nullsec.codex");
      if (raw) {
        const o = JSON.parse(raw);
        return {
          html: o.html || STARTER.html,
          css:  o.css  || STARTER.css,
          js:   o.js   || STARTER.js,
        };
      }
    } catch (_) {}
    return Object.assign({}, STARTER);
  }

  // export
  NS.codex = {
    init,
    open,
    close,
    toggle,
    openWith,
    run,
  };
})();

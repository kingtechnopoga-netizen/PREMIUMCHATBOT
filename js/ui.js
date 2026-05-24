/* ============================================================
   NULLSEC · ui.js
   sidebar · topbar · model picker · modes · settings · toasts
   donation · gestures · shortcuts
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.NULLSEC = window.NULLSEC || {});

  let $app, $sidebar, $convoList, $newChat, $search, $sideNav;
  let $sbCollapse, $sbOpen;
  let $modelPick, $modelLabel, $modelMenu;
  let $modeStrip, $personaBtn, $personaLabel;
  let $title, $metaModel, $toasts;
  let $codex, $toggleCodex, $toggleFocus;
  let $settingsModal, $settingsBtn, $settingsSave;
  let $importBtn, $exportBtn, $importFile, $wipeAll;
  let $gcashBadge, $gcashCopy, $gcashNum;
  let $sideView = "chats";

  function init() {
    cacheRefs();
    bindSidebar();
    bindTopbar();
    bindModelPicker();
    bindModeStrip();
    bindCodex();
    bindSettings();
    bindImportExport();
    bindDonation();
    bindShortcuts();
    bindMobileGestures();
    bindFocusMode();
    bindEditableTitle();

    refreshSidebar();
    syncFromState();
    NS.toast = toastApi();
  }

  // ============================================================
  // refs
  // ============================================================
  function cacheRefs() {
    $app          = document.getElementById("app");
    $sidebar      = document.getElementById("sidebar");
    $convoList    = document.getElementById("convo-list");
    $newChat      = document.getElementById("new-chat");
    $search       = document.getElementById("search");
    $sideNav      = document.querySelectorAll(".side-nav .nav-item");
    $sbCollapse   = document.getElementById("sidebar-collapse");
    $sbOpen       = document.getElementById("open-sidebar");

    $modelPick    = document.getElementById("model-pick");
    $modelLabel   = document.getElementById("model-label");
    $modelMenu    = document.getElementById("model-menu");

    $modeStrip    = document.querySelectorAll(".mode-chip[data-mode]");
    $personaBtn   = document.getElementById("persona-btn");
    $personaLabel = document.getElementById("persona-label");

    $title        = document.getElementById("chat-title");
    $metaModel    = document.getElementById("chat-meta-model");

    $codex        = document.getElementById("codex");
    $toggleCodex  = document.getElementById("toggle-codex");
    $toggleFocus  = document.getElementById("toggle-focus");

    $settingsModal = document.getElementById("settings-modal");
    $settingsBtn   = document.getElementById("open-settings");
    $settingsSave  = document.getElementById("settings-save");

    $importBtn    = document.getElementById("open-import");
    $exportBtn    = document.getElementById("export-all");
    $importFile   = document.getElementById("import-file");
    $wipeAll      = document.getElementById("wipe-all");

    $gcashBadge   = document.getElementById("gcash-badge");
    $gcashCopy    = document.getElementById("gcash-copy");
    $gcashNum     = document.getElementById("gcash-num");

    $toasts       = document.getElementById("toasts");
  }

  // ============================================================
  // sidebar
  // ============================================================
  function bindSidebar() {
    $newChat.addEventListener("click", () => {
      const c = NS.store.createConversation();
      NS.chat.renderConversation(c);
      refreshSidebar();
      closeMobileSidebar();
      NS.chat.focusInput();
    });

    $sbCollapse.addEventListener("click", () => {
      const collapsed = $app.getAttribute("data-collapsed") === "1";
      if (collapsed) {
        $app.removeAttribute("data-collapsed");
      } else {
        $app.setAttribute("data-collapsed", "1");
      }
      NS.store.setSettings({ sidebarCollapsed: !collapsed });
    });

    $sbOpen && $sbOpen.addEventListener("click", openMobileSidebar);

    $search.addEventListener("input", () => refreshSidebar());

    $sideNav.forEach((b) =>
      b.addEventListener("click", () => {
        $sideNav.forEach((x) => x.classList.toggle("active", x === b));
        $sideView = b.dataset.view;
        refreshSidebar();
      })
    );

    // delegated: convo click + actions
    $convoList.addEventListener("click", (e) => {
      const act = e.target.closest("[data-cv-act]");
      const item = e.target.closest(".convo");
      if (!item) return;
      const id = item.dataset.id;
      if (act) {
        e.stopPropagation();
        const a = act.getAttribute("data-cv-act");
        if (a === "pin") {
          const c = NS.store.getConversation(id);
          NS.store.pinConversation(id, !c.pinned);
          refreshSidebar();
        } else if (a === "rename") {
          const cur = NS.store.getConversation(id);
          const t = prompt("rename session:", cur.title || "");
          if (t != null) {
            NS.store.renameConversation(id, t.trim() || "untitled session");
            if (NS.store.getActive()?.id === id) $title.textContent = (t.trim() || "untitled session");
            refreshSidebar();
          }
        } else if (a === "del") {
          if (confirm("delete this session?")) {
            NS.store.deleteConversation(id);
            refreshSidebar();
            NS.chat.renderConversation(NS.store.getActive());
            syncFromState();
          }
        }
        return;
      }
      // open conversation
      NS.store.setActive(id);
      NS.chat.renderConversation(NS.store.getConversation(id));
      refreshSidebar();
      closeMobileSidebar();
    });
  }

  function refreshSidebar() {
    if (!$convoList) return;
    const q = ($search && $search.value || "").trim();
    let list = q ? NS.store.search(q) : NS.store.listConversations();
    if ($sideView === "pinned") list = list.filter(c => c.pinned);
    // (folders view not yet — show all for now)
    const activeId = NS.store.getActive()?.id;

    if (!list.length) {
      $convoList.innerHTML = `
        <div class="dim small" style="padding:10px 14px;font-family:var(--f-mono)">
          ${q ? "no matches" : "no sessions yet · open a new one"}
        </div>`;
      return;
    }

    $convoList.innerHTML = list.map((c) => {
      const last = c.messages[c.messages.length - 1];
      const sub = last ? truncate((last.content || "").replace(/\s+/g, " "), 56) : "empty session";
      return `
      <div class="convo ${c.pinned ? "pinned" : ""} ${c.id === activeId ? "active" : ""}" data-id="${c.id}" role="listitem">
        <span class="cv-mark"></span>
        <div class="cv-mid">
          <div class="cv-title">${escapeHtml(c.title || "untitled session")}</div>
          <div class="cv-sub">${escapeHtml(sub)} · ${timeAgo(c.updatedAt)}</div>
        </div>
        <div class="cv-act">
          <button class="icon-btn ghost" data-cv-act="pin" data-tip="${c.pinned ? "unpin" : "pin"}">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M14 3l7 7-4 1-1 4-7-7M5 19l4-4" stroke="currentColor" stroke-width="1.6" fill="${c.pinned ? "currentColor" : "none"}" stroke-linecap="round"/></svg>
          </button>
          <button class="icon-btn ghost" data-cv-act="rename" data-tip="rename">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 21h4l11-11-4-4L3 17v4z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
          </button>
          <button class="icon-btn ghost" data-cv-act="del" data-tip="delete">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>`;
    }).join("");
  }

  function openMobileSidebar() {
    $sidebar.classList.add("open");
    let bd = document.querySelector(".drawer-backdrop");
    if (!bd) {
      bd = document.createElement("div");
      bd.className = "drawer-backdrop";
      document.body.appendChild(bd);
      bd.addEventListener("click", closeMobileSidebar);
    }
    bd.classList.add("show");
  }
  function closeMobileSidebar() {
    $sidebar.classList.remove("open");
    const bd = document.querySelector(".drawer-backdrop");
    bd && bd.classList.remove("show");
  }

  // ============================================================
  // topbar
  // ============================================================
  function bindTopbar() {
    // intentional empty — handled by sub-binders
  }

  function bindEditableTitle() {
    $title.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); $title.blur(); }
      if (e.key === "Escape") {
        const c = NS.store.getActive();
        $title.textContent = c ? c.title : "untitled session";
        $title.blur();
      }
    });
    $title.addEventListener("blur", () => {
      const c = NS.store.getActive();
      if (!c) return;
      const t = ($title.textContent || "").trim() || "untitled session";
      NS.store.renameConversation(c.id, t);
      $title.textContent = t;
      refreshSidebar();
    });
  }

  // ============================================================
  // model picker
  // ============================================================
  function bindModelPicker() {
    // build menu
    const models = NS.ai.listModels();
    const groups = {};
    for (const m of models) {
      groups[m.group] = groups[m.group] || [];
      groups[m.group].push(m);
    }
    const orderedGroups = ["default", "reason", "claude", "gemini", "open"];
    let html = "";
    for (const g of orderedGroups) {
      if (!groups[g]) continue;
      html += `<div class="mp-section">${NS.ai.GROUP_LABELS[g] || g}</div>`;
      for (const m of groups[g]) {
        html += `
        <div class="mp-row" role="option" data-id="${escapeAttr(m.id)}">
          <span class="mp-ic">${initials(m.name)}</span>
          <div class="mp-mid">
            <div class="mp-name">${escapeHtml(m.name)}</div>
            <div class="mp-desc">${escapeHtml(m.desc)}${m.vision ? " · vision" : ""}</div>
          </div>
          <span class="mp-tag ${m.free ? "free" : ""}">${m.free ? "free" : "—"}</span>
        </div>`;
      }
    }
    $modelMenu.innerHTML = html;

    $modelPick.addEventListener("click", (e) => {
      e.stopPropagation();
      $modelPick.classList.toggle("open");
    });
    $modelMenu.addEventListener("click", (e) => {
      const row = e.target.closest(".mp-row");
      if (!row) return;
      const id = row.dataset.id;
      selectModel(id);
      $modelPick.classList.remove("open");
    });
    document.addEventListener("click", () => $modelPick.classList.remove("open"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $modelPick.classList.remove("open");
    });
  }

  function selectModel(id) {
    NS.store.setSettings({ model: id });
    const m = NS.ai.findModel(id);
    if ($modelLabel) $modelLabel.textContent = short(m.name);
    if ($metaModel)  $metaModel.textContent  = short(m.name);
    // mark
    $modelMenu.querySelectorAll(".mp-row").forEach((r) =>
      r.classList.toggle("active", r.dataset.id === id)
    );
    NS.toast && NS.toast.info(`model · ${m.name}`);
  }

  function initials(name) {
    return (name.match(/[A-Za-z0-9]/g) || []).slice(0, 2).join("").toUpperCase() || "AI";
  }
  function short(s) { return String(s).replace(/^.+\//, ""); }

  // ============================================================
  // mode strip + persona
  // ============================================================
  function bindModeStrip() {
    $modeStrip.forEach((c) => {
      c.addEventListener("click", () => {
        const mode = c.dataset.mode;
        if (!mode) return;
        setMode(mode);
      });
    });

    $personaBtn && $personaBtn.addEventListener("click", () => {
      // cycle persona
      const order = ["operator", "redteam", "architect", "ghost", "sensei"];
      const cur = NS.store.getSettings().persona || "operator";
      const next = order[(order.indexOf(cur) + 1) % order.length];
      NS.store.setSettings({ persona: next });
      $personaLabel.textContent = NS.ai.PERSONAS[next].label;
      NS.toast && NS.toast.info(`persona · ${NS.ai.PERSONAS[next].label}`);
    });
  }
  function setMode(mode) {
    $modeStrip.forEach((c) =>
      c.setAttribute("aria-pressed", String(c.dataset.mode === mode))
    );
    NS.store.setSettings({ mode });
  }

  // ============================================================
  // codex + focus
  // ============================================================
  function bindCodex() {
    $toggleCodex && $toggleCodex.addEventListener("click", () => {
      NS.codex && NS.codex.toggle();
    });
  }

  function bindFocusMode() {
    $toggleFocus && $toggleFocus.addEventListener("click", () => {
      $app.classList.toggle("focus");
      NS.toast && NS.toast.info($app.classList.contains("focus") ? "focus mode on" : "focus mode off");
    });
  }

  // ============================================================
  // settings modal
  // ============================================================
  function bindSettings() {
    $settingsBtn && $settingsBtn.addEventListener("click", () => openSettings());
    $settingsModal.querySelectorAll("[data-close]").forEach((el) =>
      el.addEventListener("click", () => closeModal())
    );
    $settingsSave && $settingsSave.addEventListener("click", () => {
      const s = {
        systemPrompt: document.getElementById("setting-system").value,
        persona:      document.getElementById("setting-persona").value,
        temperature:  parseFloat(document.getElementById("setting-temp").value),
        memory:       document.getElementById("setting-memory").value,
      };
      NS.store.setSettings(s);
      $personaLabel.textContent = NS.ai.PERSONAS[s.persona].label;
      closeModal();
      NS.toast && NS.toast.ok("settings saved");
    });
    document.getElementById("setting-temp").addEventListener("input", (e) => {
      document.getElementById("setting-temp-val").textContent = parseFloat(e.target.value).toFixed(1);
    });

    $wipeAll && $wipeAll.addEventListener("click", () => {
      if (!confirm("permanently wipe all sessions and memory?")) return;
      NS.store.wipeAll();
      NS.chat.renderConversation(null);
      refreshSidebar();
      closeModal();
      NS.toast && NS.toast.warn("all sessions wiped");
    });
  }
  function openSettings() {
    const s = NS.store.getSettings();
    document.getElementById("setting-system").value = s.systemPrompt || "";
    document.getElementById("setting-persona").value = s.persona || "operator";
    document.getElementById("setting-temp").value = s.temperature ?? 0.7;
    document.getElementById("setting-temp-val").textContent = (s.temperature ?? 0.7).toFixed(1);
    document.getElementById("setting-memory").value = s.memory || "on";
    $settingsModal.hidden = false;
  }
  function closeModal() { $settingsModal.hidden = true; }

  // ============================================================
  // import / export
  // ============================================================
  function bindImportExport() {
    $exportBtn && $exportBtn.addEventListener("click", () => {
      NS.store.downloadExport();
      NS.toast && NS.toast.ok("export downloaded");
    });
    $importBtn && $importBtn.addEventListener("click", () => $importFile.click());
    $importFile && $importFile.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      const txt = await f.text();
      const r = NS.store.importFromText(txt);
      if (r.ok) {
        NS.toast && NS.toast.ok(`imported · ${r.count} sessions`);
        refreshSidebar();
      } else {
        NS.toast && NS.toast.warn("import failed: " + r.error);
      }
    });
  }

  // ============================================================
  // donation — copy gcash
  // ============================================================
  function bindDonation() {
    if (!$gcashBadge) return;
    const number = ($gcashNum.textContent || "").replace(/\s+/g, "");
    function doCopy() {
      NS.md.copyText(number).then(() => {
        $gcashCopy.classList.add("copied");
        const span = $gcashCopy.querySelector("span");
        const orig = span ? span.textContent : "";
        if (span) span.textContent = "copied ✓";
        NS.toast && NS.toast.ok("GCash number copied · salamat 💚");
        setTimeout(() => {
          $gcashCopy.classList.remove("copied");
          if (span) span.textContent = orig;
        }, 1600);
      }).catch(() => {
        NS.toast && NS.toast.warn("copy failed — long-press the number");
      });
    }
    $gcashBadge.addEventListener("click", (e) => {
      // ignore inner button; it'll bubble
      doCopy();
    });
    $gcashBadge.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        doCopy();
      }
    });
  }

  // ============================================================
  // shortcuts
  // ============================================================
  function bindShortcuts() {
    document.addEventListener("keydown", (e) => {
      const meta = e.metaKey || e.ctrlKey;
      // ⌘/Ctrl + K — new chat
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const c = NS.store.createConversation();
        NS.chat.renderConversation(c);
        refreshSidebar();
        NS.chat.focusInput();
      }
      // ⌘/Ctrl + / — focus input
      if (meta && e.key === "/") {
        e.preventDefault();
        NS.chat.focusInput();
      }
      // ⌘/Ctrl + B — toggle sidebar (collapse on desktop, drawer on mobile)
      if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (window.matchMedia("(max-width: 880px)").matches) {
          if ($sidebar.classList.contains("open")) closeMobileSidebar();
          else openMobileSidebar();
        } else {
          $sbCollapse.click();
        }
      }
      // ⌘/Ctrl + L — open codex
      if (meta && e.key.toLowerCase() === "l") {
        e.preventDefault();
        NS.codex && NS.codex.toggle();
      }
    });
  }

  // ============================================================
  // mobile gestures (swipe right from edge → open sidebar; left → close)
  // ============================================================
  function bindMobileGestures() {
    if (!window.matchMedia("(max-width: 880px)").matches) return;

    let sx = 0, sy = 0, edge = false, opened = false;
    document.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY;
      edge = sx < 24;
      opened = $sidebar.classList.contains("open");
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      // we just compare endpoints in touchend
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
      const t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < 60 || Math.abs(dy) > 80) return;
      if (dx > 0 && edge && !opened) openMobileSidebar();
      if (dx < 0 && opened) closeMobileSidebar();
    }, { passive: true });
  }

  // ============================================================
  // toasts
  // ============================================================
  function toastApi() {
    return {
      ok: (m, t) => spawn("ok", m, t),
      info: (m, t) => spawn("info", m, t),
      warn: (m, t) => spawn("warn", m, t),
    };
    function spawn(kind, message, ttl = 2400) {
      const el = document.createElement("div");
      el.className = `toast ${kind}`;
      el.innerHTML = `<span class="toast-led"></span><span>${escapeHtml(message)}</span>`;
      $toasts.appendChild(el);
      setTimeout(() => {
        el.classList.add("out");
        setTimeout(() => el.remove(), 240);
      }, ttl);
    }
  }

  // ============================================================
  // sync from persisted state on load
  // ============================================================
  function syncFromState() {
    const s = NS.store.getSettings();
    if (s.sidebarCollapsed) $app.setAttribute("data-collapsed", "1");

    // mode
    $modeStrip.forEach((c) =>
      c.setAttribute("aria-pressed", String(c.dataset.mode === (s.mode || "default")))
    );

    // persona
    if (s.persona && $personaLabel && NS.ai.PERSONAS[s.persona]) {
      $personaLabel.textContent = NS.ai.PERSONAS[s.persona].label;
    }

    // model
    const m = NS.ai.findModel(s.model);
    if ($modelLabel) $modelLabel.textContent = short(m.name);
    if ($metaModel)  $metaModel.textContent  = short(m.name);
    // active row in menu
    if ($modelMenu) {
      $modelMenu.querySelectorAll(".mp-row").forEach((r) =>
        r.classList.toggle("active", r.dataset.id === m.id)
      );
    }

    // active conversation
    const conv = NS.store.getActive();
    if (conv) {
      $title.textContent = conv.title || "untitled session";
      NS.chat && NS.chat.renderConversation(conv);
    } else {
      NS.chat && NS.chat.renderConversation(null);
    }
  }

  // ============================================================
  // helpers
  // ============================================================
  function timeAgo(ts) {
    const d = (Date.now() - (ts || 0)) / 1000;
    if (d < 60)   return Math.floor(d) + "s";
    if (d < 3600) return Math.floor(d / 60) + "m";
    if (d < 86400) return Math.floor(d / 3600) + "h";
    if (d < 86400 * 7) return Math.floor(d / 86400) + "d";
    return new Date(ts).toLocaleDateString();
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // export
  NS.ui = {
    init,
    refreshSidebar,
    setMode,
    selectModel,
    openSettings,
  };
})();

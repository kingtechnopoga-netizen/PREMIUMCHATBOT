/* ============================================================
   NULLSEC · storage.js
   localStorage-first persistence · conversations · settings · memory
   import/export · folders · pinning
   ============================================================ */
(function () {
  "use strict";
  const NS = (window.NULLSEC = window.NULLSEC || {});

  const KEY = "nullsec.v1";
  const SCHEMA_VERSION = 1;

  const DEFAULTS = {
    version: SCHEMA_VERSION,
    activeId: null,
    conversations: [],
    settings: {
      systemPrompt: "",
      persona: "operator",
      temperature: 0.7,
      memory: "on",
      model: "gpt-5-nano",
      sidebarCollapsed: false,
      mode: "default",
    },
    memory: [],
  };

  // ---------- low-level ----------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      const parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch (e) {
      console.warn("[storage] load failed, resetting", e);
      return clone(DEFAULTS);
    }
  }
  function persist(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn("[storage] save failed", e);
      return false;
    }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function migrate(parsed) {
    // future-proof shell; ensure shape
    const merged = clone(DEFAULTS);
    if (parsed && typeof parsed === "object") {
      merged.version = SCHEMA_VERSION;
      merged.activeId = parsed.activeId || null;
      merged.conversations = Array.isArray(parsed.conversations) ? parsed.conversations : [];
      merged.settings = Object.assign({}, DEFAULTS.settings, parsed.settings || {});
      merged.memory = Array.isArray(parsed.memory) ? parsed.memory : [];
    }
    return merged;
  }

  let state = load();

  // helper id
  function uid() {
    return "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }
  function now() { return Date.now(); }

  // ---------- conversations ----------
  function listConversations() {
    return state.conversations.slice().sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }
  function getConversation(id) {
    return state.conversations.find(c => c.id === id) || null;
  }
  function createConversation(opts = {}) {
    const c = {
      id: uid(),
      title: opts.title || "untitled session",
      createdAt: now(),
      updatedAt: now(),
      model: opts.model || state.settings.model,
      mode: opts.mode || state.settings.mode,
      messages: [],
      pinned: false,
      folder: null,
    };
    state.conversations.unshift(c);
    state.activeId = c.id;
    persist(state);
    return c;
  }
  function setActive(id) {
    if (!getConversation(id)) return null;
    state.activeId = id;
    persist(state);
    return id;
  }
  function getActive() {
    if (!state.activeId) return null;
    return getConversation(state.activeId);
  }
  function ensureActive() {
    let c = getActive();
    if (!c) c = createConversation();
    return c;
  }
  function updateConversation(id, patch) {
    const c = getConversation(id);
    if (!c) return null;
    Object.assign(c, patch, { updatedAt: now() });
    persist(state);
    return c;
  }
  function renameConversation(id, title) {
    return updateConversation(id, { title: (title || "untitled session").slice(0, 80) });
  }
  function pinConversation(id, val) {
    return updateConversation(id, { pinned: !!val });
  }
  function deleteConversation(id) {
    const i = state.conversations.findIndex(c => c.id === id);
    if (i < 0) return false;
    state.conversations.splice(i, 1);
    if (state.activeId === id) {
      state.activeId = state.conversations[0] ? state.conversations[0].id : null;
    }
    persist(state);
    return true;
  }
  function wipeAll() {
    state.conversations = [];
    state.activeId = null;
    state.memory = [];
    persist(state);
  }

  // ---------- messages ----------
  function appendMessage(convId, msg) {
    const c = getConversation(convId);
    if (!c) return null;
    const m = {
      id: "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      role: msg.role,
      content: msg.content || "",
      attachments: msg.attachments || [],
      createdAt: now(),
      model: msg.model || null,
      mode: msg.mode || null,
      sources: msg.sources || null,
    };
    c.messages.push(m);
    c.updatedAt = now();
    persist(state);
    return m;
  }
  function patchMessage(convId, msgId, patch) {
    const c = getConversation(convId);
    if (!c) return null;
    const m = c.messages.find(x => x.id === msgId);
    if (!m) return null;
    Object.assign(m, patch);
    c.updatedAt = now();
    persist(state);
    return m;
  }
  function removeMessage(convId, msgId) {
    const c = getConversation(convId);
    if (!c) return false;
    const i = c.messages.findIndex(x => x.id === msgId);
    if (i < 0) return false;
    c.messages.splice(i, 1);
    c.updatedAt = now();
    persist(state);
    return true;
  }
  function popLast(convId) {
    const c = getConversation(convId);
    if (!c || !c.messages.length) return null;
    const m = c.messages.pop();
    c.updatedAt = now();
    persist(state);
    return m;
  }

  // ---------- settings ----------
  function getSettings() { return clone(state.settings); }
  function setSettings(patch) {
    Object.assign(state.settings, patch || {});
    persist(state);
    return getSettings();
  }

  // ---------- memory (AI long-term) ----------
  function listMemory() { return state.memory.slice().reverse(); }
  function addMemory(content) {
    if (!content || typeof content !== "string") return null;
    const item = {
      id: "mem_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      content: content.slice(0, 500),
      createdAt: now(),
    };
    state.memory.push(item);
    if (state.memory.length > 80) state.memory.shift(); // cap
    persist(state);
    return item;
  }
  function removeMemory(id) {
    const i = state.memory.findIndex(m => m.id === id);
    if (i < 0) return false;
    state.memory.splice(i, 1);
    persist(state);
    return true;
  }
  function getMemoryContext() {
    if (state.settings.memory !== "on") return "";
    if (!state.memory.length) return "";
    return state.memory.map(m => "- " + m.content).join("\n");
  }

  // ---------- search ----------
  function search(q) {
    if (!q) return listConversations();
    const needle = q.toLowerCase();
    return state.conversations.filter(c => {
      if ((c.title || "").toLowerCase().includes(needle)) return true;
      return c.messages.some(m => (m.content || "").toLowerCase().includes(needle));
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // ---------- import / export ----------
  function exportAll() {
    return {
      app: "NULLSEC",
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: clone(state),
    };
  }
  function downloadExport() {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nullsec-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function importFromText(txt) {
    try {
      const obj = JSON.parse(txt);
      const incoming = obj.data ? obj.data : obj;
      const next = migrate(incoming);
      // merge: append conversations not already present
      const existingIds = new Set(state.conversations.map(c => c.id));
      const merged = clone(state);
      for (const c of (next.conversations || [])) {
        if (!existingIds.has(c.id)) merged.conversations.unshift(c);
      }
      // memories
      const memIds = new Set(merged.memory.map(m => m.id));
      for (const m of (next.memory || [])) {
        if (!memIds.has(m.id)) merged.memory.push(m);
      }
      // settings: take incoming where present
      merged.settings = Object.assign({}, merged.settings, next.settings || {});
      state = merged;
      persist(state);
      return { ok: true, count: (next.conversations || []).length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ---------- export API ----------
  NS.store = {
    // conversations
    listConversations, getConversation, createConversation, setActive, getActive, ensureActive,
    updateConversation, renameConversation, pinConversation, deleteConversation, wipeAll,
    // messages
    appendMessage, patchMessage, removeMessage, popLast,
    // settings
    getSettings, setSettings,
    // memory
    listMemory, addMemory, removeMemory, getMemoryContext,
    // misc
    search, exportAll, downloadExport, importFromText,
    // raw
    _state: () => state,
  };
})();

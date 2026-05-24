/* ============================================================
   NULLSEC · main.js
   entry · boot · wire everything together
   ============================================================ */
(function () {
  "use strict";

  function ready(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb);
    } else { cb(); }
  }

  ready(async function () {
    const NS = window.NULLSEC || {};

    // 1) start ambient bg effects (independent of boot)
    try { NS.effects && NS.effects.start(); } catch (e) { console.warn(e); }

    // 2) cinematic boot sequence
    try { NS.effects && (await NS.effects.runBoot()); } catch (e) { console.warn(e); }

    // 3) initialize subsystems
    try { NS.codex && NS.codex.init(); } catch (e) { console.warn("codex init", e); }
    try { NS.chat  && NS.chat.init();  } catch (e) { console.warn("chat init",  e); }
    try { NS.ui    && NS.ui.init();    } catch (e) { console.warn("ui init",    e); }

    // 4) friendly online check
    if (typeof window.puter === "undefined") {
      NS.toast && NS.toast.warn("puter.js not loaded · check your network");
    } else {
      NS.toast && NS.toast.ok("nullsec online · choose a model and send", 3200);
    }

    // 5) global error guard — show as toast
    window.addEventListener("error", (e) => {
      // Avoid leaking sensitive errors via toast spam
      if (e && e.error && /puter/i.test(String(e.error.message || ""))) {
        NS.toast && NS.toast.warn("puter request failed · retry");
      }
    });

    // 6) avoid mobile pull-to-refresh inside chat scroll area
    const chat = document.getElementById("chat");
    if (chat) {
      chat.addEventListener("touchmove", (e) => {
        // allow native scroll; just ensure overscroll is contained
      }, { passive: true });
    }

    // 7) prevent zoom on double-tap on iOS for buttons / chips
    let lastTouchEnd = 0;
    document.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 320) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
  });
})();

/* ============================================================
   NULLSEC · main.js
   entry · boot · wire everything together
   ============================================================ */
(function () {
  "use strict";

  // EMERGENCY: ?reset wipes localStorage and reloads. Visit
  // https://nullsec.onrender.com/?reset if anything ever locks up.
  try {
    if (location.search.indexOf("reset") !== -1) {
      try { localStorage.clear(); } catch (_) {}
      try { sessionStorage.clear(); } catch (_) {}
      location.replace(location.origin + location.pathname);
      return;
    }
  } catch (_) {}

  function ready(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb);
    } else { cb(); }
  }

  function showApp() {
    const boot = document.getElementById("boot");
    const app = document.getElementById("app");
    if (boot && !boot.classList.contains("done")) {
      boot.classList.add("done");
      // Detach immediately on mobile so it can't capture taps.
      const isMobile = window.matchMedia("(max-width: 880px)").matches;
      setTimeout(() => boot && boot.remove(), isMobile ? 200 : 600);
    }
    if (app) {
      app.classList.add("ready");
      app.setAttribute("aria-hidden", "false");
    }
  }

  ready(async function () {
    const NS = window.NULLSEC || {};
    const isMobile = window.matchMedia("(max-width: 880px)").matches;

    // On mobile, skip the boot animation entirely — go straight to the app.
    if (isMobile) {
      showApp();
    }

    // Hard failsafe: app shell is visible after 1.2s no matter what.
    const FAILSAFE = setTimeout(showApp, 1200);

    // Tap-anywhere on the boot screen (and its document) to skip it instantly.
    const bootEl = document.getElementById("boot");
    if (bootEl) {
      const skipBoot = () => { clearTimeout(FAILSAFE); showApp(); };
      bootEl.addEventListener("click", skipBoot, { passive: true });
      bootEl.addEventListener("touchend", skipBoot, { passive: true });
    }

    // 1) start ambient bg effects (independent of boot)
    try { NS.effects && NS.effects.start(); } catch (e) { console.warn(e); }

    // 2) cinematic boot sequence (skipped on mobile via showApp() above)
    if (!isMobile) {
      try { NS.effects && (await NS.effects.runBoot()); } catch (e) { console.warn(e); }
    }

    clearTimeout(FAILSAFE);
    showApp();

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

    // 5) global error guard — show as toast (no spam)
    window.addEventListener("error", (e) => {
      if (e && e.error && /puter/i.test(String(e.error.message || ""))) {
        NS.toast && NS.toast.warn("puter request failed · retry");
      }
    });
  });
})();

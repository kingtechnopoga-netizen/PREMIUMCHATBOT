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

    // Safety net: even if anything below throws, the app shell becomes visible
    // after a hard 3.5s budget so the user never sees an empty boot screen.
    const FAILSAFE = setTimeout(() => {
      const boot = document.getElementById("boot");
      const app = document.getElementById("app");
      if (boot && !boot.classList.contains("done")) {
        boot.classList.add("done");
        setTimeout(() => boot.remove(), 700);
      }
      if (app) {
        app.classList.add("ready");
        app.setAttribute("aria-hidden", "false");
      }
    }, 3500);

    // 1) start ambient bg effects (independent of boot)
    try { NS.effects && NS.effects.start(); } catch (e) { console.warn(e); }

    // 2) cinematic boot sequence
    try { NS.effects && (await NS.effects.runBoot()); } catch (e) { console.warn(e); }

    clearTimeout(FAILSAFE);

    // ensure visible (idempotent if already done by failsafe)
    const app = document.getElementById("app");
    app && app.classList.add("ready");
    app && app.setAttribute("aria-hidden", "false");

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

    // 7) mobile keyboard tracking — keep composer above the keyboard
    if (window.visualViewport) {
      const composerWrap = document.querySelector(".composer-wrap");
      const updateKb = () => {
        const vh = window.visualViewport.height;
        const wh = window.innerHeight;
        const kbOpen = (wh - vh) > 140;
        document.body.classList.toggle("kb-open", kbOpen);
        if (composerWrap) {
          composerWrap.style.transform = kbOpen
            ? `translateY(${-(wh - vh - (window.visualViewport.offsetTop || 0))}px)`
            : "";
          composerWrap.style.transition = "transform 180ms cubic-bezier(.2,.7,.2,1)";
        }
      };
      window.visualViewport.addEventListener("resize", updateKb);
      window.visualViewport.addEventListener("scroll", updateKb);
    }

    // 8) lock orientation hint for old iOS where 100vh includes the URL bar
    const setVh = () => document.documentElement.style.setProperty("--vh-fix", `${window.innerHeight * 0.01}px`);
    setVh();
    window.addEventListener("resize", setVh, { passive: true });
    window.addEventListener("orientationchange", setVh);
  });
})();

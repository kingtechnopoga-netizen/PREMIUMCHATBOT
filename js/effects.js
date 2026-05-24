/* ============================================================
   NULLSEC · effects.js
   ambient particles · subtle matrix rain · boot sequence
   GPU-friendly · pauses when hidden · degrades on low-end
   ============================================================ */
(function () {
  "use strict";

  const NS = (window.NULLSEC = window.NULLSEC || {});

  // ---------- env ----------
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.matchMedia("(max-width: 880px)").matches;
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  const lowMem = (navigator.deviceMemory && navigator.deviceMemory <= 4) || isMobile;
  const dpr = Math.min(window.devicePixelRatio || 1, lowMem ? 1 : 2);
  // Disable heavy effects on mobile / touch / low-memory devices.
  // Subtle ambient (fog, noise, grid, scanlines) stays — those are CSS only.
  const HEAVY_OK = !reduceMotion && !isMobile && !isCoarse && !lowMem;

  // ---------- shared ----------
  let running = !document.hidden;
  document.addEventListener("visibilitychange", () => { running = !document.hidden; });

  function fitCanvas(canvas) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  // ============================================================
  // floating particles (soft dust + occasional connection lines)
  // ============================================================
  function startParticles() {
    const canvas = document.getElementById("bg-particles");
    if (!canvas) return;
    if (!HEAVY_OK) { canvas.style.display = "none"; return; }
    let ctx = fitCanvas(canvas);
    let W = canvas.clientWidth, H = canvas.clientHeight;

    const COUNT = 64;
    const particles = [];
    const mouse = { x: W / 2, y: H / 2, active: false };

    for (let i = 0; i < COUNT; i++) {
      particles.push(makeParticle());
    }
    function makeParticle() {
      const speed = 0.08 + Math.random() * 0.18;
      const angle = Math.random() * Math.PI * 2;
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 0.6 + Math.random() * 1.4,
        a: 0.18 + Math.random() * 0.45,
        hue: Math.random() < 0.7 ? 0 : (Math.random() < 0.5 ? 1 : 2),
        // 0=emerald,1=cyan,2=white
      };
    }

    const COLORS = [
      [44, 229, 160],
      [86, 182, 242],
      [240, 245, 250],
    ];

    function onResize() {
      ctx = fitCanvas(canvas);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
    }
    window.addEventListener("resize", onResize, { passive: true });

    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }, { passive: true });
    window.addEventListener("mouseout", () => { mouse.active = false; });

    let last = performance.now();
    function frame(t) {
      requestAnimationFrame(frame);
      if (!running) return;
      const dt = Math.min(40, t - last);
      last = t;

      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        // gentle parallax pull toward mouse
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 22000) {
            const f = (1 - d2 / 22000) * 0.0008 * dt;
            p.vx += dx * f;
            p.vy += dy * f;
          }
        }
        // damping
        p.vx *= 0.992;
        p.vy *= 0.992;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // wrap
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;

        const c = COLORS[p.hue];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${p.a})`;
        ctx.fill();

        if (p.r > 1.4) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${p.a * 0.06})`;
          ctx.fill();
        }
      }

      // sparse connection lines (only on desktop)
      if (HEAVY_OK) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
            const q = particles[j];
            const dx = p.x - q.x, dy = p.y - q.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 9000) {
              const a = (1 - d2 / 9000) * 0.07;
              ctx.strokeStyle = `rgba(120, 200, 180, ${a})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          }
        }
      }
    }
    requestAnimationFrame(frame);
  }

  // ============================================================
  // ultra-subtle matrix rain (low contrast, low density)
  // ============================================================
  function startMatrix() {
    const canvas = document.getElementById("bg-matrix");
    if (!canvas) return;
    let ctx = fitCanvas(canvas);
    let W = canvas.clientWidth, H = canvas.clientHeight;

    if (reduceMotion || !HEAVY_OK) return;

    const FONT = 13;
    const COL_W = 18;
    const cols = Math.ceil(W / COL_W);
    const drops = new Array(cols).fill(0).map(() => Math.random() * H);
    const speeds = new Array(cols).fill(0).map(() => 0.4 + Math.random() * 0.9);
    const glyphs = "01∆∇λΣΞΦΨΩ⊕⊗∂≡∞⌬⌘⏣☣☢";

    function onResize() {
      ctx = fitCanvas(canvas);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
    }
    window.addEventListener("resize", onResize, { passive: true });

    let frameNo = 0;
    function frame() {
      requestAnimationFrame(frame);
      if (!running) return;
      // Throttle to ~22fps for low overhead
      frameNo++;
      if (frameNo % 3 !== 0) return;

      // soft trail
      ctx.fillStyle = "rgba(4, 6, 10, 0.18)";
      ctx.fillRect(0, 0, W, H);

      ctx.font = `${FONT}px JetBrains Mono, monospace`;
      for (let i = 0; i < cols; i++) {
        const y = drops[i];
        const ch = glyphs[(Math.random() * glyphs.length) | 0];

        // head — emerald
        ctx.fillStyle = "rgba(44, 229, 160, 0.55)";
        ctx.fillText(ch, i * COL_W, y);

        // body — dim
        ctx.fillStyle = "rgba(44, 229, 160, 0.18)";
        ctx.fillText(ch, i * COL_W, y - FONT);

        drops[i] += speeds[i] * (FONT * 0.9);
        if (drops[i] > H + 60 && Math.random() < 0.94) {
          drops[i] = -Math.random() * 200;
        }
      }
    }
    requestAnimationFrame(frame);
  }

  // ============================================================
  // boot sequence — cinematic encrypted boot
  // ============================================================
  const BOOT_LINES = [
    { l: "info", t: "[boot]    initializing kernel…" },
    { l: "ok",   t: "[crypto]  loading aes-256-gcm" },
    { l: "ok",   t: "[crypto]  ed25519 keypair generated" },
    { l: "info", t: "[mesh]    establishing tor-like fallback channel" },
    { l: "ok",   t: "[mesh]    encrypted tunnel up · rtt 14ms" },
    { l: "info", t: "[ai]      probing puter.ai endpoints…" },
    { l: "ok",   t: "[ai]      gpt · claude · gemini · llama · grok detected" },
    { l: "info", t: "[mem]     mounting local-first vault" },
    { l: "ok",   t: "[mem]     vault unlocked · 0 entries" },
    { l: "info", t: "[ui]      compositing holographic shell" },
    { l: "ok",   t: "[ui]      shaders compiled · 60fps target locked" },
    { l: "warn", t: "[net]     stealth mode: no analytics, no telemetry" },
    { l: "ok",   t: "[boot]    ready · welcome, operator." },
  ];
  const STAGES = [
    "initializing kernel…",
    "negotiating cipher suites…",
    "spinning up agents…",
    "loading model registry…",
    "compositing shell…",
    "calibrating shaders…",
    "all systems green.",
  ];

  function runBoot() {
    const root = document.getElementById("boot");
    const log = document.getElementById("boot-log");
    const bar = document.getElementById("boot-bar");
    const pct = document.getElementById("boot-pct");
    const stage = document.getElementById("boot-stage");

    if (!root) return Promise.resolve();

    // skip when reduced motion
    if (reduceMotion) {
      bar.style.transition = "none";
      bar.style.width = "100%";
      pct.textContent = "100%";
      return new Promise(r => setTimeout(() => {
        root.classList.add("done");
        document.getElementById("app").classList.add("ready");
        document.getElementById("app").setAttribute("aria-hidden", "false");
        setTimeout(() => root.remove(), 700);
        r();
      }, 300));
    }

    return new Promise((resolve) => {
      let i = 0;
      const total = BOOT_LINES.length;
      // Faster on mobile so the boot screen doesn't linger.
      const stepDelay = (isMobile || isCoarse) ? 60 : 110;

      function tick() {
        if (i < total) {
          const cur = BOOT_LINES[i];
          const ts = formatTime();
          const ln = document.createElement("span");
          ln.className = "ln";
          ln.innerHTML =
            `<span class="ts">${ts}</span>` +
            `<span class="lvl ${cur.l}">${cur.l.toUpperCase().padEnd(5, " ")}</span> ` +
            escapeHtml(cur.t);
          log.appendChild(ln);
          // keep last lines visible
          while (log.childNodes.length > 9) log.removeChild(log.firstChild);

          const p = Math.round(((i + 1) / total) * 100);
          bar.style.width = p + "%";
          pct.textContent = String(p).padStart(2, "0") + "%";
          stage.textContent = STAGES[Math.min(STAGES.length - 1, Math.floor((i + 1) / total * STAGES.length))];

          i++;
          setTimeout(tick, stepDelay + Math.random() * 40);
        } else {
          stage.textContent = "ready.";
          setTimeout(() => {
            root.classList.add("done");
            const app = document.getElementById("app");
            app && app.classList.add("ready");
            app && app.setAttribute("aria-hidden", "false");
            setTimeout(() => { root && root.parentNode && root.remove(); resolve(); }, 500);
          }, 200);
        }
      }
      tick();
    });
  }

  function formatTime() {
    const d = new Date();
    return (
      String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0") + ":" +
      String(d.getSeconds()).padStart(2, "0") + "." +
      String(d.getMilliseconds()).padStart(3, "0")
    );
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // ============================================================
  // pointer halo on cards (welcome prompt cards)
  // ============================================================
  function bindCardHalo() {
    document.addEventListener("pointermove", (e) => {
      const t = e.target.closest(".prompt-card, .glowable, .convo");
      if (!t) return;
      const r = t.getBoundingClientRect();
      const mx = ((e.clientX - r.left) / r.width) * 100;
      const my = ((e.clientY - r.top) / r.height) * 100;
      t.style.setProperty("--mx", mx + "%");
      t.style.setProperty("--my", my + "%");
    }, { passive: true });
  }

  // ============================================================
  // export
  // ============================================================
  NS.effects = {
    start() {
      startParticles();
      startMatrix();
      bindCardHalo();
    },
    runBoot,
  };
})();

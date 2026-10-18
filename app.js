/* Life Choices: app logic. Plain JS, no build step. Story text lives in stories.js. */
(function () {
  "use strict";

  const STORIES = window.STORIES;
  const TOTAL = 10;
  const DEV_QUESTION = "What happens next?";

  /* Accessory = person. Fixed mapping, left-to-right order on the start screen. */
  const ACCESSORIES = [
    { id: "glasses", alt: "Round glasses",  story: "rowling" },
    { id: "dothat",  alt: "Polka-dot hat",  story: "kusama" },
    { id: "flowers", alt: "Flower crown",   story: "frida" },
    { id: "bow",     alt: "Bow tie",        story: "montessori" }
  ];
  const ACC = Object.fromEntries(ACCESSORIES.map(a => [a.id, a]));
  const ASSET_VERSION = 3; // bump when an image changes so browsers skip their cached copy
  const accSrc = id => `assets/accessories/${id}.png?v=${ASSET_VERSION}`;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- State ---------- */
  // view: home | question | ending | reveal
  // order: left/right order for the current main question, fixed while it is shown.
  // log:   { q, pick: "a"|"b", text } for main questions, { q, dev: true, idx, text } for deviations.
  let state = { view: "home", equip: null, storyId: null, qIndex: 0, devMode: false, order: null, log: [], ending: null };
  let busy = false; // blocks double clicks during the press animation

  const app = document.getElementById("app");
  const bg = document.getElementById("bg");

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Fallback SVG icons (from the prototype) ---------- */
  function iconSVG(id, label) {
    const a = label ? `role="img" aria-label="${esc(label)}"` : `aria-hidden="true"`;
    if (id === "glasses") return `<svg viewBox="0 0 60 60" ${a}><circle cx="18" cy="30" r="11" fill="none" stroke="#3f7cc1" stroke-width="4"/><circle cx="42" cy="30" r="11" fill="none" stroke="#3f7cc1" stroke-width="4"/><line x1="29" y1="30" x2="31" y2="30" stroke="#3f7cc1" stroke-width="4"/></svg>`;
    if (id === "dothat") return `<svg viewBox="0 0 60 60" ${a}><path d="M8 40 Q30 6 52 40 Z" fill="#d64545" stroke="#444" stroke-width="2"/><circle cx="20" cy="30" r="3" fill="#fff"/><circle cx="30" cy="22" r="3" fill="#fff"/><circle cx="40" cy="30" r="3" fill="#fff"/></svg>`;
    if (id === "flowers") return `<svg viewBox="0 0 60 60" ${a}><circle cx="10" cy="34" r="6" fill="#e86a92"/><circle cx="18" cy="22" r="6" fill="#f5c542"/><circle cx="30" cy="16" r="6" fill="#e86a92"/><circle cx="42" cy="22" r="6" fill="#f5c542"/><circle cx="50" cy="34" r="6" fill="#e86a92"/></svg>`;
    if (id === "bow") return `<svg viewBox="0 0 60 60" ${a}><path d="M30 30 L10 20 L10 40 Z" fill="#3a8f5c" stroke="#444" stroke-width="2"/><path d="M30 30 L50 20 L50 40 Z" fill="#3a8f5c" stroke="#444" stroke-width="2"/><circle cx="30" cy="30" r="4" fill="#222"/></svg>`;
    return "";
  }

  // Remember which image files failed so later renders go straight to the SVG.
  const missing = new Set();
  function accImg(id, alt) {
    if (missing.has(accSrc(id))) return iconSVG(id, alt);
    return `<img src="${accSrc(id)}" alt="${esc(alt)}" draggable="false" data-fallback="acc:${id}">`;
  }
  // Swap any image that fails to load for its SVG fallback (error events don't bubble, so capture).
  document.addEventListener("error", e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
    missing.add(img.getAttribute("src"));
    const id = img.dataset.fallback.split(":")[1];
    img.insertAdjacentHTML("afterend", iconSVG(id, img.alt));
    img.remove();
  }, true);

  /* ---------- Rendering ---------- */
  function render() {
    const v = state.view;
    app.innerHTML = v === "home" ? renderHome() : v === "question" ? renderQuestion() : v === "ending" ? renderEnding() : renderReveal();
    bg.className = v === "home" ? "" : `path-${state.storyId}`;
    document.body.style.background = v === "home" ? "" : "transparent";
    if (v === "home") bindHome();
  }

  function go(view) {
    state.view = view;
    render();
    window.scrollTo(0, 0);
    // Move focus to the new screen for keyboard and screen-reader users.
    const first = app.querySelector(".scene, .reveal h1, .ending p");
    if (first) { first.setAttribute("tabindex", "-1"); first.focus({ preventScroll: true }); }
  }

  /* ---------- Start screen ----------
     One line, like the reference: "Life  [4 accessories]  Choices".
     Clicking an accessory starts that person's path straight away. */
  function renderHome() {
    const items = ACCESSORIES.map(a => `
      <button type="button" class="acc" data-acc="${a.id}">${accImg(a.id, a.alt)}</button>`).join("");
    // Each word carries a zero-size baseline marker so fitTitle() can find where its capitals sit.
    return `
      <section class="screen home">
        <h1 class="sr-only">Life Choices</h1>
        <div class="title" id="title">
          <span class="word" aria-hidden="true">Life<i class="bl"></i></span>
          <span class="row" role="group" aria-label="Choose an accessory">${items}</span>
          <span class="word" aria-hidden="true">Choices<i class="bl"></i></span>
        </div>
        <footer class="home-foot">
          <p class="network">International Mental Health Network for Expatriates</p>
          <p class="disclaimer">Everyone faces hard moments. Choose a path and see where it leads.</p>
        </footer>
      </section>`;
  }

  /* Size the title line so it fills the width. Accessories are 10% taller than the
     tallest letters (L, f, h: baseline to the top of the ascenders; see --acc-scale in
     styles.css), and letters and accessories share one centre line.
     Desktop: one line "Life [4 accessories] Choices". Narrow screens: three stacked lines,
     each as wide as the widest of them allows. */
  const measureCtx = document.createElement("canvas").getContext("2d");
  function fitTitle() {
    const title = document.getElementById("title");
    if (!title) return;
    const words = [...title.querySelectorAll(".word")];
    const row = title.querySelector(".row");
    const BASE = 100;

    // 1. Letter height of the font actually in use (top of "L", "f", "h" to the baseline),
    //    as a fraction of the font size. Accessories are sized from this height.
    const cs = getComputedStyle(words[0]);
    measureCtx.font = `${cs.fontWeight} ${BASE}px ${cs.fontFamily}`;
    const capRatio = (measureCtx.measureText("Lfh").actualBoundingBoxAscent / BASE) || 0.74;
    title.style.setProperty("--cap", capRatio);

    // 2. Measure everything at a known size, then scale to the available width.
    words.forEach(w => { w.style.transform = ""; });
    title.style.fontSize = BASE + "px";
    const avail = title.clientWidth;
    const gap = parseFloat(getComputedStyle(title).columnGap) || 0;
    const ww = words.map(w => w.getBoundingClientRect().width);
    const rw = row.getBoundingClientRect().width;
    const stacked = getComputedStyle(title).flexDirection === "column";
    const needed = stacked ? Math.max(ww[0], ww[1], rw) : ww[0] + ww[1] + rw + 2 * gap;
    let size = BASE * avail / needed;
    // Keep the line from growing taller than about half the screen on very wide, short windows.
    size = Math.min(size, (window.innerHeight * (stacked ? 0.2 : 0.45)) / capRatio);
    title.style.fontSize = size.toFixed(2) + "px";

    // 3. Shift each word so the middle of its letters sits on the row's centre line.
    if (!stacked) {
      const rowBox = row.getBoundingClientRect();
      const centre = rowBox.top + rowBox.height / 2;
      const capH = capRatio * size;
      words.forEach(w => {
        const baseline = w.querySelector(".bl").getBoundingClientRect().top;
        w.style.transform = `translateY(${(centre - (baseline - capH / 2)).toFixed(2)}px)`;
      });
    }
  }
  let fitQueued = false;
  const queueFit = () => {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => { fitQueued = false; fitTitle(); });
  };
  window.addEventListener("resize", queueFit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueFit);

  function bindHome() {
    // Refit whenever an accessory changes size (e.g. its image finishes loading; its width
    // depends on its proportions). The fit is idempotent, so the observer settles at once.
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(queueFit);
      app.querySelectorAll(".acc").forEach(el => ro.observe(el));
    }
    app.querySelectorAll(".acc img").forEach(img => {
      img.addEventListener("load", queueFit);
      img.addEventListener("error", queueFit);
    });
    window.addEventListener("load", queueFit, { once: true });
    fitTitle();
    app.querySelectorAll(".acc").forEach(el => {
      el.addEventListener("click", () => {
        if (busy) return;
        state.equip = el.dataset.acc;
        if (reduceMotion.matches) return startPath();
        // Short spring bounce on the chosen accessory, then into the path.
        busy = true;
        el.classList.add("picked");
        setTimeout(() => { busy = false; startPath(); }, 420);
      });
    });
  }

  /* ---------- Path flow ---------- */
  function startPath() {
    if (!state.equip) return;
    state.storyId = ACC[state.equip].story;   // the accessory always opens its own person's path
    state.log = [];
    state.ending = null;
    showMain(0);
  }

  function showMain(i) {
    if (i >= TOTAL) return go("reveal");
    state.qIndex = i;
    state.devMode = false;
    state.order = Math.random() < 0.5 ? ["a", "b"] : ["b", "a"]; // decided once, when the question appears
    go("question");
  }

  function renderQuestion() {
    const s = STORIES[state.storyId];
    const q = s.questions[state.qIndex];
    let scene, question, opts;
    if (!state.devMode) {
      scene = q.scene;
      question = q.q;
      opts = state.order.map(k => ({ key: k, text: q[k] }));
    } else {
      scene = q.dev.t;
      question = DEV_QUESTION;
      opts = q.dev.o.map((o, i) => ({ key: String(i), text: o[0] }));
    }
    // Progress dots: past questions filled, the current one stretched into a pill.
    const dots = Array.from({ length: TOTAL }, (_, i) =>
      `<span class="dot ${i < state.qIndex ? "done" : i === state.qIndex ? "now" : ""}"></span>`).join("");
    return `
      <section class="screen path q-screen" aria-labelledby="qtext">
        <header class="q-top">
          <button type="button" class="back" data-home aria-label="Back to start">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="dots" role="progressbar" aria-valuemin="1" aria-valuemax="${TOTAL}" aria-valuenow="${state.qIndex + 1}" aria-label="Question ${state.qIndex + 1} of ${TOTAL}">${dots}</div>
          <span class="q-top-spacer" aria-hidden="true"></span>
        </header>

        <div class="q-body">
          <!-- Scene and question read as one paragraph; the question closes it. -->
          <h1 class="scene" id="qtext">${esc(scene)} <span class="question">${esc(question)}</span></h1>
          <div class="choices">
            ${opts.map(o => `<button type="button" class="choice" data-key="${o.key}">${esc(o.text)}</button>`).join("")}
          </div>
        </div>

        <p class="heads">${esc(s.heads)}</p>
      </section>`;
  }

  // Quick squash, then move on. No selected/disabled styling is ever applied.
  function press(btn, fn) {
    if (busy) return;
    busy = true;
    const done = () => { busy = false; fn(); };
    if (reduceMotion.matches) return done();
    btn.classList.add("press");
    setTimeout(done, 120);
  }

  function choose(key) {
    const q = STORIES[state.storyId].questions[state.qIndex];
    if (!state.devMode) {
      state.log.push({ q: state.qIndex, pick: key, text: q[key] });
      if (key === "a") return showMain(state.qIndex + 1);
      state.devMode = true;            // "b" opens the deviation screen for the same question
      return go("question");
    }
    const idx = Number(key);
    const [text, target] = q.dev.o[idx];
    state.log.push({ q: state.qIndex, dev: true, idx, text });
    if (typeof target === "string" && target.startsWith("E:")) {
      state.ending = target.slice(2);
      return go("ending");
    }
    showMain(Number(target));
  }

  /* ---------- Ending ---------- */
  function renderEnding() {
    return `
      <section class="screen path center ending">
        <div class="card"><p style="margin:0" tabindex="-1">${esc(state.ending)}</p></div>
        <div class="actions"><button type="button" class="btn" data-reveal>See the reveal</button></div>
      </section>`;
  }

  /* ---------- Reveal ---------- */
  function renderReveal() {
    const s = STORIES[state.storyId];
    const mains = state.log.filter(x => !x.dev);
    const same = mains.filter(x => x.pick === "a").length;

    const rows = mains.map(x => {
      const q = s.questions[x.q];
      let body;
      if (x.pick === "a") {
        body = `<p>You made the same choice she did.</p>`;
      } else {
        body = `<p class="label">What she actually did</p><p>${esc(q.a)}</p>`;
      }
      return `
        <article class="card">
          <p class="small-muted">${esc(q.q)}</p>
          <p class="label">Your choice</p><p>${esc(x.text)}</p>
          ${body}
        </article>`;
    }).join("");

    return `
      <section class="screen path reveal stack">
        <div class="card">
          <h1>Thank you for taking part.</h1>
          <p>The path you walked belongs to ${esc(s.name)}.</p>
          <p>You made the same choice she did ${same} of ${mains.length} times. This is an observation, not a score. There is no right or wrong.</p>
        </div>
        ${rows}
        <div class="card"><h2>Facts from her life</h2><ul>${s.reveal.facts.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>
        <div class="card"><h2>A psychological perspective</h2><p>${esc(s.reveal.psych)}</p></div>
        <div class="card"><h2>Closing</h2><p>${esc(s.reveal.closing)}</p></div>
        <div class="actions">
          <button type="button" class="btn" data-again>Walk this path again</button>
          <button type="button" class="btn ghost" data-home>Try another accessory</button>
        </div>
      </section>`;
  }

  /* ---------- Delegated clicks for path screens ---------- */
  app.addEventListener("click", e => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.classList.contains("choice")) return press(t, () => choose(t.dataset.key));
    if (t.hasAttribute("data-reveal")) return go("reveal");
    if (t.hasAttribute("data-again")) return startPath();
    if (t.hasAttribute("data-home")) {
      // Progress is discarded; the chosen accessory stays selected so it can be swapped.
      state = { view: "home", equip: state.equip, storyId: null, qIndex: 0, devMode: false, order: null, log: [], ending: null };
      return go("home");
    }
  });

  render();
})();

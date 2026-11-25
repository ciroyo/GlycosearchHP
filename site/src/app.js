// Glycosearch front-end behaviour. Everything here is progressive enhancement:
// pages, links, PDFs and downloads work without this file.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const CFG = JSON.parse($("#site-config").textContent);
const BASE = new URL(".", import.meta.url);

/* ---------- theme: light / dark ---------- */
// The <head> script has already applied the stored choice or the system setting. A click stores an explicit choice;
// without one the page keeps following the system setting. Switching only changes an attribute: no reload,
// so a running video, its sound setting and open dialogs are not touched.
{
  const root = document.documentElement, btn = $("[data-theme-toggle]"), meta = $('meta[name="theme-color"]');
  const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  const stored = () => { try { const t = localStorage.getItem("gs-theme"); return t === "light" || t === "dark" ? t : null; } catch { return null; } };
  const paint = (t) => {
    root.setAttribute("data-theme", t);
    if (meta) meta.content = t === "dark" ? "#131518" : "#faf9f6";
    if (btn) { const next = t === "dark" ? "light" : "dark"; btn.setAttribute("aria-label", `Switch to ${next} theme`); btn.dataset.tip = `Switch to ${next} theme`; btn.setAttribute("aria-pressed", String(t === "dark")); }
  };
  paint(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
  btn?.addEventListener("click", () => {
    const t = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem("gs-theme", t); } catch { /* storage blocked: the choice lasts for this page */ }
    paint(t);
  });
  mq?.addEventListener?.("change", (e) => { if (!stored()) paint(e.matches ? "dark" : "light"); });
  addEventListener("storage", (e) => { if (e.key === "gs-theme" && stored()) paint(stored()); });
}

/* ---------- navigation ---------- */
const navToggle = $(".nav-toggle"), nav = $("#nav");
navToggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (e) => { const b = e.target.closest("[data-close-dialog]"); if (b) b.closest("dialog").close(); });

/* ---------- publications: search + filters, state kept in the URL ---------- */
const pubForm = $("#pub-filter");
if (pubForm) initPublications();
async function initPublications() {
  const { tokens, norm } = await import(new URL("search.js", BASE));
  const lists = $$("[data-list]").map((el) => ({ el, name: el.dataset.list, total: +el.dataset.total }));
  const rows = $$("[data-list] .pub").map((el) => ({ el, list: el.closest("[data-list]").dataset.list, cats: new Set(el.dataset.cats.split(" ")), hay: new Set(tokens(el.dataset.hay)), text: norm(el.dataset.hay) }));
  const GROUPS = new Set(["type", "topic"]); // filter groups that exist; older links may still carry others (e.g. role=first)
  const q = $("#pub-q"), count = $("#pub-count"), reset = $("#pub-reset"), empty = $("#pub-empty");
  const chips = $$(".chip", pubForm);
  const state = () => ({ q: q.value.trim(), f: chips.filter((c) => c.getAttribute("aria-pressed") === "true").map((c) => [c.dataset.filter, c.dataset.value]) });
  function apply(push) {
    const s = state();
    const qt = tokens(s.q);
    const n = {};
    for (const r of rows) {
      const okF = s.f.every(([, v]) => r.cats.has(v));
      const okQ = qt.every((t) => r.hay.has(t) || r.text.includes(t));
      r.el.hidden = !(okF && okQ);
      if (!r.el.hidden) n[r.list] = (n[r.list] || 0) + 1;
    }
    for (const l of lists) l.el.hidden = !(n[l.name] > 0);
    count.textContent = lists.map((l) => `${n[l.name] || 0} of ${l.total} ${l.name === "patents" ? (l.total === 1 ? "patent" : "patents") : l.name}`).join(" · ");
    empty.hidden = rows.some((r) => !r.el.hidden);
    reset.hidden = !(s.q || s.f.length);
    if (push) {
      const p = new URLSearchParams();
      if (s.q) p.set("q", s.q);
      for (const [k, v] of s.f) p.append(k, v);
      const qs = p.toString();
      history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
    }
  }
  function fromUrl() {
    const p = new URLSearchParams(location.search);
    q.value = p.get("q") || "";
    for (const c of chips) c.setAttribute("aria-pressed", String(p.getAll(c.dataset.filter).includes(c.dataset.value)));
    // parameters of removed filter groups must not filter invisibly: drop them from the address
    apply([...p.keys()].some((k) => k !== "q" && k !== "hl" && !GROUPS.has(k)));
  }
  q.addEventListener("input", () => apply(true));
  pubForm.addEventListener("submit", (e) => e.preventDefault());
  for (const c of chips) c.addEventListener("click", () => { c.setAttribute("aria-pressed", String(c.getAttribute("aria-pressed") !== "true")); apply(true); });
  reset.addEventListener("click", () => { q.value = ""; chips.forEach((c) => c.setAttribute("aria-pressed", "false")); apply(true); q.focus(); });
  addEventListener("popstate", fromUrl);
  fromUrl();
  flashHash();
}
function flashHash() {
  const el = location.hash && document.getElementById(location.hash.slice(1));
  if (el && el.matches("li, .card")) { el.hidden = false; el.classList.add("flash"); el.scrollIntoView({ block: "center" }); }
}
if (!pubForm) addEventListener("DOMContentLoaded", flashHash), flashHash();
// highlight a requested action on arrival, e.g. /publications/frapbot/?hl=code
{
  const hl = new URLSearchParams(location.search).getAll("hl");
  if (hl.length) for (const a of $$(".detail [data-action]")) if (hl.includes(a.dataset.action)) a.classList.add("wanted");
}

/* ---------- gallery + lightbox ---------- */
const lb = $("#lightbox");
for (const g of $$("[data-gallery]")) {
  const items = $$("[data-g-thumb]", g).map((b) => ({ b, full: b.dataset.full, w: b.dataset.w, h: b.dataset.h, orig: b.dataset.orig, cap: b.dataset.cap || "" }));
  const main = $("[data-g-main]", g), cnt = $("[data-g-count]", g), orig = $("[data-g-orig]", g), cap = $("[data-g-cap]", g);
  const unit = g.dataset.unit || "Image", title = g.dataset.title || "", paged = unit === "Page";
  let i = 0;
  const show = (n) => {
    i = (n + items.length) % items.length;
    const it = items[i];
    main.src = it.full; main.width = it.w; main.height = it.h;
    main.alt = `${unit} ${i + 1} of ${items.length}: ${title}`;
    cnt.textContent = `${unit} ${i + 1} of ${items.length}`;
    orig.href = it.orig;
    if (cap) { cap.textContent = it.cap; cap.hidden = !it.cap; }
    items.forEach((x, k) => x.b.tagName === "BUTTON" && (k === i ? x.b.setAttribute("aria-current", "true") : x.b.removeAttribute("aria-current")));
    if (it.b.tagName === "BUTTON") { const st = it.b.closest(".strip"); if (st && st.scrollWidth > st.clientWidth) st.scrollLeft = it.b.offsetLeft - st.offsetLeft - st.clientWidth / 2 + it.b.offsetWidth / 2; }
    if (lb.open) paintLb();
  };
  const paintLb = () => {
    const it = items[i];
    $("[data-lb-img]", lb).src = it.full; $("[data-lb-img]", lb).alt = main.alt; $("[data-lb-img]", lb).classList.remove("clear");
    $("[data-lb-count]", lb).textContent = `${unit} ${i + 1} of ${items.length}` + (it.cap ? " · " + it.cap : "");
    $("[data-lb-orig]", lb).href = it.orig; $("[data-lb-orig]", lb).hidden = false; $("[data-lb-orig]", lb).textContent = paged ? "Open in PDF" : "Open original";
    lbZoom(false); $(".view", lb).scrollTop = 0;
    $("[data-lb-prev]", lb).hidden = $("[data-lb-next]", lb).hidden = items.length < 2;
  };
  items.forEach((x, k) => x.b.addEventListener?.("click", () => show(k)));
  for (const o of $$("[data-g-open]", g)) o.addEventListener("click", () => { paintLb(); lb.showModal(); });
  $("[data-g-prev]", g)?.addEventListener("click", () => show(i - 1));
  $("[data-g-next]", g)?.addEventListener("click", () => show(i + 1));
  $(".stage", g).addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(i - 1); if (e.key === "ArrowRight") show(i + 1); });
  $("[data-lb-prev]", lb).addEventListener("click", () => show(i - 1));
  $("[data-lb-next]", lb).addEventListener("click", () => show(i + 1));
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(i - 1); if (e.key === "ArrowRight") show(i + 1); });
}
// "Actual size": the image is shown at its own pixel size and can be scrolled; default is fit-to-screen
function lbZoom(on) {
  const v = $(".view", lb), im = $("[data-lb-img]", lb), b = $("[data-lb-zoom]", lb);
  v.classList.toggle("zoomed", on); b.setAttribute("aria-pressed", String(on));
  im.style.width = on && im.naturalWidth ? im.naturalWidth + "px" : "";
}
$("[data-lb-zoom]", lb)?.addEventListener("click", () => lbZoom(!$(".view", lb).classList.contains("zoomed")));
$("[data-lb-img]", lb)?.addEventListener("click", (e) => { e.stopPropagation(); lbZoom(!$(".view", lb).classList.contains("zoomed")); });
$("[data-lb-close]", lb)?.addEventListener("click", () => lb.close());
// single figures (home, learning): enlarge in the same viewer
document.addEventListener("click", (e) => {
  const z = e.target.closest("[data-zoom]");
  if (!z || !lb) return;
  const im = $("img", z);
  $("[data-lb-img]", lb).src = z.dataset.zoom; $("[data-lb-img]", lb).alt = im?.alt || "";
  $("[data-lb-count]", lb).textContent = im?.alt || "";
  $("[data-lb-orig]", lb).href = z.dataset.zoomOrig || z.dataset.zoom; $("[data-lb-orig]", lb).textContent = "Open original"; lbZoom(false);
  $("[data-lb-img]", lb).classList.toggle("clear", z.classList.contains("plain")); // transparent figure made for the dark viewer
  $("[data-lb-prev]", lb).hidden = $("[data-lb-next]", lb).hidden = true;
  lb.showModal();
});
lb?.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("view")) lb.close(); });

/* ---------- home video ---------- */
// The film is only available as a YouTube video, so it runs in YouTube's player (IFrame API) without YouTube's
// control bar; play/pause, replay and sound are our own buttons next to the caption (always reachable by mouse,
// keyboard and touch; quieter until the figure is hovered or focused). They mirror the player's real state, which
// is polled because the player has no mute event. Sound is only switched on by a click. When the film has ended,
// the player is taken out of view and a poster with a Replay button is shown instead of YouTube's end screen;
// nothing restarts by itself. If the player or the video cannot be loaded, the plain link to the video stays.
// What cannot be controlled from here: title and logo that YouTube shows inside its own frame.
for (const frame of $$("[data-yt]")) {
  const fig = frame.closest("figure"), snd = $("[data-yt-sound]", fig), playBtn = $("[data-yt-play]", fig), replay = $("[data-yt-replay]", fig);
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let player = null, timer = null, failed = false, ready = false;
  const set = (btn, icon, label) => { if (btn.dataset.state !== label) { btn.dataset.state = label; btn.innerHTML = CFG.icons[icon]; btn.setAttribute("aria-label", label); btn.dataset.tip = label; } };
  const fail = () => { failed = true; clearInterval(timer); frame.classList.remove("ready", "ended"); const f = $("iframe", frame); if (f) f.hidden = true; snd.hidden = playBtn.hidden = replay.hidden = true; frame.dataset.ytState = "failed"; };
  const sync = () => {
    if (!player || failed || typeof player.isMuted !== "function") return;
    const st = player.getPlayerState(), name = ["unstarted", "ended", "playing", "paused", "buffering", "", "cued"][st + 1] || "";
    const muted = player.isMuted() || player.getVolume() === 0, running = st === 1 || st === 3;
    set(snd, muted ? "soundOff" : "soundOn", muted ? "Turn sound on" : "Mute sound");
    set(playBtn, running ? "pause" : st === 0 ? "replay" : "play", running ? "Pause video" : st === 0 ? "Replay video" : "Play video");
    frame.dataset.ytState = name;
    const ended = st === 0;
    if (frame.classList.contains("ended") !== ended) { frame.classList.toggle("ended", ended); replay.hidden = !ended; }
  };
  const again = () => { frame.classList.remove("ended"); replay.hidden = true; player.seekTo(0, true); player.playVideo(); setTimeout(sync, 80); };
  snd.addEventListener("click", () => {
    if (!player || failed) return;
    if (player.isMuted() || player.getVolume() === 0) { player.unMute(); if (player.getVolume() === 0) player.setVolume(60); } else player.mute();
    setTimeout(sync, 60);
  });
  playBtn.addEventListener("click", () => {
    if (!player || failed) return;
    const st = player.getPlayerState();
    if (st === 0) again(); else if (st === 1 || st === 3) player.pauseVideo(); else player.playVideo();
    setTimeout(sync, 80);
  });
  replay.addEventListener("click", () => { if (player && !failed) { again(); playBtn.focus(); } });
  const start = () => {
    const mount = document.createElement("div"); frame.prepend(mount);
    try {
      player = new window.YT.Player(mount, {
        videoId: frame.dataset.yt, host: "https://www.youtube-nocookie.com", width: "100%", height: "100%",
        playerVars: { autoplay: reduce ? 0 : 1, mute: 1, playsinline: 1, controls: 0, rel: 0, iv_load_policy: 3, origin: location.origin },
        events: {
          onReady: (ev) => { ready = true; ev.target.mute(); ev.target.getIframe().title = frame.dataset.ytTitle || "Video"; frame.classList.add("ready"); snd.hidden = playBtn.hidden = false; sync(); timer = setInterval(sync, 500); if (!reduce) ev.target.playVideo(); },
          onStateChange: sync,
          onAutoplayBlocked: sync, // stays "unstarted": the Play button (ours) or a click on the film starts it
          onError: fail,
        },
      });
    } catch { fail(); }
  };
  // a slow connection must not discard a player that is still loading: give up only if the API never arrived
  setTimeout(() => { if (!ready && !failed && !(window.YT && window.YT.Player)) fail(); }, 15000);
  if (window.YT?.Player) start();
  else {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); start(); };
    const sc = document.createElement("script"); sc.src = "https://www.youtube.com/iframe_api"; sc.async = true; sc.onerror = fail;
    document.head.append(sc);
  }
}

/* ---------- glycan nomenclature ---------- */
for (const n of $$("[data-nomen]")) {
  const out = $("output", n), btns = $$(".nomen-map button", n);
  const pick = (b, press) => {
    const [r, g, bl] = b.dataset.rgb.split(",");
    out.innerHTML = "";
    const name = Object.assign(document.createElement("span"), { className: "name", textContent: b.dataset.name });
    const code = Object.assign(document.createElement("span"), { className: "code" });
    const sw = Object.assign(document.createElement("span"), { className: "swatch" });
    sw.style.background = `rgb(${r}, ${g}, ${bl})`;
    code.append(sw, `Colour code RGB (${r}, ${g}, ${bl})`);
    out.append(name, code);
    if (press) btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  };
  for (const b of btns) {
    b.addEventListener("mouseenter", () => pick(b, false));
    b.addEventListener("focus", () => pick(b, false));
    b.addEventListener("click", () => pick(b, true));
  }
  $(".nomen-map", n).addEventListener("mouseleave", () => { const p = btns.find((x) => x.getAttribute("aria-pressed") === "true"); if (p) pick(p, false); });
  for (const l of $$("[data-pick]", n)) l.addEventListener("click", () => { const b = btns.find((x) => x.dataset.name === l.dataset.pick); if (b) pick(b, true); });
}

/* ---------- tabs (home playground) ---------- */
for (const t of $$("[data-tabs]")) {
  const tabs = $$('[role="tab"]', t), panels = $$('[role="tabpanel"]', t);
  t.classList.add("js");
  const select = (n, focus) => tabs.forEach((b, k) => {
    b.setAttribute("aria-selected", String(k === n)); b.tabIndex = k === n ? 0 : -1;
    panels[k].toggleAttribute("data-tab-hidden", k !== n);
    if (k === n && focus) b.focus();
  });
  tabs.forEach((b, k) => {
    b.addEventListener("click", () => select(k));
    b.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); select((k + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length, true); }
    });
  });
}

/* ---------- N-/O-glycan: text part <-> symbol ---------- */
// Every residue carries the same data-res id in the 2D text, in both symbol drawings and in the list.
// Hover and focus preview a residue; click, tap or Enter pins it; Escape or a second click releases it.
for (const w of $$("[data-glyx]")) {
  const out = $(".glyx-out", w), chips = $$(".glyx-groups [data-res]", w), nodes = $$("svg .res", w);
  const info = Object.fromEntries(chips.map((c) => [c.dataset.res, c.dataset]));
  const all = [...nodes, ...chips, ...$$("[data-edge]", w)];
  const idle = out.innerHTML;
  let pinned = null;
  const paint = (id) => {
    w.classList.toggle("active", !!id);
    for (const n of all) n.classList.toggle("on", !!id && (n.dataset.res === id || n.dataset.edge === id));
    for (const c of chips) c.setAttribute("aria-pressed", String(c.dataset.res === pinned));
    if (!id) { out.innerHTML = idle; return; }
    const d = info[id];
    out.textContent = "";
    const name = Object.assign(document.createElement("span"), { className: "name", textContent: d.name });
    const link = Object.assign(document.createElement("span"), { className: "code", textContent: d.link });
    const where = Object.assign(document.createElement("span"), { className: "code", textContent: "Position: " + d.where });
    out.append(name, link, where);
  };
  const pin = (id) => { pinned = pinned === id ? null : id; paint(pinned); };
  for (const n of [...nodes, ...chips]) {
    const id = n.dataset.res;
    n.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") paint(id); });
    n.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") paint(pinned); });
    n.addEventListener("focus", () => paint(id));
    n.addEventListener("blur", () => paint(pinned));
    n.addEventListener("click", () => pin(id));
  }
  for (const svg of $$("svg", w)) {
    const list = $$(".res", svg);
    svg.addEventListener("keydown", (e) => {
      const i = list.indexOf(e.target.closest(".res"));
      if (i < 0) return;
      let j = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % list.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i + list.length - 1) % list.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = list.length - 1;
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pin(list[i].dataset.res); return; }
      else if (e.key === "Escape") { pinned = null; paint(list[i].dataset.res); return; }
      if (j < 0) return;
      e.preventDefault();
      list.forEach((n, k) => n.setAttribute("tabindex", k === j ? "0" : "-1"));
      list[j].focus();
    });
  }
  const tg = $("[data-glyx-links]", w);
  tg?.addEventListener("click", () => { const on = tg.getAttribute("aria-pressed") !== "true"; tg.setAttribute("aria-pressed", String(on)); w.classList.toggle("links", on); });
}

/* ---------- Chat entry: one button, a menu with the research chat and the human support chat ---------- */
const chatBtn = $("[data-chat-toggle]"), chatMenu = $("#chat-menu");
const chatItems = () => [...chatMenu.querySelectorAll('[role="menuitem"]')];
function closeChat(refocus) {
  if (!chatMenu || chatMenu.hidden) return;
  chatMenu.hidden = true; chatBtn.setAttribute("aria-expanded", "false");
  if (refocus) chatBtn.focus();
}
function openChat() {
  nav?.classList.remove("open"); navToggle?.setAttribute("aria-expanded", "false");
  chatMenu.hidden = false; chatBtn.setAttribute("aria-expanded", "true");
  chatItems()[0].focus();
}
// the element focus returns to after a dialog opened from the menu: the menu button, not the hidden menu item
const opener = () => (document.activeElement?.closest?.("#chat-menu") ? chatBtn : document.activeElement);
chatBtn?.addEventListener("click", () => (chatMenu.hidden ? openChat() : closeChat(true)));
chatBtn?.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" && chatMenu.hidden) { e.preventDefault(); openChat(); } });
chatMenu?.addEventListener("keydown", (e) => {
  const items = chatItems(), i = items.indexOf(document.activeElement);
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeChat(true); }
  else if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  else if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
  else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); }
  else if (e.key === "Tab") closeChat(false);
});
document.addEventListener("pointerdown", (e) => { if (chatMenu && !chatMenu.hidden && !e.target.closest(".chat")) closeChat(false); });
navToggle?.addEventListener("click", () => closeChat(false));

/* ---------- Ask Glycosearch (research chat) ---------- */
const ask = $("#ask"), log = $("#ask-log"), askForm = $("#ask-form"), askInput = $("#ask-input"), modeEl = $("[data-ask-mode]");
let engine = null, lastOpener = null, aiState = null; // aiState: null unknown | "on" | "off"
async function loadEngine() {
  if (engine) return engine;
  const S = await import(new URL("search.js", BASE));
  const [idx, ft] = await Promise.all([
    fetch(new URL("index.json", BASE)).then((r) => { if (!r.ok) throw new Error("index " + r.status); return r.json(); }),
    fetch(new URL("fulltext.json", BASE)).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  const byId = Object.fromEntries(idx.entries.map((e) => [e.id, e]));
  engine = { S, byId, index: S.buildIndex(idx.entries, ft) };
  return engine;
}
async function probeAi() {
  if (aiState) return aiState;
  aiState = sessionStorage.getItem("gs-ai") || null;
  if (!aiState) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 2500);
      const r = await fetch(CFG.ask.endpoint + "/status", { signal: c.signal, headers: { accept: "application/json" } });
      clearTimeout(t);
      const j = r.ok && (r.headers.get("content-type") || "").includes("json") ? await r.json() : {};
      aiState = j.configured === true ? "on" : "off";
    } catch { aiState = "off"; }
    sessionStorage.setItem("gs-ai", aiState);
  }
  modeEl.textContent = aiState === "on" ? "AI answer" : "Website search";
  return aiState;
}
function openAsk(q) {
  if (!ask.open) {
    lastOpener = opener(); closeChat(false);
    nav?.classList.remove("open"); navToggle?.setAttribute("aria-expanded", "false");
    window.Tawk_API?.minimize?.();
    ask.showModal();
    document.body.classList.add("ask-open");
    probeAi(); loadEngine().catch(() => {});
  }
  askInput.focus();
  if (q) { askInput.value = q; run(q); }
}
ask?.addEventListener("close", () => { document.body.classList.remove("ask-open"); lastOpener?.focus?.(); });
ask?.addEventListener("click", (e) => { if (e.target === ask) ask.close(); });
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-ask-open]")) { e.preventDefault(); openAsk(); }
  else if (e.target.closest("[data-ask-close]")) ask.close();
  const s = e.target.closest("[data-ask-suggest]");
  if (s) { askInput.value = s.textContent; run(s.textContent); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.querySelector("dialog[open]")) { e.preventDefault(); openAsk(); }
});
askForm?.addEventListener("submit", (e) => { e.preventDefault(); const q = askInput.value.trim(); if (q) run(q); });

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const KIND = { paper: "Paper", project: "Project", resource: "Reference", profile: "Page", tool: "Applied application", patent: "Patent" };
// icon-only action link; the accessible name and tooltip say where it goes
function actIcon(act, wanted) {
  const l = el("a", "ico" + (wanted ? " wanted" : ""));
  l.href = act.url; l.dataset.action = act.type; l.dataset.tip = act.aria; l.setAttribute("aria-label", act.aria);
  if (act.download) l.setAttribute("download", ""); else { l.target = "_blank"; if (act.external) l.rel = "noopener noreferrer"; }
  l.innerHTML = CFG.icons[act.download ? "download" : act.type] || CFG.icons.link; // static SVG from the site config
  return l;
}
function iconList(actions, hit) {
  const ul = el("ul", "icons");
  for (const act of actions) { const li = el("li"); li.append(actIcon(act, (hit?.highlight || []).includes(act.type))); ul.append(li); }
  return ul;
}
function hitCard(entry, hit) {
  const c = el("article", "hit");
  c.dataset.id = entry.id;
  const top = el("div", "top");
  top.append(el("span", "tag kind " + entry.kind, KIND[entry.kind]));
  if (entry.app) top.append(el("span", "tag", entry.app));
  if (entry.status === "preprint") top.append(el("span", "tag", "Preprint"));
  if (entry.year) top.append(el("span", "tag", (entry.journal ? entry.journal + " " : "") + entry.year));
  const h = el("h3"); const a = el("a", "", entry.title);
  const hl = (hit?.highlight || []).map((t) => "hl=" + t).join("&");
  a.href = entry.url.includes("#") || !hl ? entry.url : entry.url + "?" + hl;
  h.append(a);
  c.append(top, h);
  if (entry.authors) c.append(el("p", "who", entry.authors));
  if (hit?.snippet) {
    const b = el("blockquote"); b.innerHTML = hit.snippet.html; // escaped + <mark> only, produced by search.js
    b.append(el("cite", "", hit.snippet.source));
    c.append(b);
  }
  if (entry.actions.length) c.append(iconList(entry.actions, hit));
  if (entry.applied) { // application by other authors that was used in this study
    const box = el("div", "applied-hit");
    box.append(el("p", "who", `Applied application: ${entry.applied.name} (${entry.applied.by}). ${entry.applied.credit}`));
    box.append(iconList(entry.applied.actions, hit));
    c.append(box);
  }
  return c;
}
function answer(say, basis, cards, note) {
  const m = el("div", "msg a");
  if (note) m.append(el("p", "basis", note));
  m.append(el("p", "say", say));
  for (const c of cards) m.append(c);
  m.append(el("p", "basis", basis));
  log.append(m);
  m.scrollIntoView({ block: "start", behavior: "smooth" });
  return m;
}
async function run(q) {
  $(".ask-intro", log)?.remove();
  log.append(el("div", "msg q", q));
  askInput.value = "";
  const wait = el("p", "typing", "Searching the site…");
  log.append(wait); wait.scrollIntoView({ block: "end" });
  let E;
  try { E = await loadEngine(); } catch {
    wait.remove();
    const m = answer("The site index could not be loaded, so the research chat is unavailable right now. Navigation, the publication list and all downloads still work.", "Network error while loading the search index.", []);
    const l = el("a", "act", "Open the publication list"); l.href = "/publications/?q=" + encodeURIComponent(q); m.append(l);
    return;
  }
  const local = E.S.search(E.index, q);
  let note = null;
  if ((await probeAi()) === "on") {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000);
      const r = await fetch(CFG.ask.endpoint, { method: "POST", signal: c.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ q }) });
      clearTimeout(t);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (j.mode !== "ai" || typeof j.answer !== "string") throw new Error("bad response");
      const ids = (j.ids || []).filter((id) => E.byId[id]);
      const cards = ids.map((id) => hitCard(E.byId[id], local.hits.find((h) => h.id === id) || { highlight: local.intents.map((i) => i.type) }));
      wait.remove();
      answer(j.answer, "AI-written summary of the entries shown. Check the linked paper before relying on it; links are taken from the site index, not from the model.", cards);
      return;
    } catch { note = "The AI service did not respond — showing website search results instead."; }
  }
  wait.remove();
  const d = E.S.describe(local, E.byId);
  const m = answer(d.say, d.basis, local.hits.map((h) => hitCard(E.byId[h.id], h)), note);
  if (!local.hits.length) {
    const ul = el("ul", "suggest");
    for (const s of CFG.ask.suggestions.slice(0, 3)) { const li = el("li"); const b = el("button", "", s); b.type = "button"; b.dataset.askSuggest = ""; li.append(b); ul.append(li); }
    m.append(ul);
    const l = el("a", "act", "Browse all publications"); l.href = "/publications/"; m.append(l);
  }
}
{ // deep link: /?ask=frapbot+github
  const a = new URLSearchParams(location.search).get("ask");
  if (a && ask) openAsk(a.slice(0, 300));
}

/* ---------- Support chat (existing Tawk.to account, unchanged) ---------- */
const dot = $("[data-support-dot]"), supLabel = $("[data-support-label]"), fallback = $("#support-fallback");
let tawk = "idle", wantOpen = false, supOpener = null; // idle | loading | ready | failed
let supState = "", unread = 0;
const CHAT_NAME = "Research chat and support";
function renderSupport() {
  const st = supState;
  dot.className = "dot" + (unread ? " unread" : st === "online" ? " online" : st === "away" ? " away" : "");
  supLabel.textContent = unread ? `${unread} new message${unread === 1 ? "" : "s"}` : st === "online" ? "Online now" : st === "away" ? "Away — leave a message" : st === "offline" ? "Offline — leave a message" : "Contact a person";
  const name = unread ? `${CHAT_NAME}: ${unread} new support message${unread === 1 ? "" : "s"}` : CHAT_NAME;
  chatBtn?.setAttribute("aria-label", name); chatBtn?.setAttribute("data-tip", name);
}
function setStatus(s) { supState = typeof s === "string" ? s : ""; renderSupport(); }
// The Tawk widget announces unread messages by switching the page title to "1 new message" and back, also while
// the widget itself is hidden behind the chat entry. The title (and with it the tab label) stays the page's own;
// the unread count is shown at the chat entry and in its menu instead.
const pageTitle = document.title, titleEl = document.querySelector("title");
if (titleEl) new MutationObserver(() => { if (document.title !== pageTitle) document.title = pageTitle; }).observe(titleEl, { childList: true, characterData: true, subtree: true });
function tawkFailed() {
  if (tawk === "ready") return;
  tawk = "failed"; supLabel.textContent = "Chat unavailable — email";
  if (wantOpen) { wantOpen = false; fallback.showModal(); }
}
function loadTawk() {
  if (tawk !== "idle" || !CFG.support?.embedUrl) return;
  tawk = "loading";
  const T = (window.Tawk_API = window.Tawk_API || {});
  window.Tawk_LoadStart = new Date();
  T.onLoad = () => {
    tawk = "ready";
    try { setStatus(T.getStatus()); } catch { setStatus(""); }
    if (wantOpen) { wantOpen = false; T.showWidget(); T.maximize(); } else T.hideWidget();
  };
  T.onBeforeLoad = () => { if (!wantOpen) try { T.hideWidget(); } catch {} };
  T.onStatusChange = setStatus;
  T.onUnreadCountChanged = (n) => { unread = Math.max(0, Number(n) || 0); renderSupport(); };
  T.onChatMaximized = () => document.body.classList.add("support-open");
  T.onChatMinimized = () => { document.body.classList.remove("support-open"); T.hideWidget(); supOpener?.focus?.(); };
  T.onChatMessageAgent = () => { if (!document.body.classList.contains("support-open")) { T.showWidget(); T.maximize(); } };
  const s = document.createElement("script");
  s.async = true; s.src = CFG.support.embedUrl; s.charset = "UTF-8"; s.setAttribute("crossorigin", "*");
  s.onerror = tawkFailed;
  document.head.append(s);
  setTimeout(() => { if (tawk === "loading") tawkFailed(); }, 12000);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-support-open]");
  if (!b) return;
  supOpener = b.closest("dialog") ? lastOpener : b.closest("#chat-menu") ? chatBtn : b;
  closeChat(false);
  if (ask.open) ask.close();
  if (tawk === "ready") { window.Tawk_API.showWidget(); window.Tawk_API.maximize(); }
  else if (tawk === "failed") fallback.showModal();
  else { wantOpen = true; supLabel.textContent = "Connecting…"; loadTawk(); }
});
if (CFG.support?.load === "idle") {
  const start = () => (window.requestIdleCallback ? requestIdleCallback(loadTawk, { timeout: 4000 }) : setTimeout(loadTawk, 1500));
  document.readyState === "complete" ? start() : addEventListener("load", start);
}

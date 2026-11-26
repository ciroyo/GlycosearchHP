#!/usr/bin/env node
// Glycosearch static site generator. Zero dependencies (Node >= 20, macOS `sips` for image derivatives).
// Input:  ../content/*.json + ../../legacy-live-2026-11-24 (unchanged originals) + ../additions (files added 2026-11-25)
// Output: ../dist  (deployable static site; originals copied byte-for-byte at their legacy paths)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { glycanWidget, chartSymbol, textFigure, symbolSvg } from "./glycan.mjs";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(SITE, "..");
const LEGACY = path.join(ROOT, "legacy-live-2026-11-24");
const ADD = path.join(SITE, "additions");
const DIST = path.join(SITE, "dist");
const CACHE = path.join(SITE, ".cache");
const rj = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback);

const legacy = rj(path.join(SITE, "content/legacy-extract.json"));
const C = rj(path.join(SITE, "content/site.json"));
const biblio = rj(path.join(SITE, "content/bibliography.json"), {});
const fulltextSrc = rj(path.join(SITE, "content/fulltext.json"), {});
const linkStatus = rj(path.join(SITE, "content/link-status.json"), {});
const linkNotes = rj(path.join(SITE, "content/link-notes.json"), {});
const additions = rj(path.join(SITE, "content/additions.json"), { papers: [] });
const glycans = rj(path.join(SITE, "content/glycans.json"));

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fileUrl = (p) => "/" + p.split("/").map(encodeURIComponent).join("/");
const host = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return ""; } };
const fmtBytes = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " kB");

// ---------- icons ----------
const I = {
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 13h5M9.5 16.5h5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"/></svg>',
  app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M3.5 9h17M7 7h.01"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 00-3 18.5c.5.1.7-.2.7-.5v-1.700c-2.700.6-3.200-1.100-3.200-1.100-.4-1.100-1.100-1.400-1.100-1.400-.900-.6.1-.6.1-.6 1 .1 1.500 1 1.500 1 .900 1.500 2.300 1.100 2.900.8.1-.6.300-1.100.600-1.300-2.100-.2-4.300-1.100-4.300-4.700 0-1 .4-1.900 1-2.600-.1-.2-.4-1.200.1-2.500 0 0 .8-.3 2.600 1a9 9 0 014.800 0c1.800-1.300 2.600-1 2.600-1 .5 1.300.2 2.300.1 2.500.6.700 1 1.600 1 2.600 0 3.600-2.200 4.400-4.300 4.700.3.300.6.900.6 1.800v2.600c0 .3.2.6.7.5A9.500 9.500 0 0012 2.500z"/></svg>',
  doi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 4h9l3 3v13H6z"/><path d="M12 10.500v5M9.800 13.500l2.200 2.200 2.200-2.200"/></svg>',
  coffee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 10h11v4.500a4.500 4.500 0 01-4.500 4.500h-2A4.500 4.500 0 015 14.500z"/><path d="M16 11.500h1.500a2.250 2.250 0 010 4.500H16M4 21h13M8.500 3.500c-.8.900.8 1.600 0 3M12 3.500c-.8.900.8 1.600 0 3"/></svg>',
  manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 4.5h10a3 3 0 013 3V20H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h10"/></svg>',
  press: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 6h13v12H6a2 2 0 01-2-2zM17 9h3v7a2 2 0 01-2 2M7.5 9.5h6M7.5 12.5h6M7.5 15.5h3"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8.3 10.8v5.4M8.3 7.9v.2M11.9 16.2v-5.4M11.9 13.2c0-1.5 1-2.5 2.2-2.5s2 .9 2 2.4v3.1"/></svg>',
  institution: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 9.5L12 5l8 4.5M6 10v7M10 10v7M14 10v7M18 10v7M4 19h16"/></svg>',
  wiki: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 4h9l3 3v13H6zM9 11h6M9 14.5h6"/></svg>',
  gsoc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-width="2.2" stroke-linecap="round"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.2v5.6l5-2.8z" fill="currentColor" stroke="none"/></svg>',
  paper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15.5h6"/></svg>',
  ask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8.5 9.5h7M8.5 12.5h4"/></svg>',
  support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  logo: '<svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><path class="ring" d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle class="core" cx="12" cy="12" r="3.2"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 6l6 6-6 6"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.2A8 8 0 019.8 4a8 8 0 1010.2 10.2z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5.5h3.6v13H7zM13.4 5.5H17v13h-3.6z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12a7 7 0 107-7H8"/><path d="M10.5 2.5L8 5l2.5 2.5"/></svg>',
  patent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h12v11H6z"/><path d="M9 7.5h6M9 10.5h6M9.5 14.5v6l2.5-1.5 2.5 1.5v-6"/></svg>',
};
// Browser tab icon: the same sugar ring as the brand mark; adapts to a dark browser UI.
const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5.4" fill="#f96627"/><g transform="translate(12 12) scale(.8) translate(-12 -12)"><path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="none" stroke="#fff" stroke-width="2.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="#fff"/></g></svg>'; // white ring on the brand orange; the PNG and ICO sizes come from scripts/make-icons.py
I.preprint = I.wiki; I.ssrn = I.wiki;
// Mouse pointer: small version of the Glycosearch sugar-ring logo. The ring is turned so that one corner
// points up-left; that corner (3,3) is the hotspot and carries a solid tip.
const CURSOR = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><g transform="translate(-2.6 -2.4) rotate(-45 12 12)"><path d="M12 3.200l7.600 4.400v8.800L12 20.800l-7.600-4.400V7.600z" fill="#fff" fill-opacity=".92" stroke="#fff" stroke-width="3.400" stroke-linejoin="round"/><path d="M12 3.200l7.600 4.400v8.800L12 20.800l-7.600-4.400V7.600z" fill="none" stroke="#1b1e23" stroke-width="1.500" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.700" fill="#f96627"/></g><circle cx="3.2" cy="3.4" r="2.2" fill="#1b1e23" stroke="#fff" stroke-width="1"/></svg>';

// ---------- content model ----------
// External targets recorded as unreachable are handled silently: the archived copy is used as the link,
// and where none exists (or the owner asked for no link) only the text remains. Provenance: content/link-notes.json.
const live = (u) => { const n = linkNotes[u]; if (!n || u.startsWith("_")) return u; return n.noLink ? null : n.archive || null; };
const repoName = (u) => u.replace(/\.git$/, "").split("/").filter(Boolean).pop();
const ACTION_MAP = {
  "app": (it) => ({ type: "app", label: "Web app", name: C.papers[it.id]?.app || "", row: (n) => `${n} web app`, aria: (n) => `Open the ${n} web app` }),
  "github": () => ({ type: "code", label: "GitHub", row: () => "Source code (GitHub)", aria: (n) => `Open ${n} on GitHub` }),
  "get manual": () => ({ type: "manual", label: "Manual (PDF)", row: (n) => `${n} manual (PDF)`, aria: (n) => `Open the ${n} manual (PDF)` }),
  "eth zurich": () => ({ type: "institution", label: "ETH Zurich", name: "FRAP and FLIP resource", row: () => "FRAP and FLIP resource, ETH Zurich", aria: () => "Open the FRAP and FLIP resource at ETH Zurich" }),
  "press": () => ({ type: "press", label: "Press", name: "Radboudumc", row: () => "Press article, Radboudumc", aria: (n) => `Open the Radboudumc press article about ${n}` }),
  "wiki": () => ({ type: "wiki", label: "Wiki", row: () => "Project wiki", aria: (n) => `Open the project wiki of ${n}` }),
  "gsoc": () => ({ type: "gsoc", label: "GSoC project", row: () => "Google Summer of Code project page", aria: (n) => `Open the Google Summer of Code page of ${n}` }),
  "r": () => ({ type: "gsoc", label: "R / GSoC organization", name: "R project for statistical computing", row: () => "R project, GSoC organization page", aria: (n) => `Open the R project organization page (Google Summer of Code) for ${n}` }),
};
const sha256 = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
function fileInfo(root, rel) { const f = path.join(root, rel); if (!fs.existsSync(f)) throw new Error("missing file: " + f); return { path: rel, exists: true, bytes: fs.statSync(f).size, sha256: sha256(f) }; }
// entries added after the live mirror (content/additions.json, files under site/additions/)
// Their preview shows every page of the PDF in order (additions/pages, made by scripts/render-pages.py).
// The earlier figure cut-outs (p.figures) stay on disk and only supply the small list thumbnail.
const pagesMeta = rj(path.join(ADD, "pages/pages.json"), {});
const added = (additions.papers || []).map((p) => {
  const pdf = fileInfo(ADD, p.pdf), pm = pagesMeta[p.id];
  if (!pm) throw new Error("no rendered pages for " + p.id + " — run scripts/render-pages.py");
  if (pm.pdfSha256 !== pdf.sha256) throw new Error("rendered pages of " + p.id + " do not belong to the current PDF — run scripts/render-pages.py");
  return { ...p, root: ADD, legacyDetail: null, actions: [], pdf, pageMode: true, images: pm.pages.map((g) => ({ ...fileInfo(ADD, g.file), caption: "" })), thumbnail: { path: p.figures[p.thumb || 0].file } };
});
const tools = Object.fromEntries((C.tools || []).map((t) => [t.id, { ...t, actions: [] }]));

function model(kind, it) {
  const over = (kind === "paper" ? C.papers : C.projects)[it.id];
  if (!over) throw new Error("no overlay for " + it.id);
  const base = kind === "paper" ? "/publications/" : "/projects/";
  const short = over.shortTitle || it.shortTitle;
  const display = over.app || short;
  const actions = [], applied = [];
  if (!it.pdf?.exists) throw new Error("PDF missing for " + it.id);
  const pdfUrl = fileUrl(it.pdf.path);
  actions.push({ type: "pdf", label: kind === "paper" ? "Read paper" : "Read PDF", url: pdfUrl, bytes: it.pdf.bytes, legacyLabel: "Get PDF", row: "PDF", aria: `Read the PDF: ${short}` });
  actions.push({ type: "pdf", label: "Download PDF", url: pdfUrl, download: true, bytes: it.pdf.bytes, legacyLabel: "Get PDF", row: "PDF download", aria: `Download the PDF: ${short}` });
  const tool = over.applied ? tools[over.applied.tool] : null;
  for (const a of it.actions) {
    const key = a.legacyLabel.toLowerCase();
    const f = ACTION_MAP[key];
    if (!f) throw new Error(`unmapped action label "${a.legacyLabel}" on ${it.id}`);
    const isApplied = tool && over.applied.legacyLabels.includes(key);
    const m = f(it), n = isApplied ? tool.name : display;
    const act = { type: m.type, label: m.label, name: isApplied && m.type === "app" ? tool.name : m.name || "", url: a.local ? fileUrl(a.url) : a.url, external: !a.local, legacyLabel: a.legacyLabel, bytes: a.file?.bytes, row: m.row(n), aria: m.aria(n, a) };
    if (isApplied) { act.applied = tool.id; applied.push(act); tool.actions.push(act); } else actions.push(act);
  }
  for (const l of it.links || []) actions.push({ type: l.type, label: l.label, name: l.name || "", url: l.url, external: true, row: l.row, aria: l.aria });
  if (tool) tool.usedIn = it.id;
  const cats = [...(it.categories || []), ...(over.addCategories || [])];
  const pick = (map) => cats.filter((c) => map[c]).map((c) => ({ key: c, label: map[c] }));
  const b = biblio[it.id] || {};
  return {
    id: it.id, kind, n: it.legacyNumber, slug: over.slug, url: base + over.slug + "/", root: it.root || LEGACY,
    title: it.title, shortTitle: short, authors: it.authors, authorsShort: it.authorsShort,
    abstract: it.abstract.replace(/\u00ad/g, ""), categories: cats, abstractSource: it.abstractSource || "site",
    roles: kind === "paper" ? pick(C.labels.role) : [], types: kind === "paper" ? pick(C.labels.type) : [],
    topics: pick(kind === "paper" ? C.labels.topic : C.labels.project),
    keywords: over.keywords || "", app: over.app || "", actions, applied, tool, pdf: it.pdf, images: it.images, thumbnail: it.thumbnail,
    legacyDetail: it.legacyDetail, bib: b, statusNote: it.statusNote || "", pageMode: !!it.pageMode,
  };
}
const papers = [...legacy.papers, ...added].map((p) => model("paper", p));
const projects = legacy.projects.map((p) => model("project", p));
const all = [...papers, ...projects];
const byId = Object.fromEntries(all.map((x) => [x.id, x]));
for (const t of Object.values(tools)) {
  t.url = byId[t.usedIn].url + "#applied";
  const r = t.reference;
  t.actions.push({ type: "doi", label: "Publication", url: "https://doi.org/" + r.doi, external: true, applied: t.id, row: `Publication: ${r.journal} ${r.year}`, aria: `Open the ${t.name} publication (${r.journal}, ${r.year})` });
  t.refText = `${r.authors} ${r.title}. ${r.journal} ${r.year}, ${r.volume}, ${r.pages}.`;
}

const patents = (C.patents || []).map((p) => ({ ...p, kind: "patent", url: "/publications/" + p.slug + "/", year: +p.granted.iso.slice(0, 4),
  actions: p.links.map((l) => ({ type: l.type, label: l.label, name: "", url: l.url, external: true, row: l.row, aria: l.aria })) }));

// ---------- media derivatives ----------
fs.mkdirSync(CACHE, { recursive: true });
function dims(abs) {
  const info = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", abs]).toString();
  return { w: +/pixelWidth: (\d+)/.exec(info)[1], h: +/pixelHeight: (\d+)/.exec(info)[1] };
}
function derive(src, max, quality) {
  const key = crypto.createHash("sha1").update(src + "|" + max + "|" + quality + "|" + fs.statSync(src).size).digest("hex").slice(0, 16);
  const out = path.join(CACHE, key + ".jpg");
  const meta = path.join(CACHE, key + ".json");
  if (!fs.existsSync(out) || !fs.existsSync(meta)) {
    execFileSync("sips", ["-Z", String(max), "-s", "format", "jpeg", "-s", "formatOptions", String(quality), src, "--out", out], { stdio: "ignore" });
    fs.writeFileSync(meta, JSON.stringify(dims(out)));
  }
  return { file: out, ...JSON.parse(fs.readFileSync(meta, "utf8")) };
}
const mediaCopies = [];
function media(src, name, max = 1280, quality = 62) {
  const d = derive(src, max, quality);
  mediaCopies.push([d.file, path.join(DIST, "media", name)]);
  return { url: "/media/" + name, w: d.w, h: d.h };
}
for (const it of all) {
  const doc = it.pageMode; // whole PDF pages: keep the text legible, link each page to its place in the PDF
  it.gallery = it.images.map((im, i) => ({ orig: doc ? fileUrl(it.pdf.path) + "#page=" + (i + 1) : fileUrl(im.path), bytes: im.bytes, caption: im.caption || "", full: media(path.join(it.root, im.path), `${it.id}/${i + 1}.jpg`, doc ? 1800 : 1280, doc ? 84 : 62), small: media(path.join(it.root, im.path), `${it.id}/s${i + 1}.jpg`, 220, 72) }));
  it.thumb = media(path.join(it.root, it.thumbnail.path), `${it.id}/thumb.jpg`, 640, 78);
}
const heroImg = media(path.join(LEGACY, C.home.figure.src), "home-figure.jpg", 1600, 80);
const nomenImg = { url: fileUrl(legacy.nomenclature.image), w: legacy.nomenclature.width, h: legacy.nomenclature.height };
const L = C.learning;
const learnImg = Object.fromEntries(Object.entries(L.figures).map(([k, f]) => [k, { ...f, url: fileUrl(f.file), ...dims(path.join(ADD, f.file)) }]));
// Theme derivatives of the two raster figures (scripts/make-learning-figures.py): transparent background,
// in the dark variant light lettering and lines. Originals stay served and linked.
const themedImg = (m, alt, extra = "") => { const base = m.file.replace(/^learning\//, "learning/derived/").replace(/\.jpg$/, ""); return ["light", "dark"].map((t) => `<img class="on-${t}" src="${fileUrl(base + "-" + t + ".png")}" width="${m.w}" height="${m.h}" alt="${esc(alt)}" loading="lazy" decoding="async"${extra}>`).join(""); };
const themedFigure = (m, name) => `<figure class="lfig"><button type="button" class="zoom plain" data-zoom="${fileUrl(m.file.replace(/^learning\//, "learning/derived/").replace(/\.jpg$/, "-dark.png"))}" data-zoom-orig="${m.url}" aria-label="Enlarge: ${esc(m.alt)}">${themedImg(m, m.alt)}</button><figcaption><span></span>${ico(m.url, `Open the original figure file: ${name}`, "link", { external: false })}</figcaption></figure>`;
// poster: a frame of the local animation itself (QuickLook thumbnail of assets/movies/video_white.mp4)
const posterSrc = path.join(ADD, "derived/spaac-animation-frame.png");
const poster = media(posterSrc, "video-poster.jpg", 1100, 74);

// ---------- components ----------
const NAV = [["/", "Home"], ["/research/", "Research"], ["/publications/", "Publications"], ["/software/", "Software"], ["/projects/", "Projects"], ["/learning/", "Learning"], ["/about/", "About"]];
// icon-only link: the row or heading next to it names the target; aria-label and tooltip carry the full name
function ico(url, label, type = "link", { download = false, external = true, same = false, cls = "" } = {}) {
  const icon = download ? I.download : I[type] || I.link;
  const attrs = download ? " download" : same ? "" : external ? ' target="_blank" rel="noopener noreferrer"' : ' target="_blank"';
  return `<a class="ico ${cls}" href="${esc(url)}"${attrs} aria-label="${esc(label)}" data-tip="${esc(label)}" data-action="${type}">${icon}</a>`;
}
// Experience: affiliation text with its compact link buttons on the right (26 Nov 2026). Vaionex keeps its
// company link; the other entries list `links` from content/site.json in the owner's order. Icons only: the
// accessible name and tooltip carry the target, no written URL.
const whereLinks = (x) => {
  const L = [...(x.url ? [{ url: x.url, label: `Open the ${x.org} website` }] : []), ...(x.links || [])].map((l) => extIco(l.url, l.label)).filter(Boolean);
  return `<p class="where with-links"><span class="where-text">${esc(x.where)}</span>${L.length ? `<span class="ico-group">${L.join("")}</span>` : ""}</p>`;
};
const actIco = (a) => ico(a.url, a.aria, a.type, { download: !!a.download, external: !!a.external });
const extIco = (url, label, type = "link") => { const u = live(url); return u ? ico(u, label, type) : ""; };
function iconRow(it, { skipRead = true } = {}) {
  const list = it.actions.filter((a) => !(skipRead && a.type === "pdf" && !a.download));
  return `<ul class="icons" aria-label="Links for ${esc(it.shortTitle)}">${list.map((a) => `<li>${actIco(a)}</li>`).join("")}</ul>`;
}
const linkRows = (acts) => `<ul class="linkrows">${acts.map((a) => `<li><span>${esc(a.row)}</span>${actIco(a)}</li>`).join("")}</ul>`;
const tagList = (it) => {
  const t = [...it.types, ...it.roles, ...it.topics];
  return t.length ? `<ul class="tags">${t.map((x) => `<li class="tag">${esc(x.label)}</li>`).join("")}</ul>` : "";
};
const img = (m, alt, extra = "") => `<img src="${m.url}" width="${m.w}" height="${m.h}" alt="${esc(alt)}" loading="lazy" decoding="async"${extra}>`;
const zoom = (m, alt, cls = "") => `<button type="button" class="zoom ${cls}" data-zoom="${m.url}" aria-label="Enlarge: ${esc(alt)}">${img(m, alt)}</button>`;
const pubMeta = (p) => (p.bib.year ? ` · <span class="meta">${p.bib.listLabel || p.bib.journal ? esc(p.bib.listLabel || p.bib.journal) + " " : ""}${p.bib.year}</span>` : "");

// One definition for every page type (home, nested pages, 404, redirect stubs). Order and types matter:
// Safari takes the PNG/ICO entries (it shows the first character of the host name, "1" for 127.0.0.1, when it has
// no usable icon), Chromium and Firefox prefer the SVG. The version query forces browsers to drop icons cached earlier.
const ICON_V = "5";
const FAVICON_LINKS = `<link rel="icon" href="/favicon.ico?v=${ICON_V}" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/site/favicon-32.png?v=${ICON_V}">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/site/favicon-16.png?v=${ICON_V}">
<link rel="icon" type="image/svg+xml" href="/assets/site/favicon.svg?v=${ICON_V}">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=${ICON_V}">
<link rel="mask-icon" href="/assets/site/mask-icon.svg?v=${ICON_V}" color="#f96627">`;
// Applied before the first paint: stored choice, else the system preference. Works without storage access.
const THEME_BOOT = `<script>(function(){var t=null;try{t=localStorage.getItem("gs-theme")}catch(e){}if(t!=="light"&&t!=="dark")t=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)})()</script>`;
function layout({ url, title, description, body, current, head = "" }) {
  const full = title ? `${title} · Glycosearch` : `Glycosearch — ${C.site.tagline}`;
  const cfg = { support: C.support, ask: C.ask, email: C.site.email, icons: Object.fromEntries(["pdf", "download", "app", "code", "manual", "press", "institution", "wiki", "gsoc", "link", "doi", "preprint", "ssrn", "patent", "soundOn", "soundOff", "play", "pause", "replay"].map((k) => [k, I[k]])) };
  const coffee = `<a class="icon-btn quiet coffee" href="${C.site.supportLink.url}" target="_blank" rel="noopener noreferrer" aria-label="${esc(C.site.supportLink.label)}" data-tip="${esc(C.site.supportLink.label)}">${I.coffee}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
${THEME_BOOT}
<title>${esc(full)}</title>
<meta name="description" content="${esc(description || C.site.description)}">
<link rel="canonical" href="${C.site.origin}${url}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description || C.site.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${C.site.origin}${url}">
<meta property="og:image" content="${C.site.origin}/media/home-figure.jpg">
${FAVICON_LINKS}
<meta name="theme-color" content="#faf9f6">
<link rel="stylesheet" href="/assets/site/styles.css">
${head}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/" aria-label="Glycosearch home">${I.logo}<span>Glycosearch</span></a>
    <nav class="nav" id="nav" aria-label="Main">
      ${NAV.map(([h, l]) => `<a href="${h}"${current === h ? ' aria-current="page"' : ""}>${l}</a>`).join("\n      ")}
    </nav>
    <div class="header-tools">
    <div class="chat">
      <button class="icon-btn quiet chat-toggle" type="button" data-chat-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="chat-menu" aria-label="Research chat and support" data-tip="Research chat and support">${I.chat}<span class="dot" data-support-dot aria-hidden="true"></span></button>
      <div class="chat-menu" id="chat-menu" role="menu" aria-label="Research chat and support" hidden>
        <button type="button" role="menuitem" tabindex="-1" data-ask-open>${I.ask}<span><b>Ask Glycosearch</b><small>Research chat · find papers &amp; tools</small></span></button>
        <button type="button" role="menuitem" tabindex="-1" data-support-open>${I.support}<span><b>Support chat</b><small>Human support · <span data-support-label>Contact a person</span></small></span></button>
      </div>
    </div>
    <button class="icon-btn quiet theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark theme" data-tip="Switch to dark theme">${I.moon}${I.sun}</button>
    ${coffee}
    </div>
    <button class="icon-btn nav-toggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu">${I.menu}</button>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer"><p>© 2016–2026 Glycosearch</p></footer>

<dialog class="ask" id="ask" aria-labelledby="ask-title">
  <header>
    <h2 id="ask-title">Ask Glycosearch</h2>
    <button class="icon-btn" type="button" data-ask-close aria-label="Close research chat">${I.close}</button>
    <p><span class="mode" data-ask-mode>Website search</span></p>
  </header>
  <div class="ask-log" id="ask-log" role="log" aria-live="polite" aria-label="Conversation" tabindex="0">
    <div class="ask-intro">
      <p>Ask for a paper, a method, a web app or a repository.</p>
      <ul class="suggest">${C.ask.suggestions.map((s) => `<li><button type="button" data-ask-suggest>${esc(s)}</button></li>`).join("")}</ul>
    </div>
  </div>
  <form id="ask-form" autocomplete="off">
    <label class="sr" for="ask-input">Your question</label>
    <input id="ask-input" name="q" type="text" maxlength="300" placeholder="e.g. Where is the Frapbot repository?" required>
    <button class="btn accent" type="submit">Ask</button>
    <p class="fine">Research chat, not human support. For a person, use <button type="button" class="linkbtn" data-support-open>Support chat</button>.</p>
  </form>
</dialog>

<dialog class="support-fallback" id="support-fallback" aria-labelledby="sf-title">
  <h2 id="sf-title">Support chat is unavailable</h2>
  <p>The Tawk.to support chat could not be loaded (it may be blocked by your browser or network). You can reach Glycosearch by email instead.</p>
  <div class="row"><a class="btn" href="mailto:${C.site.email}">Email ${C.site.email}</a><button class="btn ghost" type="button" data-close-dialog>Close</button></div>
</dialog>

<dialog class="lightbox" id="lightbox" aria-label="Image viewer">
  <div class="bar"><span data-lb-count></span><span class="lb-tools"><button type="button" data-lb-zoom aria-pressed="false">Actual size</button><a data-lb-orig href="#" target="_blank">Open original</a><button type="button" data-lb-close aria-label="Close image viewer">Close</button></span></div>
  <div class="view" tabindex="0"><img data-lb-img alt=""></div>
  <div class="ctl"><button type="button" data-lb-prev>← Previous</button><button type="button" data-lb-next>Next →</button></div>
</dialog>

<script id="site-config" type="application/json">${JSON.stringify(cfg).replace(/</g, "\\u003c")}</script>
<script type="module" src="/assets/site/app.js"></script>
</body>
</html>
`;
}

function pubRow(p) {
  const hay = [p.title, p.shortTitle, p.authors, p.abstract, p.keywords, p.app, p.tool?.name || "", ...p.topics.map((t) => t.label), ...p.types.map((t) => t.label), ...p.actions.map((a) => a.label + " " + (a.name || ""))].join(" ");
  return `<li class="pub" id="${p.id}" data-id="${p.id}" data-cats="${p.categories.join(" ")}" data-hay="${esc(hay)}">
  <span class="num" aria-hidden="true">${String(p.n).padStart(2, "0")}</span>
  <a class="thumb" href="${p.url}" tabindex="-1" aria-hidden="true">${img(p.thumb, "")}</a>
  <div>
    <h3><a href="${p.url}">${esc(p.title)}</a></h3>
    <p class="authors">${esc(p.authors)}${pubMeta(p)}</p>
    ${tagList(p)}
    ${iconRow(p)}
  </div>
</li>`;
}
function patentRow(p) {
  const hay = ["patent", p.number, p.short, p.title, p.inventors.join(" "), p.proprietor, p.description, p.keywords].join(" ");
  return `<li class="pub" id="${p.id}" data-id="${p.id}" data-cats="patent" data-hay="${esc(hay)}">
  <span class="num" aria-hidden="true">P${p.n}</span>
  <a class="thumb tile" href="${p.url}" tabindex="-1" aria-hidden="true">${I.patent}</a>
  <div>
    <h3><a href="${p.url}">${esc(p.title)}</a></h3>
    <p class="authors">${esc(p.inventors.join("; "))} · <span class="meta">${esc(p.number)} · ${p.year}</span></p>
    <ul class="tags"><li class="tag">${esc(C.labels.type.patent)}</li></ul>
    <ul class="icons" aria-label="Links for ${esc(p.short)}">${p.actions.map((a) => `<li>${actIco(a)}</li>`).join("")}</ul>
  </div>
</li>`;
}
// "Find a symbol": the 18 chart symbols as vector buttons on the page surface (no raster image, no white box).
// The original chart file stays served at its old address.
function nomenclature(idp) {
  const S = glycans.chart.symbols;
  return `<div class="nomen" data-nomen>
  <div class="nomen-map" role="group" aria-label="Symbol nomenclature chart: 18 monosaccharides">
      ${S.map((s) => `<button type="button" aria-pressed="false" data-name="${esc(s.name)}" data-rgb="${s.rgb.join(",")}" data-kind="${s.kind}" aria-label="${esc(s.name)}">${chartSymbol(s)}</button>`).join("\n      ")}
  </div>
  <div class="nomen-info">
    <p class="kicker">Selected monosaccharide</p>
    <output id="${idp}-out" aria-live="polite"><span class="name">Select a symbol</span><span class="code">Hover, tap or tab through the chart.</span></output>
    <ul class="nomen-list">${S.map((s) => `<li><button type="button" data-pick="${esc(s.name)}">${esc(s.name)}</button></li>`).join("")}</ul>
  </div>
</div>`;
}
const head1 = (kicker, h1, lead) => `<div class="wrap page-head">
  ${kicker ? `<p class="kicker">${kicker}</p>` : ""}
  <h1>${h1}</h1>
  ${lead ? `<p class="lead">${lead}</p>` : ""}
</div>`;
const sec = (id, kicker, h2, inner, { tight = false, aside = "" } = {}) => `<section class="section${tight ? " tight" : ""}" id="${id}"><div class="wrap">
  <div class="section-head"><div>${kicker ? `<p class="kicker">${kicker}</p>` : ""}<h2>${h2}</h2></div>${aside}</div>
  ${inner}
</div></section>`;
const refIco = (r) => extIco(r.url, `Open reference: ${r.title}`);
const RES = Object.fromEntries(C.resources.map((r) => [r.id, r]));
const localVideo = `<div class="video-frame"><video controls preload="none" playsinline poster="${poster.url}" aria-label="${esc(L.animation.label)}"><source src="/assets/movies/video_white.mp4" type="video/mp4">Your browser cannot play this video. <a href="/assets/movies/video_white.mp4">Download the video</a>.</video></div>`;

// ---------- pages ----------
const pages = [];
const page = (url, o) => pages.push({ url, ...o });
const apps = papers.filter((p) => p.app);
const gloss = Object.fromEntries(C.glossary.map((g) => [g.key, g]));

// Home
const spaacFrame = dims(path.join(ADD, "learning/derived/spaac-frame-light.png"));
const HV = { ...C.home.video, watch: "https://www.youtube.com/watch?v=" + C.home.video.id, poster: `https://i.ytimg.com/vi/${C.home.video.id}/maxresdefault.jpg` };
const learnCards = [
  ["symbols", "Symbol nomenclature", "Eighteen monosaccharides, one symbol each.", `<span class="mini-chart">${glycans.chart.symbols.map(chartSymbol).join("")}</span>`],
  ["text", "Text nomenclature", "Linear and 2D notation with anomeric carbon and linkage.", textFigure({ ...glycans.textFigure, alt: "" }).replace('role="img" aria-label=""', 'aria-hidden="true"')],
  ["examples", "N- and O-linked examples", "Match every text part to its symbol.", symbolSvg(glycans, glycans.glycans[0], false).replace(/ role="button" tabindex="-?\d+" aria-label="[^"]*"/g, "").replace(/role="group" aria-label="[^"]*"/, 'aria-hidden="true"').replace(/ data-(res|edge)="[^"]*"/g, "")],
  ["glycome", "Glycome", gloss.glycome.text, themedImg(learnImg.glycome, "")],
  ["glycomics", "Glycomics", gloss.glycomics.text, themedImg(learnImg.glycomics, "")],
  ["spaac", "SPAAC", "Copper-free click chemistry, with video.", ["light", "dark"].map((t) => `<img class="on-${t}" src="/learning/derived/spaac-frame-${t}.png" width="${spaacFrame.w}" height="${spaacFrame.h}" alt="" loading="lazy" decoding="async">`).join("")],
];
page("/", {
  current: "/",
  body: `<section class="hero"><div class="wrap">
  <div class="hero-grid">
    <div>
      <p class="kicker">${esc(C.home.kicker)}</p>
      <h1>${esc(C.site.tagline).replace(/-/g, "\u2011")}</h1>
      <p class="lead">${esc(C.home.lead)}</p>
      <div class="cta">
        <a class="btn" href="/learning/">Start learning</a>
        <a class="btn ghost" href="#playground">Open the playground</a>
      </div>
    </div>
    <figure class="figure hero-video" data-yt-box>
      <div class="video-frame yt" data-yt="${HV.id}" data-yt-title="${esc(HV.title)}">
        <img class="yt-poster" src="${HV.poster}" width="1280" height="720" alt="" decoding="async" referrerpolicy="no-referrer">
        <a class="yt-fallback" href="${HV.watch}" target="_blank" rel="noopener noreferrer">${I.play}<span>Watch “${esc(HV.title)}” on YouTube</span></a>
        <button type="button" class="yt-replay" data-yt-replay hidden aria-label="Replay the video">${I.replay}<span>Replay</span></button>
      </div>
      <figcaption><span>${esc(HV.caption)}</span><span class="tools yt-tools"><button type="button" class="icon-btn sm" data-yt-play hidden aria-label="Pause video" data-tip="Pause video">${I.pause}</button><button type="button" class="icon-btn sm" data-yt-sound hidden aria-label="Turn sound on" data-tip="Turn sound on">${I.soundOff}</button>${ico(HV.watch, `Open “${HV.title}” on YouTube`)}</span></figcaption>
    </figure>
  </div>
  <div class="facts">
    <a href="/publications/"><b>${papers.length}</b><span>publications</span></a>
    <a href="/software/"><b>${apps.length}</b><span>web apps</span></a>
    <a href="/projects/"><b>${projects.length}</b><span>open-source projects</span></a>
    <a href="${patents[0].url}"><b>${patents.length}</b><span>${patents.length === 1 ? "patent" : "patents"}</span></a>
  </div>
</div></section>

${sec("glycoscience", "Glycoscience", "Start with the basics", `<p class="lead intro">${esc(C.home.intro)}</p>
  <div class="grid c3 learn">${learnCards.map(([id, t, d, pic]) => `<a class="lcard" href="/learning/#${id}"><span class="pic pic-${id}">${pic}</span><span class="t">${esc(t)}</span><span class="d">${esc(d)}</span></a>`).join("")}</div>`, { aside: `<a class="btn ghost small" href="/learning/">All of Learning</a>` })}

${sec("playground", "Playground", "Read a glycan", `<p class="lead intro">${esc(L.playLead)}</p>
  <div class="tabs" data-tabs>
    <div class="tablist" role="tablist" aria-label="Example glycan">${glycans.glycans.map((g, i) => `<button type="button" role="tab" id="tab-${g.id}" aria-controls="panel-${g.id}" aria-selected="${i === 0}" class="chip"${i ? ' tabindex="-1"' : ""}>${esc(g.title)}</button>`).join("")}</div>
    ${glycans.glycans.map((g, i) => `<div role="tabpanel" id="panel-${g.id}" aria-labelledby="tab-${g.id}" class="tabpanel"${i ? " data-tab-hidden" : ""}><h3 class="tab-title">${esc(g.title)}</h3>${glycanWidget(glycans, g.id)}</div>`).join("")}
  </div>
  <h3 class="sub">Find a symbol</h3>
  ${nomenclature("home-nomen")}`)}

${sec("research", "Research", "Research areas", `<ul class="arealist">${C.themes.map((t) => `<li><a href="/research/#${t.id}">${esc(t.title)}</a></li>`).join("")}</ul>`, { aside: `<a class="btn ghost small" href="/publications/">All ${papers.length} publications</a>` })}`,
});

// Research
page("/research/", {
  title: "Research", current: "/research/",
  description: "Research areas of Glycosearch with the linked publications, software and media.",
  body: `${head1("Research", "Glycans at the cell surface, and how molecules get past them")}
<section class="section tight"><div class="wrap">
  <div class="grid c2" style="gap:var(--s7)">${C.themes.map((t) => `<div class="theme" id="${t.id}"><h2 style="font-size:1.5rem;margin-bottom:var(--s3)">${esc(t.title)}</h2><p>${esc(t.text)}</p><ul>${t.items.map((id) => `<li><a href="${byId[id].url}">${esc(byId[id].title)}</a> <span class="meta">· ${byId[id].kind === "paper" ? "Paper" : "Project"}</span></li>`).join("")}</ul></div>`).join("")}</div>
</div></section>`,
});

// Publications
const chipGroup = (name, legend, map) => `<fieldset class="fg-${name}"><legend>${legend}</legend><div class="chips">${Object.entries(map).map(([k, l]) => `<button type="button" class="chip" aria-pressed="false" data-filter="${name}" data-value="${k}">${esc(l)}</button>`).join("")}</div></fieldset>`;
page("/publications/", {
  title: "Publications", current: "/publications/",
  description: `All ${papers.length} publications and ${patents.length} patent on Glycosearch with PDF downloads, web apps and source code.`,
  body: `${head1("Publications", `${papers.length} publications and ${patents.length} patent`)}
<div class="wrap">
  <form class="toolbar" id="pub-filter" role="search" aria-label="Filter publications">
    <div class="search-field">${I.search}<label class="sr" for="pub-q">Search publications</label><input id="pub-q" name="q" type="search" placeholder="Search — e.g. heparan sulfate, GFP, Frapbot, CRISPR" autocomplete="off"></div>
    <div class="filters">
      ${chipGroup("type", "Type", C.labels.type)}
      ${chipGroup("topic", "Category", C.labels.topic)}
    </div>
  </form>
  <div class="result-bar"><span id="pub-count" role="status" aria-live="polite">${papers.length} of ${papers.length} publications · ${patents.length} of ${patents.length} patent</span><button type="button" class="linkbtn" id="pub-reset" hidden>Clear filters</button></div>
  <ol class="pubs" id="pubs" data-list="publications" data-total="${papers.length}">${papers.map(pubRow).join("\n")}</ol>
  <section id="patents" data-list="patents" data-total="${patents.length}" aria-labelledby="patents-h">
    <h2 class="list-h" id="patents-h">Patents</h2>
    <ol class="pubs">${patents.map(patentRow).join("\n")}</ol>
  </section>
  <div class="empty" id="pub-empty" hidden><p><strong>No publication or patent matches these filters.</strong></p><p>Try fewer filters, or <button type="button" class="linkbtn" data-ask-open>ask Glycosearch</button> in plain language.</p></div>
</div>`,
});

// Detail pages
function appliedBlock(it) {
  const t = it.tool;
  if (!t) return "";
  return `<section class="block applied" id="applied" aria-labelledby="applied-h">
      <h2 id="applied-h">Applied applications</h2>
      <h3>${esc(t.name)}</h3>
      <p>${esc(t.credit)}</p>
      <p class="ref">${esc(t.reference.authors)} ${esc(t.reference.title)}. <i>${esc(t.reference.journal)}</i> ${t.reference.year}, ${esc(t.reference.volume)}, ${esc(t.reference.pages)}. DOI ${esc(t.reference.doi)}</p>
      ${linkRows(t.actions)}
    </section>`;
}
function detail(it) {
  const isPaper = it.kind === "paper";
  const b = it.bib;
  const rel = (isPaper ? C.themes.filter((t) => t.items.includes(it.id)).flatMap((t) => t.items) : projects.map((p) => p.id)).filter((id, i, a) => id !== it.id && a.indexOf(id) === i).slice(0, 5);
  const rows = [];
  const isChapter = it.categories.includes("chapter");
  if (b.journal) rows.push([b.preprint ? "Preprint" : "Published in", esc(b.journal) + (b.volume_issue_pages ? ", " + esc(b.volume_issue_pages) : "")]);
  if (b.book) rows.push(["Book", `<i>${esc(b.book.title)}</i>${b.book.edition ? ", " + esc(b.book.edition) : ""}`], ["Editor", esc(b.book.editor)], ["Series", esc(b.book.series)], ["Pages", esc(b.book.pages)], ["Publisher", esc(b.book.publisher)]);
  if (b.year) rows.push([b.yearLabel || "Year", esc(b.dateText || b.year) + (b.yearNote ? ` <span class="meta">(${esc(b.yearNote)})</span>` : "")]);
  if (b.doi) rows.push(["DOI", `<span class="with-ico">${esc(b.doi)}${ico("https://doi.org/" + b.doi, `Open DOI ${b.doi}`)}</span>`]);
  if (b.document_type) rows.push(["Document", esc(b.document_type)]);
  if (it.types.length || it.roles.length) rows.push(["Type", [...it.types, ...it.roles].map((x) => esc(x.label)).join(" · ")]);
  if (it.topics.length) rows.push(["Categories", it.topics.map((x) => esc(x.label)).join(" · ")]);
  if (it.app) rows.push(["Software", esc(it.app)]);
  rows.push(["PDF", `${fmtBytes(it.pdf.bytes)}${b.pages ? ", " + b.pages + " pages" : ""}`]);
  const g = it.gallery;
  const other = it.actions.filter((a) => a.type !== "pdf");
  const unit = it.pageMode ? "Page" : "Image", pdfAct = it.actions[0], dlAct = it.actions[1];
  const data = (x) => `data-full="${x.full.url}" data-w="${x.full.w}" data-h="${x.full.h}" data-orig="${x.orig}" data-cap="${esc(x.caption)}"`;
  return {
    title: it.title, current: isPaper ? "/publications/" : "/projects/",
    description: it.abstract.slice(0, 180).replace(/\s+\S*$/, "") + "…",
    head: `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": isPaper ? (isChapter ? "Chapter" : "ScholarlyArticle") : "SoftwareSourceCode", name: it.title, headline: it.title, author: it.authors, abstract: it.abstract, url: C.site.origin + it.url, ...(b.year ? { datePublished: String(b.year) } : {}), ...(b.doi ? { sameAs: "https://doi.org/" + b.doi } : {}) }).replace(/</g, "\\u003c")}</script>`,
    body: `<div class="wrap" style="padding-top:var(--s7)">
<nav class="crumbs" aria-label="Breadcrumb"><a href="${isPaper ? "/publications/" : "/projects/"}">${isPaper ? "Publications" : "Projects"}</a> / ${isPaper ? "Paper " + String(it.n).padStart(2, "0") : "Project " + String(it.n).padStart(2, "0")}</nav>
<article class="detail" data-entry="${it.id}">
  <div>
    <p class="kicker">${isPaper ? (isChapter ? "Book chapter" : b.preprint ? "Preprint" : "Publication") : "Open-source project"}${it.app ? " · " + esc(it.app) : ""}</p>
    <h1>${esc(it.title)}</h1>
    <p class="authors">${esc(it.authors)}</p>
    <div class="primary-actions"><a class="btn" href="${it.actions[0].url}" target="_blank" data-action="pdf">${I.pdf}<span>${esc(it.actions[0].label)}</span></a>${actIco(it.actions[1])}</div>
    ${other.length ? linkRows(other) : ""}
    <dl class="dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <section class="abstract" aria-labelledby="abs-h">
      <h2 id="abs-h">${isPaper ? "Abstract" : "Description"}</h2>
      <p>${esc(it.abstract)}</p>
      ${it.statusNote ? `<p class="note">${esc(it.statusNote)}</p>` : ""}
    </section>
    ${appliedBlock(it)}
    ${rel.length ? `<section class="block"><h2>Related on this site</h2><ul class="related">${rel.map((id) => `<li><a href="${byId[id].url}">${esc(byId[id].title)}</a></li>`).join("")}</ul></section>` : ""}
  </div>
  <aside class="aside" aria-label="${it.pageMode ? "Complete paper, page by page" : "Figures"}">
    <div class="gallery${it.pageMode ? " pages" : ""}" data-gallery data-unit="${unit}" data-title="${esc(it.shortTitle)}">
${it.pageMode ? `      <div class="cap">
        <span class="pager">${g.length > 1 ? `<button type="button" class="icon-btn sm" data-g-prev aria-label="Previous ${unit.toLowerCase()}">${I.prev}</button>` : ""}<span data-g-count aria-live="polite">${unit} 1 of ${g.length}</span>${g.length > 1 ? `<button type="button" class="icon-btn sm" data-g-next aria-label="Next ${unit.toLowerCase()}">${I.next}</button>` : ""}</span>
        <span class="tools"><button type="button" class="icon-btn sm" data-g-open aria-label="Enlarge this ${unit.toLowerCase()} (full screen)" data-tip="Full screen">${I.expand}</button>${`<a class="ico" data-g-orig href="${g[0].orig}" target="_blank" aria-label="${it.pageMode ? "Open this page in the PDF" : "Open the original image file"}" data-tip="${it.pageMode ? "This page in the PDF" : "Original image file"}">${it.pageMode ? I.pdf : I.link}</a>`}${it.pageMode ? actIco(dlAct) : ""}</span>
      </div>
` : ""}
      <div class="stage"><button type="button" data-g-open aria-label="Enlarge this ${unit.toLowerCase()}">${`<img data-g-main src="${g[0].full.url}" width="${g[0].full.w}" height="${g[0].full.h}" alt="${unit} 1 of ${g.length}: ${esc(it.shortTitle)}" fetchpriority="high">`}</button></div>
${it.pageMode ? "" : `      <div class="cap">
        <span class="pager">${g.length > 1 ? `<button type="button" class="icon-btn sm" data-g-prev aria-label="Previous ${unit.toLowerCase()}">${I.prev}</button>` : ""}<span data-g-count aria-live="polite">${unit} 1 of ${g.length}</span>${g.length > 1 ? `<button type="button" class="icon-btn sm" data-g-next aria-label="Next ${unit.toLowerCase()}">${I.next}</button>` : ""}</span>
        <span class="tools"><button type="button" class="icon-btn sm" data-g-open aria-label="Enlarge this ${unit.toLowerCase()} (full screen)" data-tip="Full screen">${I.expand}</button>${`<a class="ico" data-g-orig href="${g[0].orig}" target="_blank" aria-label="${it.pageMode ? "Open this page in the PDF" : "Open the original image file"}" data-tip="${it.pageMode ? "This page in the PDF" : "Original image file"}">${it.pageMode ? I.pdf : I.link}</a>`}${it.pageMode ? actIco(dlAct) : ""}</span>
      </div>
`}
      <p class="figcap" data-g-cap${g[0].caption ? "" : " hidden"}>${esc(g[0].caption)}</p>
      ${g.length > 1 ? `<ul class="strip" aria-label="${it.pageMode ? "All pages" : "All images"}">${g.map((x, i) => `<li><button type="button" data-g-thumb="${i}" ${i === 0 ? 'aria-current="true"' : ""} aria-label="Show ${unit.toLowerCase()} ${i + 1} of ${g.length}" ${data(x)}>${img(x.small, "")}</button></li>`).join("")}</ul>` : `<span hidden data-g-thumb="0" ${data(g[0])}></span>`}
    </div>
  </aside>
</article></div>`,
  };
}
for (const it of all) page(it.url, detail(it));

// Patent detail
for (const p of patents) {
  const rows = [["Publication", esc(p.number)], ["Proprietor", esc(p.proprietor) + ' <span class="meta">(as printed on the specification)</span>'], ["Application", esc(p.application)], ["Priority", esc(p.priority)], ["Filed", esc(p.filed)], ["Grant published", esc(p.granted.text)], ["Document", esc(p.document)], ["Type", esc(C.labels.type.patent)]];
  page(p.url, {
    title: `${p.short} — ${p.title}`, current: "/publications/", description: p.description,
    head: `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "CreativeWork", additionalType: "Patent", name: p.title, identifier: p.short, author: p.inventors, description: p.description, url: C.site.origin + p.url, datePublished: p.granted.iso }).replace(/</g, "\\u003c")}</script>`,
    body: `<div class="wrap" style="padding-top:var(--s7)">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/publications/#patents">Publications</a> / Patent</nav>
<article class="detail" data-entry="${p.id}">
  <div>
    <p class="kicker">Patent · ${esc(p.number)}</p>
    <h1>${esc(p.title)}</h1>
    ${linkRows(p.actions)}
    <dl class="dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
    <section class="abstract" aria-labelledby="abs-h">
      <h2 id="abs-h">Description</h2>
      <p>${esc(p.description)}</p>
      <p class="note">${esc(p.note)}</p>
    </section>
    <section class="block"><h2>Related on this site</h2><ul class="related">${p.related.map((id) => `<li><a href="${byId[id].url}">${esc(byId[id].title)}</a></li>`).join("")}</ul></section>
  </div>
  <aside class="aside" aria-labelledby="inv-h">
    <div class="card inventors">
      <h2 id="inv-h">Inventors</h2>
      <ol>${p.inventors.map((n) => `<li>${n === p.owner ? `<strong>${esc(n)}</strong>` : esc(n)}</li>`).join("")}</ol>
      <p class="meta">${p.inventors.length} inventors, in the order printed on the specification</p>
    </div>
  </aside>
</article></div>`,
  });
}

// Software
const repos = all.flatMap((it) => it.actions.filter((a) => a.type === "code").map((a) => ({ it, a })));
const toolList = Object.values(tools);
page("/software/", {
  title: "Software", current: "/software/",
  description: "Web applications and source code repositories published with the research on Glycosearch.",
  body: `${head1("Software", "Tools that came out of the research")}
${sec("apps", "Web applications", "Open an app", `<div class="grid c3">${apps.map((p) => `<article class="card"><p class="kicker">Web app</p><h3><a href="${p.url}">${esc(p.app)}</a></h3><p>Published with: <a href="${p.url}">${esc(p.title)}</a></p>${iconRow({ ...p, actions: p.actions.filter((a) => a.type !== "pdf") })}</article>`).join("")}</div>`, { tight: true })}
${sec("applied", "Used in the research", "Applied applications", `<div class="grid c2">${toolList.map((t) => `<article class="card" id="${t.id}"><p class="kicker">Application by other authors</p><h3>${esc(t.name)}</h3><p>${esc(t.credit)}</p><p class="ref">${esc(t.reference.authors)} ${esc(t.reference.title)}. <i>${esc(t.reference.journal)}</i> ${t.reference.year}, ${esc(t.reference.volume)}, ${esc(t.reference.pages)}.</p><p>Used in: <a href="${byId[t.usedIn].url}">${esc(byId[t.usedIn].title)}</a></p><ul class="icons" aria-label="Links for ${esc(t.name)}">${t.actions.map((a) => `<li>${actIco(a)}</li>`).join("")}</ul></article>`).join("")}</div>`)}
${sec("code", "Source code", "Repositories", `<ul class="rows">${repos.map(({ it, a }) => `<li><div><span class="t">${esc(repoName(a.url))}</span><p class="d">${it.kind === "paper" ? "Paper" : "Project"}: <a href="${it.url}">${esc(it.title)}</a></p></div>${actIco(a)}</li>`).join("")}</ul>`)}`,
});

// Projects
page("/projects/", {
  title: "Projects", current: "/projects/",
  description: "The four Google Summer of Code projects linked from Glycosearch, each with its PDF, repository, wiki and press links.",
  body: `${head1("Projects", "Google Summer of Code projects")}
<section class="section tight" id="projects"><div class="wrap">
  <div class="grid c2">${projects.map((p) => `<article class="card" id="${p.id}">
    <a class="thumb" href="${p.url}" tabindex="-1" aria-hidden="true">${img(p.thumb, "")}</a>
    <p class="kicker">Project ${String(p.n).padStart(2, "0")} · ${p.topics.map((t) => esc(t.label)).join(" · ")}</p>
    <h3><a href="${p.url}">${esc(p.title)}</a></h3>
    <p>${esc(p.authors)}</p>
    <p>${esc(p.abstract.slice(0, 210).replace(/\s+\S*$/, ""))}…</p>
    ${iconRow(p, { skipRead: false })}
  </article>`).join("")}</div>
</div></section>`,
});

// Learning (takes over the former Resources page)
const pressInst = all.flatMap((it) => it.actions.filter((a) => ["press", "institution", "wiki", "gsoc"].includes(a.type)).map((a) => ({ it, a })));
const downloads = [...all.map((it) => ({ t: it.title, k: it.kind === "paper" ? "Paper PDF" : "Project PDF", url: it.actions[0].url, bytes: it.pdf.bytes, back: it.url })),
  ...toolList.flatMap((t) => t.actions.filter((a) => a.type === "manual").map((a) => ({ t: `${t.name} manual`, k: "Manual", url: a.url, bytes: a.bytes, back: t.url }))),
  { t: "Curriculum Vitae — Dr. Samuel Schmidt", k: "CV", url: "/assets/CV.pdf", bytes: fs.statSync(path.join(ADD, "cv/CV.pdf")).size, back: "/about/" }];
const subnav = [["symbols", "Symbols"], ["text", "Text"], ["examples", "N-/O-linked examples"], ["glycome", "Glycome"], ["glycomics", "Glycomics"], ["spaac", "SPAAC"], ["in-vivo", "In vivo"], ["references", "References"], ["downloads", "Downloads"]];
const h2ref = (t, r) => `${t}${r ? " " + refIco(r) : ""}`;
const figure = (m, cls = "") => `<figure class="lfig ${cls}">${zoom(m, m.alt)}</figure>`;
page("/learning/", {
  title: "Learning", current: "/learning/",
  description: "Glycan symbol and text nomenclature with interactive N- and O-linked examples, glycome, glycomics, SPAAC and reference material.",
  body: `${head1("Learning", "Glycoscience, step by step")}
<nav class="wrap subnav" aria-label="On this page">${subnav.map(([id, l]) => `<a href="#${id}">${l}</a>`).join("")}</nav>
${sec("symbols", "Glycan nomenclature", h2ref("Symbol nomenclature of glycan structures", RES["resource-nomenclature"]), `<p class="lead intro">${esc(C.nomenclatureText.symbol)}</p>${nomenclature("learn-nomen")}`, { tight: true })}
${sec("text", "Glycan nomenclature", h2ref("Text nomenclature of glycan structures", RES["resource-nomenclature"]), `<div class="split"><figure class="lfig">${textFigure(glycans.textFigure)}<figcaption><span></span>${ico(learnImg.text.url, "Open the original figure file: text nomenclature", "link", { external: false })}</figcaption></figure><div class="prose"><p>${esc(C.nomenclatureText.text)}</p></div></div>`)}
${sec("examples", "Glycan nomenclature", h2ref("Symbol and text nomenclature", RES["resource-nomenclature"]), `<div class="prose wide"><p>${esc(C.nomenclatureText.combined)}</p></div>
  <p class="relline with-ico">The two example glycans below are drawn from the supplied figure. ${ico(learnImg.combo.url, "Open the original figure file: symbol and text nomenclature", "link", { external: false })}</p>
  ${glycans.glycans.map((g) => `<h3 class="sub" id="glycan-${g.id}">${esc(g.title)}</h3>${glycanWidget(glycans, g.id)}`).join("")}`)}
${sec("glycome", "Concept", "Glycome", `<div class="split">${themedFigure(learnImg.glycome, "Glycome")}<div class="prose"><p>${esc(gloss.glycome.text)}</p></div></div>`)}
${sec("glycomics", "Concept", "Glycomics", `<div class="split">${themedFigure(learnImg.glycomics, "Glycomics")}<div class="prose"><p>${esc(gloss.glycomics.text)}</p></div></div>`)}
${sec("spaac", "Bioorthogonal chemistry", "Strain-Promoted Alkyne Azide Cycloaddition (SPAAC)", `<div class="prose wide"><p>${esc(gloss.spaac.text)}</p></div>
  <figure class="media-one">${localVideo}<figcaption><span>${esc(L.animation.caption)}</span></figcaption></figure>
  <ul class="srcline" aria-label="Sources for the SPAAC animation"><li><span>Related paper</span>${ico(byId[L.spaac.paper].url, `Related paper: ${byId[L.spaac.paper].title}`, "paper", { same: true })}</li><li><span>Video reference</span>${ico(L.spaac.videoReference.url, L.spaac.videoReference.label, "video")}</li></ul>
  <p class="method-note"><span>${esc(L.spaac.methodLabel)}:</span> ${esc(L.spaac.method)}</p>`)}
${sec("in-vivo", "Microscopy", "In vivo imaging", `<figure class="lfig full">${zoom(heroImg, C.home.figure.alt)}<figcaption><span>${esc(C.home.figure.caption)}</span>${ico(fileUrl(C.home.figure.file), "Open the original microscopy image", "link", { external: false })}</figcaption></figure>
  <ul class="srcline" aria-label="People for this section"><li><span>${esc(L.inVivo.person)}</span>${L.inVivo.links.map((l) => ico(l.url, l.label, l.type)).join("")}</li></ul>`)}
${sec("references", "Reference material", "References, press and institutions", `<ul class="rows">${C.resources.map((r) => `<li id="${r.id}"><div><span class="t">${esc(r.title)}</span><p class="d">${esc(r.group)}${r.related ? ` · <a href="${byId[r.related].url}">${esc(byId[r.related].shortTitle)}</a>` : ""}</p></div>${refIco(r)}</li>`).join("")}${pressInst.map(({ it, a }) => `<li><div><span class="t">${esc(a.row)}</span><p class="d">${it.kind === "paper" ? "Paper" : "Project"}: <a href="${it.url}">${esc(it.title)}</a></p></div>${actIco(a)}</li>`).join("")}</ul>`)}
${sec("downloads", "Downloads", "All PDFs", `<ul class="rows">${downloads.map((d) => `<li><div><span class="t"><a href="${d.back}">${esc(d.t)}</a></span><p class="d">${d.k} · ${fmtBytes(d.bytes)}</p></div><ul class="icons"><li>${ico(d.url, `Open PDF: ${d.t}`, "pdf", { external: false })}</li><li>${ico(d.url, `Download PDF: ${d.t}`, "pdf", { download: true })}</li></ul></li>`).join("")}</ul>`)}`,
});

// About
const P = C.profile;
const portrait = media(path.join(LEGACY, P.portrait), "portrait.jpg", 520, 80);
// institution marks, centred under the period: image marks only, natural proportions, one variant per theme
const orgLogo = (key) => { const l = key && P.logos[key]; if (!l) return ""; const im = (f, cls, alt) => `<img class="${cls}" src="/assets/site/logos/${f}" width="${l.w}" height="${l.h}" alt="${esc(alt)}" loading="lazy" decoding="async">`; return `<span class="org-logo" style="--h:${l.show}px">${im(l.light, "on-light", l.alt)}${im(l.dark, "on-dark", l.alt)}</span>`; };
const pLink = (l) => { const u = live(l.url); return u ? `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>` : ""; };
page("/about/", {
  title: "About & Contact", current: "/about/",
  description: "Profile, CV and contact details of Dr. Samuel Schmidt, the researcher behind Glycosearch.",
  body: `${head1("About &amp; Contact", esc(P.name), esc(P.headline))}
<section class="section tight"><div class="wrap profile">
  <div>
    <div class="portrait">${img(portrait, "Portrait of Dr. Samuel Schmidt")}</div>
    <div class="cta contact" id="contact"><a class="btn" href="mailto:${C.site.email}">Email</a><a class="btn ghost" href="/assets/CV.pdf" target="_blank">${I.pdf}<span>Curriculum Vitae (PDF)</span></a></div>
    <ul class="profiles" aria-label="Profiles">${P.links.map(pLink).join("")}</ul>
  </div>
  <div>
    <div class="prose"><h2 style="margin-bottom:var(--s4)">Career profile</h2>${P.career.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    <h2 style="margin:var(--s7) 0 var(--s3)">Experience</h2>
    <ol class="timeline">${P.experience.map((x) => `<li><div class="when"><span>${esc(x.when)}</span>${orgLogo(x.logo)}</div><div><h3>${esc(x.role)}</h3>${whereLinks(x)}<p>${esc(x.text)}</p>${x.products ? `<ul class="linkrows">${x.products.map((l) => `<li><span><b>${esc(l.name)}</b> — ${esc(l.text)}</span>${extIco(l.url, `Open ${l.name}`)}</li>`).join("")}</ul>` : ""}</div></li>`).join("")}</ol>
    <div class="grid c3" style="margin-top:var(--s7)">
      <div class="theme"><h3>Education</h3><ul>${P.education.map((e) => `<li>${esc(e.degree)}<br><span class="meta">${esc(e.place)}</span></li>`).join("")}</ul></div>
      <div class="theme"><h3>Languages</h3><ul>${P.languages.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>
      <div class="theme"><h3>Interests</h3><ul>${P.interests.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>
    </div>
    <h2 style="margin:var(--s7) 0 var(--s3)">Earlier projects and activities</h2>
    <ul class="rows">${P.activities.map((a) => `<li><div><span class="t">${esc(a.title)}</span><p class="d">${esc(a.text)}</p></div>${a.url ? extIco(a.url, a.linkLabel || `Open ${a.title}`, a.linkLabel ? "institution" : "link") : ""}</li>`).join("")}</ul>
  </div>
</div></section>`,
});

page("/404.html", { title: "Page not found", body: `<div class="wrap page-head"><p class="kicker">404</p><h1>This page does not exist</h1><div class="cta" style="display:flex;gap:12px;margin-top:var(--s5);flex-wrap:wrap"><a class="btn" href="/publications/">Publications</a><button class="btn ghost" type="button" data-ask-open>Ask Glycosearch</button></div></div>` });

// ---------- redirects (old live URLs and URLs of the first preview) ----------
const redirects = [["papers.html", "/publications/"], ["projects.html", "/projects/"], ["about.html", "/about/"], ["links.html", "/learning/"], ["presentations.html", "/publications/"], ["resources/index.html", "/learning/"]];
for (const p of papers) if (p.legacyDetail) redirects.push([p.legacyDetail, p.url]);
for (const p of projects) { redirects.push([p.legacyDetail, p.url]); redirects.push([`software/${p.slug}/index.html`, p.url]); }
const stub = (to) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved · Glycosearch</title><meta name="robots" content="noindex">${FAVICON_LINKS}<link rel="canonical" href="${C.site.origin}${to.split("#")[0]}"><meta http-equiv="refresh" content="0; url=${to}"><link rel="stylesheet" href="/assets/site/styles.css">${THEME_BOOT}<script>location.replace(${JSON.stringify(to)})</script></head><body><div class="stub"><h1>This page has moved</h1><p><a href="${to}">Continue to the new page</a></p></div></body></html>`;

// ---------- search index ----------
const entries = [];
let order = 0;
const ixAct = ({ type, label, url, external, download, name, aria, applied }) => ({ type, label, url, external: !!external, download: !!download, name: name || "", aria, ...(applied ? { applied } : {}) });
for (const it of all) entries.push({
  id: it.id, kind: it.kind, order: order++, url: it.url, title: it.title, shortTitle: it.shortTitle, authors: it.authors, authorsShort: it.authorsShort,
  year: it.bib.year || null, journal: it.bib.journal || null, status: it.bib.preprint ? "preprint" : "", app: it.app, keywords: it.keywords, tags: [...it.types, ...it.roles, ...it.topics].map((t) => t.label),
  text: it.abstract, basis: "abstract", basisLabel: it.kind === "paper" ? "Abstract" : "Project description",
  thumb: it.thumb.url, actions: it.actions.map(ixAct),
  ...(it.tool ? { applied: { id: it.tool.id, name: it.tool.name, by: it.tool.by, credit: it.tool.credit, actions: it.applied.map(ixAct) } } : {}),
});
for (const p of patents) entries.push({ id: p.id, kind: "patent", order: order++, url: p.url, title: p.title, shortTitle: p.short, authors: p.inventors.join("; "), authorsShort: "", year: p.year, journal: p.number, app: "", keywords: p.keywords, tags: [C.labels.type.patent], text: `${p.description} Inventors: ${p.inventors.join("; ")}. Proprietor on the specification: ${p.proprietor}. Priority ${p.priority}; filed ${p.filed}; grant published ${p.granted.text}.`, basis: "description", basisLabel: "Patent description", actions: p.actions.map(ixAct) });
// applications by other authors that were used in a study: findable, but never listed as the site owner's software
for (const t of toolList) entries.push({ id: t.id, kind: "tool", order: order++, url: t.url, title: t.name, shortTitle: t.name, authors: t.reference.authors, authorsShort: t.by, year: t.reference.year, journal: t.reference.journal, app: "", keywords: t.keywords, tags: ["Applied application"], text: `${t.credit} ${t.refText} Used in: ${byId[t.usedIn].title}.`, basis: "description", basisLabel: "Attribution", usedIn: t.usedIn, actions: t.actions.map(ixAct) });
for (const r of C.resources) { const u = live(r.url); entries.push({ id: r.id, kind: "resource", order: order++, url: "/learning/#" + r.id, title: r.title, shortTitle: r.title, authors: "", authorsShort: "", app: "", keywords: r.keywords, tags: [r.group], text: r.description, basis: "description", basisLabel: "Reference", actions: u ? [{ type: r.id === "resource-eth-frap" ? "institution" : "link", label: "Reference", url: u, external: true, name: "", aria: `Open reference: ${r.title}` }] : [] }); }
const pageEntry = (id, url, title, keywords, text, tags = ["Learning"]) => entries.push({ id, kind: "profile", order: order++, url, title, shortTitle: title, authors: "", authorsShort: "", app: "", keywords, tags, text, basis: "description", basisLabel: "Glycosearch", actions: [] });
pageEntry("page-nomenclature", "/learning/#symbols", "Interactive glycan symbol nomenclature", "glycan symbols monosaccharide nomenclature " + legacy.nomenclature.shapes.map((s) => s.label.replace(/, Code.*$/, "")).join(" "), C.nomenclatureText.symbol);
pageEntry("page-text-nomenclature", "/learning/#text", "Text nomenclature of glycan structures", "text nomenclature modified IUPAC condensed linear 2D anomeric carbon", C.nomenclatureText.text);
pageEntry("page-glycan-examples", "/learning/#examples", "N- and O-linked glycan examples: symbol and text nomenclature", "N-linked O-linked glycan N-glycan O-glycan examples NeuAc Gal GlcNAc Man Fuc GalNAc sialic acid linkage alpha2-6 alpha2-3 antenna interactive", C.nomenclatureText.combined);
pageEntry("page-glycome", "/learning/#glycome", "Glycome", "glycome glycan profile", gloss.glycome.text);
pageEntry("page-glycomics", "/learning/#glycomics", "Glycomics", "glycomics glycan-binding protein N-glycans O-glycans glycosphingolipid", gloss.glycomics.text);
pageEntry("page-spaac", "/learning/#spaac", "Strain-Promoted Alkyne Azide Cycloaddition (SPAAC)", "SPAAC click chemistry copper-free cyclooctyne azide triazole video animation", gloss.spaac.text);
entries.push({ id: "page-about", kind: "profile", order: order++, url: "/about/", title: "About Dr. Samuel Schmidt — profile, CV and contact", shortTitle: "About & Contact", authors: "Samuel Schmidt", authorsShort: "", app: "", keywords: "contact email " + C.site.email + " cv curriculum vitae biography profile author researcher vaionex", tags: ["About"], text: P.career.join(" "), basis: "description", basisLabel: "Profile", actions: [{ type: "pdf", label: "Curriculum Vitae (PDF)", url: "/assets/CV.pdf", external: false, name: "", aria: "Open the curriculum vitae (PDF)" }] });
const fulltext = {};
for (const [id, t] of Object.entries(fulltextSrc)) if (byId[id]) fulltext[id] = t;

// ---------- write ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const out = (rel, data) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const copied = [];
function copyTree(rel, from = LEGACY) {
  const src = path.join(from, rel);
  if (!fs.existsSync(src)) throw new Error("missing original: " + src);
  fs.cpSync(src, path.join(DIST, rel), { recursive: true, filter: (s) => !s.endsWith(".DS_Store") && !s.endsWith("figures.json") && !s.endsWith("report.json") });
  copied.push(rel);
}
for (const d of ["papers_pdfs", "projects_pdfs", "manuals", "papers", "projects", "papers_thumbnails", "projects_thumbnails", "assets/images/samuel.png", "assets/images/Glycan_nomenclature_small.png", "assets/movies/video_white.mp4", "Nestin_invasion.jpg"]) copyTree(d);
// files added on 2026-11-25 (five papers with their figures, four learning figures): originals kept byte-for-byte
for (const d of ["papers_pdfs", "papers", "learning"]) copyTree(d, ADD);
// The CV offered for download is the updated edition of 2026-11-25 (additions/cv, built by scripts/build-cv.py).
// The historical CV stays untouched in the repository and in the live mirror; it is intentionally no longer served.
for (const f of ["CV.pdf", "CV.docx"]) { fs.mkdirSync(path.join(DIST, "assets"), { recursive: true }); fs.copyFileSync(path.join(ADD, "cv", f), path.join(DIST, "assets", f)); }
for (const f of new Set(Object.values(P.logos).flatMap((l) => [l.light, l.dark]))) { fs.mkdirSync(path.join(DIST, "assets/site/logos"), { recursive: true }); fs.copyFileSync(path.join(ADD, "logos", f), path.join(DIST, "assets/site/logos", f)); }
for (const [from, to] of [["favicon.ico", "favicon.ico"], ["apple-touch-icon.png", "apple-touch-icon.png"], ["icon-192.png", "assets/site/icon-192.png"], ["icon-512.png", "assets/site/icon-512.png"], ["favicon-16.png", "assets/site/favicon-16.png"], ["favicon-32.png", "assets/site/favicon-32.png"], ["favicon-48.png", "assets/site/favicon-48.png"]]) fs.copyFileSync(path.join(SITE, "src/icons", from), path.join(DIST, to));
// files that exist only in the older local repository copy: keep them resolvable at their old paths
for (const f of ["video.mp4", "Nestin_invasion_2.jpg", "Intrinsic Bond Orbital Analysis of a Strain-Promoted Alkyne Azide Cycloaddition.mp4", "assets/images/profile.png", "assets/images/Samuel.jpg"]) if (fs.existsSync(path.join(ROOT, f))) copyTree(f, ROOT);
for (const [a, b] of mediaCopies) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); }
for (const f of ["styles.css", "app.js", "search.js"]) out("assets/site/" + f, fs.readFileSync(path.join(SITE, "src", f)));
out("assets/site/favicon.svg", FAVICON);
out("assets/site/mask-icon.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="none" stroke="#000" stroke-width="2.3" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6"/></svg>');
out("assets/site/cursor.svg", CURSOR);
out("assets/site/index.json", JSON.stringify({ generated: new Date().toISOString().slice(0, 10), entries }));
out("assets/site/fulltext.json", JSON.stringify(fulltext));
for (const p of pages) out(p.url.endsWith("/") ? p.url + "index.html" : p.url, layout(p));
for (const [from, to] of redirects) out(from, stub(to));
out("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${C.site.origin}/sitemap.xml\n`);
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((p) => p.url.endsWith("/")).map((p) => `  <url><loc>${C.site.origin}${p.url}</loc></url>`).join("\n")}\n</urlset>\n`);
out("htaccess.example", `# Optional Apache rules. Rename to .htaccess only after confirming that the host allows overrides (AllowOverride).\n# The HTML redirect stubs already keep every old address working without this file.\nErrorDocument 404 /404.html\nAddDefaultCharset UTF-8\n${redirects.map(([f, t]) => `Redirect 301 /${f.replace(/index\.html$/, "").split("/").map(encodeURIComponent).join("/")} ${t.split("#")[0]}`).join("\n")}\n`);

// ---------- migration map ----------
const map = { generated: new Date().toISOString(), source: "http://glycosearch.com/ (mirror 2026-11-24) + additions of 2026-11-25", entries: [] };
for (const it of all) map.entries.push({ id: it.id, title: it.title, oldUrl: it.legacyDetail ? "/" + it.legacyDetail : "(new entry, 2026-11-25)", newUrl: it.url, pdf: decodeURIComponent(it.actions[0].url), pdfBytes: it.pdf.bytes, pdfSha256: it.pdf.sha256, images: it.images.length, actions: [...it.actions.filter((a) => a.type !== "pdf"), ...it.applied].map((a) => ({ legacyLabel: a.legacyLabel || "(new)", newLabel: a.row + (a.applied ? " [Applied applications]" : ""), url: a.url, check: linkStatus[a.url] || null })) });
fs.writeFileSync(path.join(SITE, "content/migration-map.json"), JSON.stringify(map, null, 1));
const st = (u) => { const s = linkStatus[u], g = linkNotes[u]; return (s ? `HTTP ${s.status || "no response"}${s.note ? " (" + s.note + ")" : ""}${s.final ? " → " + s.final : ""}` : "not checked") + (g ? ` · unreachable (${g.reason}) → ${g.noLink ? "shown as text only (owner decision)" : g.archive ? "site links the archived copy " + g.archive : "shown as text only"}` : ""); };
let md = `# Migration map: old Glycosearch → redesign\n\nGenerated by \`site/scripts/build.mjs\` on ${map.generated.slice(0, 10)}. Sources: live mirror \`legacy-live-2026-11-24/\` and the additions of 2026-11-25 in \`site/additions/\`.\nExternal link status comes from \`site/content/link-status.json\` and \`link-notes.json\`. Old URLs keep working through HTML redirect stubs; all files keep their original path and bytes.\n\n## Pages\n\n| Old URL | New page |\n| --- | --- |\n| /index.html | / |\n${redirects.filter(([f]) => !f.startsWith("ajax")).map(([f, t]) => `| /${f} | ${t} |`).join("\n")}\n\n## Papers and projects\n\n| ID | Title | Old detail URL | New page | PDF (unchanged path) | Images |\n| --- | --- | --- | --- | --- | --- |\n${map.entries.map((e) => `| ${e.id} | ${e.title} | ${e.oldUrl} | ${e.newUrl} | ${e.pdf} (${fmtBytes(e.pdfBytes)}) | ${e.images} |`).join("\n")}\n\n## Actions per entry\n\n| ID | Old label | New row | Target | External check |\n| --- | --- | --- | --- | --- |\n${map.entries.flatMap((e) => [`| ${e.id} | Get PDF | Read / Download PDF | ${e.pdf} | local file, sha256 ${e.pdfSha256.slice(0, 12)}… |`, ...e.actions.map((a) => `| ${e.id} | ${a.legacyLabel} | ${a.newLabel} | ${a.url} | ${a.url.startsWith("/") ? "local file" : st(a.url)} |`)]).join("\n")}\n\n## Profile and reference links\n\n| Label | Target | New location | External check |\n| --- | --- | --- | --- |\n${[...P.links.map((l) => [l.label, l.url, "/about/"]), ...P.activities.filter((a) => a.url).map((a) => [a.title, a.url, "/about/ (Earlier projects and activities)"]), ...P.experience.flatMap((x) => (x.products || []).map((l) => [l.name, l.url, "/about/ (Experience)"])), ...P.experience.flatMap((x) => (x.links || []).map((l) => [l.label.replace(/^Open (the )?/, ""), l.url, "/about/ (Experience)"])), ...C.resources.map((r) => [r.title, r.url, "/learning/#references"])].map(([l, u, w]) => `| ${l} | ${u} | ${w} | ${/^https?:/.test(u) ? st(u) : "local / mailto"} |`).join("\n")}\n`;
fs.writeFileSync(path.join(SITE, "MIGRATION-MAP.md"), md);

const count = (d) => fs.readdirSync(d, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).length;
console.log(`built ${pages.length} pages, ${redirects.length} redirect stubs, ${entries.length} index entries, ${Object.keys(fulltext).length} full texts, ${count(DIST)} files in dist`);

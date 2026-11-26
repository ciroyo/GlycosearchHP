#!/usr/bin/env node
// Acceptance checks for the built site (site/dist).
//   node scripts/check.mjs [--inventory <Brain linkinventar.json>] [--manifest <Brain dateimanifest.json>] [--url http://127.0.0.1:4173]
// Checks content mapping, critical links, legacy URLs, internal links, encoding, the icon-link rules,
// the glycan data model and its rendering, the profile, and search/chat hits.
// It does NOT test external availability (see scripts/check-links.mjs), visual layout or real pointer/touch input.
//
// Second correction round (owner order of 2026-11-25, evening): complete paper pages instead of figure cut-outs,
// home video instead of the in vivo hero image, a single SPAAC video, a one-line footer, no Authorship filter,
// an updated CV (the historical CV bytes are intentionally no longer served), X instead of Twitter, a patent,
// the book chapter type and a dark theme. Each replaced expectation is rewritten below, not deleted; see section "Round 2".
//
// History: the first suite (2026-11-24, 1538 checks) expected 14 papers, a combined "Software & Projects" page,
// a Resources page, visible archive notes and Protein Origami as software of paper 13. The owner changed these
// requirements on 2026-11-25; the old inventory is still used as proof of preservation, and every intended
// deviation from it is listed explicitly in CHANGED / REMOVED below instead of dropping the check.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildIndex, search, describe } from "../src/search.js";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(SITE, "dist"), ADD = path.join(SITE, "additions");
const arg = (n) => { const i = process.argv.indexOf("--" + n); return i > -1 ? process.argv[i + 1] : null; };
const rj = (rel) => JSON.parse(fs.readFileSync(path.join(SITE, rel), "utf8"));
const legacy = rj("content/legacy-extract.json"), C = rj("content/site.json"), additions = rj("content/additions.json"), G = rj("content/glycans.json"), notes = rj("content/link-notes.json");
const inv = arg("inventory") ? JSON.parse(fs.readFileSync(arg("inventory"), "utf8")) : null;
const manifest = arg("manifest") ? JSON.parse(fs.readFileSync(arg("manifest"), "utf8")) : null;

const pagesMeta = JSON.parse(fs.readFileSync(path.join(ADD, "pages/pages.json"), "utf8"));
const EXPECTED_PAGES = { "paper-15": 37, "paper-16": 13, "paper-17": 18, "paper-18": 28, "paper-19": 26 }; // owner order, checked against the PDFs
let pass = 0; const fails = [];
const ok = (cond, name, detail = "") => { if (cond) pass++; else fails.push(name + (detail ? " — " + detail : "")); };
const read = (rel) => fs.readFileSync(path.join(DIST, rel), "utf8");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fileUrl = (p) => "/" + p.split("/").map(encodeURIComponent).join("/");
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const section = (t) => console.log("\n# " + t);
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

// Owner decisions of 2026-11-25 that deliberately differ from the 2026-11-24 inventory
const CHANGED = { "mailto:samuel@glycosearch.com": "mailto:samuel@vaionex.com", "http://vaionex.com": "https://www.vaionex.com/", "http://www.vaionex.com": "https://www.vaionex.com/", "https://youtu.be/62UcawMOqnc": "https://www.youtube.com/watch?v=62UcawMOqnc", "http://www.kicnano.cornell.edu/fellows/": "https://www.kicnano.cornell.edu/" /* round 4: the owner asked for the current institute home page instead of the dead /fellows/ page (was shown as an archive copy) */, "https://twitter.com/glycosylation": "https://x.com/glycosylation" /* same account; twitter.com redirects there (checked 2026-11-25) */ };
const REMOVED = ["https://www.respora.com", "https://www.scitivia.com"]; // Respora: owner asked for no link; Scitivia: target gone, no archived copy
const REPLACED = ["http://www.kicnano.cornell.edu/fellows/"]; // a new live target replaces the archive copy noted in link-notes.json
const live = (u) => { const n = REPLACED.includes(u) ? null : notes[u]; return !n ? CHANGED[u] || u : n.noLink ? null : n.archive || null; };
const linked = (html, u) => { const t = live(u); return !!t && html.includes(`href="${esc(t)}"`); };

// 1. entries, pages, actions, files
section("Content mapping");
const added = additions.papers;
const biblio = rj("content/bibliography.json");
const items = [...legacy.papers.map((p) => ["paper", p, C.papers[p.id], "/publications/", true]), ...added.map((p) => ["paper", p, C.papers[p.id], "/publications/", false]), ...legacy.projects.map((p) => ["project", p, C.projects[p.id], "/projects/", true])];
ok(legacy.papers.length === 14, "14 papers preserved from the live site", String(legacy.papers.length));
ok(added.length === 5, "5 papers added on 2026-11-25", String(added.length));
ok(legacy.projects.length === 4, "4 projects in content base", String(legacy.projects.length));
ok(new Set(items.map((i) => i[1].id)).size === 23 && new Set(items.map((i) => i[2].slug)).size === 23, "23 entries with unique ids and slugs");
let actionCount = 0, projectActionCount = 0;
const pages = {};
for (const [kind, it, over, base, isLegacy] of items) {
  const rel = `${base}${over.slug}/index.html`.slice(1);
  const exists = fs.existsSync(path.join(DIST, rel));
  ok(exists, `${it.id} detail page exists`, rel);
  if (!exists) continue;
  const html = (pages[it.id] = read(rel));
  ok(html.includes(`<h1>${esc(it.title)}</h1>`), `${it.id} title intact`);
  ok(html.includes(`<p class="authors">${esc(it.authors)}</p>`), `${it.id} authors intact`);
  ok(html.includes(`<p>${esc(it.abstract.replace(/­/g, ""))}</p>`), `${it.id} abstract intact`);
  if (isLegacy) {
    const pdfUrl = fileUrl(it.pdf.path);
    ok(html.includes(`href="${pdfUrl}"`), `${it.id} PDF linked`, pdfUrl);
    ok(html.includes(`href="${pdfUrl}" download`), `${it.id} PDF download action`);
    const distPdf = path.join(DIST, it.pdf.path);
    ok(fs.existsSync(distPdf) && sha(distPdf) === it.pdf.sha256, `${it.id} PDF bytes identical to original`);
    if (kind === "project") projectActionCount++;
    for (const a of it.actions) {
      actionCount++; if (kind === "project") projectActionCount++;
      const href = a.local ? fileUrl(a.url) : esc(a.url);
      ok(html.includes(`href="${href}"`), `${it.id} action "${a.legacyLabel}" present`, a.url);
      if (a.local) ok(fs.existsSync(path.join(DIST, a.url)) && sha(path.join(DIST, a.url)) === a.file.sha256, `${it.id} local file for "${a.legacyLabel}" identical`);
    }
    for (const im of it.images) ok(fs.existsSync(path.join(DIST, im.path)) && fs.statSync(path.join(DIST, im.path)).size === im.bytes, `${it.id} original image kept`, im.path);
    ok((html.match(/data-g-thumb=/g) || []).length === it.images.length, `${it.id} gallery shows all ${it.images.length} images`);
    ok(fs.existsSync(path.join(DIST, it.thumbnail.path)), `${it.id} original thumbnail kept`);
    const stub = fs.existsSync(path.join(DIST, it.legacyDetail)) ? read(it.legacyDetail) : "";
    ok(stub.includes(`url=${base}${over.slug}/`), `${it.id} old URL /${it.legacyDetail} redirects`);
  } else {
    // added papers: files against site/additions and (independently) against the Brain manifest
    const pdfUrl = fileUrl(it.pdf), distPdf = path.join(DIST, it.pdf);
    ok(html.includes(`href="${pdfUrl}" target="_blank" data-action="pdf"`), `${it.id} PDF opens`, pdfUrl);
    ok(html.includes(`href="${pdfUrl}" download`), `${it.id} PDF download action`);
    ok(fs.existsSync(distPdf) && sha(distPdf) === sha(path.join(ADD, it.pdf)), `${it.id} PDF bytes identical to site/additions`);
    if (manifest) { const m = manifest.files.find((f) => f.name === path.basename(it.pdf)); ok(!!m && sha(distPdf) === m.sha256, `${it.id} PDF sha256 equals Brain manifest`, path.basename(it.pdf)); }
    // Round 2: the preview is the complete paper, page by page (was: gallery of figure cut-outs with captions)
    const pm = pagesMeta[it.id], nPages = EXPECTED_PAGES[it.id];
    ok(!!pm && pm.count === nPages && biblio[it.id].pages === nPages, `${it.id} has ${nPages} rendered pages (page count of the supplied PDF)`, String(pm?.count));
    ok(!!pm && pm.pdfSha256 === sha(distPdf), `${it.id} page images were rendered from the PDF that is served`);
    const thumbs = [...html.matchAll(/data-g-thumb="(\d+)"[^>]*?data-full="([^"]+)" data-w="(\d+)" data-h="(\d+)" data-orig="([^"]+)"/g)];
    ok(thumbs.length === nPages, `${it.id} viewer lists all ${nPages} pages`, String(thumbs.length));
    ok(thumbs.every((m, i) => +m[1] === i && m[2] === `/media/${it.id}/${i + 1}.jpg` && m[5] === `${pdfUrl}#page=${i + 1}`), `${it.id} pages in PDF order, each linked to its page in the PDF`);
    ok(thumbs.every((m) => fs.existsSync(path.join(DIST, m[2])) && fs.statSync(path.join(DIST, m[2])).size > 20000), `${it.id} every page image exists`);
    ok(!!pm && thumbs.every((m, i) => Math.abs(+m[3] / +m[4] - pm.pages[i].w / pm.pages[i].h) < 0.01 && Math.max(+m[3], +m[4]) >= 1500), `${it.id} page images keep the proportions of the full PDF page and stay legible`);
    ok(html.includes('data-unit="Page"') && html.includes(`>Page 1 of ${nPages}</span>`) && html.includes("data-g-prev") && html.includes("data-g-next") && html.includes('data-tip="Full screen"') && html.includes('aria-label="Open this page in the PDF"'), `${it.id} viewer: page count, previous/next, full screen, open in PDF`);
    ok((html.match(/<img data-g-main /g) || []).length === 1 && (html.match(/src="\/media\/[^"]*\/\d+\.jpg"/g) || []).length === 1 && thumbs.length === (html.match(/<img src="\/media\/[^"]*\/s\d+\.jpg"[^>]*loading="lazy"/g) || []).length, `${it.id} only the first page is loaded at once; thumbnails are lazy`);
    ok(!/<iframe|<embed|<object/.test(html), `${it.id} no embedded desktop PDF viewer`);
    ok(!it.figures.some((f) => html.includes(fileUrl(f.file))) && !html.includes("data-cap=\"Fig"), `${it.id} figure cut-outs are not used as the paper preview`);
    for (const f of it.figures) ok(fs.existsSync(path.join(DIST, f.file)), `${it.id} earlier figure derivative kept`, f.file);
    for (const l of it.links) ok(html.includes(`href="${esc(l.url)}"`) && html.includes(`aria-label="${esc(l.aria)}"`), `${it.id} link "${l.row}" present with its name`, l.url);
    const b = biblio[it.id];
    ok(html.includes(esc(b.doi)) && html.includes(`href="https://doi.org/${esc(b.doi)}"`), `${it.id} DOI shown and linked`, b.doi);
    const pre = it.categories.includes("preprint");
    ok(pre === !!b.preprint && html.includes(`<p class="kicker">${pre ? "Preprint" : "Publication"}`), `${it.id} status ${pre ? "preprint" : "journal article"} shown`);
    if (it.statusNote) ok(html.includes(esc(it.statusNote)), `${it.id} status note shown`);
  }
}
ok(projectActionCount === 18, "18 project actions incl. 4 PDFs", String(projectActionCount));
console.log(`entries: ${items.length}, legacy non-PDF actions: ${actionCount}, project actions incl. PDF: ${projectActionCount}`);
if (manifest) for (const f of ["Glycome.jpg", "Glycomics.jpg", "Text nomenclature.png", "Symbol nomenclature written in 2D version of text nomenclature.png"]) {
  const m = manifest.files.find((x) => x.name === f), d = path.join(DIST, "learning", f);
  ok(!!m && fs.existsSync(d) && sha(d) === m.sha256, `learning figure identical to Brain original: ${f}`);
}
{ // the two Datascience papers and the category
  const ds = added.filter((p) => p.categories.includes("datascience"));
  ok(ds.length === 2 && ds.every((p) => p.authors === "Robin Gounder, Samuel Schmidt"), "exactly two Datascience papers, authors Robin Gounder and Samuel Schmidt");
  ok(ds.some((p) => p.links.some((l) => l.url === "https://github.com/Kohze/norf-guide-selection") && /^Guide selection/.test(p.title)) && ds.some((p) => p.links.some((l) => l.url === "https://github.com/Kohze/microprotein-score-transfer") && /^Experimental context/.test(p.title)), "each Datascience paper carries its own repository");
}

// 2. Protein ORIGAMI: applied application with its own reference, not software of the site owner
section("Protein ORIGAMI attribution");
{
  const html = pages["paper-13"], T = C.tools[0], r = T.reference;
  const a = html.indexOf('id="applied"'), head = html.slice(0, a), box = html.slice(a, html.indexOf("</section>", a));
  ok(a > -1 && box.includes("<h2 id=\"applied-h\">Applied applications</h2>"), "paper 13 has an 'Applied applications' section");
  ok(box.includes(esc(T.credit)) && T.credit === "Protein ORIGAMI was developed by Sabine Reißer and colleagues and published separately. It was used in this study.", "attribution sentence present");
  ok(box.includes(esc(r.authors)) && box.includes(esc(r.title)) && box.includes(r.journal) && box.includes("2018, 46(4), 403–409") && box.includes("10.1002/bmb.21132"), "Reißer et al. 2018 reference complete");
  for (const u of ["http://www.ibg.kit.edu/protein_origami/?page=index", "https://github.com/sabinereisser/protein_origami", "/manuals/13/PROTEIN%20ORIGAMI.pdf", "https://doi.org/10.1002/bmb.21132"]) { ok(box.includes(`href="${esc(u)}"`), "applied section keeps " + u); ok(!head.includes(`href="${esc(u)}"`), "not among the paper's own actions: " + u); }
  ok(!/Schmidt/.test(r.authors), "site owner is not listed as an author of Protein ORIGAMI");
  ok(!C.papers["paper-13"].app && !html.includes("Publication · Protein"), "paper 13 no longer presents Protein Origami as its software");
  const soft = read("software/index.html"), s = soft.slice(soft.indexOf('id="applied"'), soft.indexOf('id="code"'));
  ok(s.includes("Application by other authors") && s.includes(esc(T.credit)) && s.includes("https://github.com/sabinereisser/protein_origami"), "software page lists it under applied applications with credit");
  ok(!soft.slice(soft.indexOf('id="apps"'), soft.indexOf('id="applied"')).includes("ORIGAMI") && !soft.slice(soft.indexOf('id="code"')).includes("protein_origami"), "not listed among own web apps or own repositories");
}

// 3. inventory from the Brain (independent source, state of 2026-11-24)
if (inv) {
  section("Brain link inventory cross-check");
  for (const e of [...inv.papers, ...inv.projects]) {
    const html = pages[e.id] || "";
    const pdf = fileUrl(decodeURIComponent(e.pdf_url).replace("http://glycosearch.com/", ""));
    ok(html.includes(`href="${pdf}"`), `inventory ${e.id} PDF`, pdf);
    for (const a of e.actions) {
      const local = a.url.startsWith("http://glycosearch.com/");
      const href = local ? fileUrl(decodeURIComponent(a.url).replace("http://glycosearch.com/", "")) : esc(a.url);
      ok(html.includes(`href="${href}"`), `inventory ${e.id} ${a.label}`, a.url);
    }
  }
  const about = read("about/index.html"), learn = read("learning/index.html");
  for (const l of inv.profile_links) {
    const u = l.url.replace("http://glycosearch.com/", "/");
    if (REMOVED.includes(l.url)) ok(!about.includes(l.url), `profile link removed by decision: ${l.label}`, l.url);
    else ok(about.includes(`href="${esc(u)}"`) || linked(about, l.url), `inventory profile link ${l.label}`, l.url);
  }
  for (const r of inv.resources) ok(linked(learn, r.url), `inventory reference ${r.label}`, r.url);
  ok(JSON.stringify(C.support.embedUrl) === JSON.stringify(inv.support_chat.embed_url), "Tawk.to embed URL equals inventory");
  for (const m of inv.media_saved) { const rel = m.url.replace("http://glycosearch.com/", ""); ok(fs.existsSync(path.join(DIST, rel)) && sha(path.join(DIST, rel)) === m.sha256, `inventory media ${rel} identical`); }
}

// 4. overview pages, navigation, home
section("Overview pages and navigation");
const pubs = read("publications/index.html"), soft = read("software/index.html"), proj = read("projects/index.html"), learn = read("learning/index.html"), home = read("index.html"), about = read("about/index.html"), research = read("research/index.html");
for (const p of [...legacy.papers, ...added]) ok(pubs.includes(esc(p.title)), `publications lists ${p.id}`);
{ const list = pubs.slice(pubs.indexOf('id="pubs"'), pubs.indexOf('id="patents"')), pat = pubs.slice(pubs.indexOf('id="patents"'));
  ok((list.match(/class="pub"/g) || []).length === 19 && (pat.match(/class="pub"/g) || []).length === 1, "publications: 19 scientific rows and, separately, 1 patent row"); }
ok(pubs.includes('data-filter="topic" data-value="datascience">Datascience</button>') && (pubs.match(/data-cats="[^"]*\bdatascience\b/g) || []).length === 2, "Datascience is its own filter and matches two rows");
ok(pubs.includes('data-value="preprint">Preprint</button>') && (pubs.match(/data-cats="[^"]*\bpreprint\b/g) || []).length === 4, "Preprint filter matches the four preprints");
for (const p of legacy.projects) { ok(proj.includes(esc(p.title)), `projects page lists ${p.id}`); for (const a of p.actions) ok(proj.includes(`href="${esc(a.url)}"`), `projects page: ${p.id} ${a.legacyLabel}`); ok(proj.includes(`href="${fileUrl(p.pdf.path)}"`), `projects page: ${p.id} PDF`); ok(!soft.includes(esc(p.title) + "</a></h3>"), `software page has no project card for ${p.id}`); }
for (const u of ["http://frapbot.kohze.com", "https://github.com/Kohze/Frapbot", "https://frapbotbeta.shinyapps.io/peptify/", "https://github.com/Kohze/Peptify.git", "https://github.com/Kohze/norf-guide-selection", "https://github.com/Kohze/microprotein-score-transfer"]) ok(soft.includes(`href="${esc(u)}"`), "software page: " + u);
for (const [f, t] of [["papers.html", "/publications/"], ["projects.html", "/projects/"], ["about.html", "/about/"], ["links.html", "/learning/"], ["presentations.html", "/publications/"], ["resources/index.html", "/learning/"]]) ok(read(f).includes("url=" + t), `old page /${f} redirects to ${t}`);
for (const p of legacy.projects) { const s = C.projects[p.id].slug; ok(read(`software/${s}/index.html`).includes(`url=/projects/${s}/`), `first-preview URL /software/${s}/ redirects to /projects/`); }
const NAV = [["/", "Home"], ["/research/", "Research"], ["/publications/", "Publications"], ["/software/", "Software"], ["/projects/", "Projects"], ["/learning/", "Learning"], ["/about/", "About"]];
ok(!/Selected work|Papers with their tools|Software you can open right now/.test(home), "home: no selected-papers / software blocks");
ok((home.match(/class="lcard"/g) || []).length === 6 && home.includes('id="playground"') && (home.match(/data-glyx="/g) || []).length === 2 && home.includes("data-nomen"), "home: six learning entries and the playground (N-/O-glycan, symbol chart)");
// Round 2: the hero shows the video 3NX8KXaOdgk instead of the in vivo image; the original image file stays available
ok(!home.includes("home-figure.jpg\" width") && !home.includes('data-zoom="/media/home-figure.jpg"') && fs.existsSync(path.join(DIST, "Nestin_invasion.jpg")), "home: in vivo image no longer in the hero, original file kept");
ok(!home.includes("class=\"pub\"") && !home.includes("class=\"card\""), "home has no publication or software cards");
const everything = [...legacy.papers, ...added, ...legacy.projects];
for (const t of C.themes) ok(research.includes(`id="${t.id}"`) && t.items.every((id) => research.includes(esc(everything.find((x) => x.id === id).title))), `research area ${t.id} lists its entries`);
ok([...legacy.papers, ...added].every((p) => C.themes.some((t) => t.items.includes(p.id))), "every paper belongs to a research area");

// 5. Learning
section("Learning");
for (const id of ["symbols", "text", "examples", "glycome", "glycomics", "spaac", "in-vivo", "references", "downloads", "glycan-n", "glycan-o"]) ok(learn.includes(`id="${id}"`), "learning section #" + id);
// Round 3: learning figures are theme-aware (vector, or derivatives with a transparent ground) and have no white box;
// the unchanged originals stay served and are linked next to each figure (was: the raster originals shown directly).
for (const f of Object.values(C.learning.figures)) { ok(fs.existsSync(path.join(DIST, f.file)) && sha(path.join(DIST, f.file)) === sha(path.join(ADD, f.file)), "original learning figure still served unchanged: " + f.file); ok(learn.includes(`href="${fileUrl(f.file)}"`), "learning links the original figure file: " + f.file); ok(!learn.includes(`<img src="${fileUrl(f.file)}"`), "learning no longer shows the white raster original: " + f.file); }
ok(learn.includes(esc(C.nomenclatureText.text)) && /^The text nomenclature comprises the anomeric carbon[\s\S]*particularly when representing the structure in 2D form\.$/.test(C.nomenclatureText.text), "text nomenclature: owner's wording");
ok(learn.includes(esc(C.nomenclatureText.combined)) && /^Examples of symbol nomenclature used to illustrate N- and O-linked glycans[\s\S]*\(e\.g\. alpha6 or beta4\)\.$/.test(C.nomenclatureText.combined), "symbol and text nomenclature: owner's wording");
{ // Round 2: the SPAAC section shows exactly the local archive video (was: YouTube 62UcawMOqnc next to it)
  const a = learn.indexOf('id="spaac"'), sp = learn.slice(a, learn.indexOf("</section>", a));
  ok((sp.match(/<video /g) || []).length === 1 && sp.includes('<source src="/assets/movies/video_white.mp4"') && !/<video[^>]*autoplay/.test(sp), "SPAAC: exactly one player, the local archive video, no autoplay");
  // Round 4: the YouTube source 62UcawMOqnc is wanted again, as a link button next to the paper button (not as a player)
  ok(!/<iframe/i.test(sp) && !/youtube\.com\/embed/.test(sp) && !/<iframe/.test(learn) && !learn.includes("data-yt="), "SPAAC: no YouTube player and no empty second media slot");
  ok((sp.match(/<figure/g) || []).length === 1 && sp.includes("Animation from the Glycosearch archive"), "SPAAC: one figure, captioned as Glycosearch archive video"); }
ok(learn.includes('data-zoom="/media/home-figure.jpg"'), "in vivo image visible on Learning");
ok((learn.match(/class="nomen-map"/g) || []).length === 1 && (learn.match(/data-rgb=/g) || []).length === 18, "symbol chart: 18 interactive symbols");
ok(learn.includes('href="https://web.archive.org/web/20200214171222/http://www.functionalglycomics.org:80/static/consortium/Nomenclature.shtml"'), "nomenclature reference links the archived page as a normal link");
{ const d = learn.slice(learn.indexOf('id="downloads"')); ok((d.match(/ download /g) || []).length === 25, "downloads: 23 entry PDFs + manual + CV", String((d.match(/ download /g) || []).length)); }

// 6. Glycan model and its rendering
section("N-/O-glycan model");
const SHAPE = { circle: /^<circle class="shape"/, square: /^<rect class="shape"/, diamond: /^<polygon class="shape"/, triangle: /^<polygon class="shape"/ };
const EXPECT = { // transcribed from the supplied figure "Symbol nomenclature written in 2D version of text nomenclature.png"
  n: { upper: "NeuAcα2-6Galβ1-4GlcNAcβ1-2Manα1", upperTo: 6, lower: "NeuAcα2-6Galβ1-4GlcNAcβ1-2Manα1", lowerTo: 3, core: "Manβ1-4GlcNAcβ1-4GlcNAc-Asn", top: "Fucα1", topTo: 6, comp: { NeuAc: 2, Gal: 2, GlcNAc: 4, Man: 3, Fuc: 1 } },
  o: { upper: "NeuAcα2-3Galβ1-4GlcNAcβ1", upperTo: 6, lower: "NeuAcα2-3Galβ1", lowerTo: 3, core: "GalNAcα-Thr", comp: { NeuAc: 2, Gal: 2, GlcNAc: 1, GalNAc: 1 } },
};
for (const g of G.glycans) {
  const E = EXPECT[g.id], by = Object.fromEntries(g.residues.map((r) => [r.id, r]));
  const tok = (r, last) => (r.parent ? `${r.sugar}${r.anomer}${r.from}${last ? "" : "-" + r.to}` : `${r.sugar}${r.anomer || ""}-${g.aglycon}`);
  const arm = (ids) => ids.map((id, i) => tok(by[id], i === ids.length - 1)).join("");
  const branchEnd = (id) => g.text.upper.at(-1) === id || g.text.lower.at(-1) === id || g.text.top === id;
  ok(arm(g.text.upper) === E.upper && by[g.text.upper.at(-1)].to === E.upperTo, `${g.id}: upper branch reads ${E.upper} → ${E.upperTo}`, arm(g.text.upper));
  ok(arm(g.text.lower) === E.lower && by[g.text.lower.at(-1)].to === E.lowerTo, `${g.id}: lower branch reads ${E.lower} → ${E.lowerTo}`, arm(g.text.lower));
  ok(g.text.core.map((id) => tok(by[id], false)).join("") === E.core, `${g.id}: core reads ${E.core}`);
  if (E.top) ok(tok(by[g.text.top], true) === E.top && by[g.text.top].to === E.topTo && by[g.text.top].parent === g.text.core.at(-1), `${g.id}: ${E.top} on position ${E.topTo} of the reducing-end residue`);
  const comp = {}; for (const r of g.residues) comp[r.sugar] = (comp[r.sugar] || 0) + 1;
  ok(JSON.stringify(Object.entries(comp).sort()) === JSON.stringify(Object.entries(E.comp).sort()), `${g.id}: composition`, JSON.stringify(comp));
  const roots = g.residues.filter((r) => !r.parent);
  ok(roots.length === 1 && g.residues.every((r) => { let x = r, n = 0; while (x.parent && n++ < 20) x = by[x.parent]; return x === roots[0]; }), `${g.id}: one tree, every residue reaches the reducing end`);
  ok(g.residues.every((r) => g.text.upper.concat(g.text.lower, g.text.core, g.text.top || []).includes(r.id)), `${g.id}: every residue appears in the text notation`);
  for (const ids of [g.text.upper, g.text.lower]) ok(ids.every((id, i) => (i === ids.length - 1 ? g.text.core.includes(by[id].parent) : by[id].parent === ids[i + 1])), `${g.id}: branch order equals the parent chain (${ids[0]})`);
  const sia = g.residues.filter((r) => r.sugar === "NeuAc");
  ok(sia.length === 2 && sia.every((r) => r.anomer === "α" && r.from === 2 && r.to === (g.id === "n" ? 6 : 3) && by[r.parent].sugar === "Gal"), `${g.id}: both NeuAc are α2-${g.id === "n" ? 6 : 3} on Gal`);

  // rendering on the Learning page: one widget, three views, same ids everywhere
  const a = learn.indexOf(`data-glyx="${g.id}"`), w = learn.slice(a, learn.indexOf("data-glyx-links", a));
  const svgs = [...w.matchAll(/<svg class="(glyx-[a-z]+(?: up)?)"[\s\S]*?<\/svg>/g)].map((m) => ({ cls: m[1], s: m[0] }));
  ok(svgs.length === 3 && svgs[0].cls === "glyx-text" && svgs[1].cls === "glyx-sym" && svgs[2].cls === "glyx-sym up", `${g.id}: text view and two symbol drawings rendered`);
  if (svgs.length !== 3) continue;
  const maxY = Math.max(...g.residues.map((r) => r.pos[1]));
  const centre = (s, id) => { const m = new RegExp(`data-res="${id}"[^>]*><circle class="hit" cx="([\\d.]+)" cy="([\\d.]+)"`).exec(s); return m ? [+m[1], +m[2]] : null; };
  for (const r of g.residues) {
    const info = new RegExp(`<button type="button" class="chip" data-res="${r.id}"[^>]*>([^<]+)</button>`).exec(w);
    // Round 2: the core button of the O-glycan carries the general label Thr/Ser; the concrete example (text view) stays Thr
    const general = !r.parent && g.aglyconGeneral ? `${r.sugar}${r.anomer}-${g.aglyconGeneral}` : null;
    ok(!!info && info[1] === (general || tok(r, false)), `${g.id}/${r.id}: list entry reads ${general || tok(r, false)}`, info?.[1]);
    ok(svgs.every((v) => (v.s.match(new RegExp(`class="res" data-res="${r.id}"`, "g")) || []).length === 1), `${g.id}/${r.id}: exactly once in each of the three views`);
    const t = new RegExp(`data-res="${r.id}"[^>]*><rect class="hit"[^>]*/><text [^>]*>([^<]+)</text>`).exec(svgs[0].s);
    ok(!!t && t[1] === tok(r, branchEnd(r.id)), `${g.id}/${r.id}: text part is its own token`, t?.[1]);
    for (const v of svgs.slice(1)) {
      const m = new RegExp(`data-res="${r.id}"[^>]*><circle class="hit"[^>]*/>(<[a-z]+ class="shape" fill="rgb\\(([\\d,]+)\\)"[^>]*>)`).exec(v.s);
      ok(!!m && SHAPE[G.sugars[r.sugar].shape].test(m[1]) && m[2] === G.sugars[r.sugar].rgb.join(","), `${g.id}/${r.id}: ${G.sugars[r.sugar].shape} in the ${r.sugar} colour (${v.cls})`);
      if (r.parent) { // the drawn bond really joins this residue to its parent
        const c = centre(v.s, r.id), p = centre(v.s, r.parent), e = new RegExp(`<line class="edge" data-edge="${r.id}" x1="([\\d.]+)" y1="([\\d.]+)" x2="([\\d.]+)" y2="([\\d.]+)"`).exec(v.s);
        ok(!!e && !!c && !!p && +e[1] === c[0] && +e[2] === c[1] && +e[3] === p[0] && +e[4] === p[1], `${g.id}/${r.id}: bond drawn to ${r.parent} (${v.cls})`);
        ok(new RegExp(`<text class="lk" data-edge="${r.id}"[^>]*>${r.anomer}${r.to}</text>`).test(v.s), `${g.id}/${r.id}: linkage label ${r.anomer}${r.to} on that bond (${v.cls})`);
      }
    }
    // upright drawing = horizontal drawing turned clockwise: (x, y) -> (maxY - y, x)
    const h = centre(svgs[1].s, r.id), u = centre(svgs[2].s, r.id);
    ok(!!h && !!u && Math.abs(u[0] - (22 + (maxY - r.pos[1]) * 46)) < 0.01 && Math.abs(u[1] - (22 + r.pos[0] * 46)) < 0.01 && Math.abs(h[0] - (22 + r.pos[0] * 46)) < 0.01 && Math.abs(h[1] - (22 + r.pos[1] * 46)) < 0.01, `${g.id}/${r.id}: same residue at the rotated position in the upright drawing`);
  }
  // the two sialic acids are different objects: selecting one must not address the other
  ok(new Set(sia.map((r) => centre(svgs[1].s, r.id).join())).size === 2 && sia[0].id !== sia[1].id, `${g.id}: the two NeuAc symbols are separate targets`);
}
ok(learn.indexOf('data-res="n-neuac-6"') > -1 && !learn.slice(learn.indexOf('data-glyx="o"')).includes('data-res="n-'), "N- and O-glycan residues never share ids (α2-6 vs α2-3 cannot be confused)");
ok((learn.match(/aria-label="NeuAcα2-6, N-acetylneuraminic acid, α1-6 antenna"/g) || []).length === 3 && (learn.match(/aria-label="NeuAcα2-3, N-acetylneuraminic acid, β1-3 branch"/g) || []).length === 3, "residues carry distinct accessible names (sugar, linkage, branch)");

// 7. every page: chats, navigation, support link, icon-link rules, encoding, internal links
section("All pages: chats, navigation, icon links");
const htmlFiles = fs.readdirSync(DIST, { recursive: true }).filter((f) => f.endsWith(".html"));
const COFFEE = '<a class="icon-btn quiet coffee" href="https://buymeacoffee.com/ciroyo" target="_blank" rel="noopener noreferrer" aria-label="Support my work on Buy Me a Coffee" data-tip="Support my work on Buy Me a Coffee">';
const BANNED = [/Archived copy/i, /unreachable/i, /class="ext"/, /class="u"/, /Six areas summarise/, /Categories are the ones used/, /Text as published on Glycosearch/, /As listed on the original profile/, /Profile text as published/, /listed as “Present”/, /served unchanged/, /original site linked/, /respora\.com/i, /samuel@glycosearch\.com/, /Dutch/];
let links = 0, icons = 0;
for (const f of htmlFiles) {
  const html = read(f);
  if (html.includes('http-equiv="refresh"')) continue;
  ok(html.includes(C.support.embedUrl) && html.includes("data-support-open"), `${f}: support chat wired`);
  ok(html.includes('id="ask"') && html.includes("data-ask-open"), `${f}: research chat wired`);
  ok(!/�|Ã©|Ã¤|â€/.test(html), `${f}: no encoding damage`);
  const nav = html.slice(html.indexOf('<nav class="nav"'), html.indexOf("</nav>"));
  ok(NAV.every(([h, l]) => nav.includes(`<a href="${h}"`) && nav.includes(`>${l}</a>`)) && (nav.match(/<a /g) || []).length === 7, `${f}: main navigation has the seven entries`);
  ok(html.split(COFFEE).length === 2 && (html.match(/buymeacoffee/g) || []).length === 1, `${f}: one support link (coffee icon), exact target, no written URL`);
  ok(html.includes(`href="mailto:samuel@vaionex.com"`), `${f}: contact address`);
  const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
  for (const re of BANNED) ok(!re.test(body), `${f}: no banned text ${re}`);
  ok(!/>\s*(?:https?:\/\/|www\.)[^<\s]+\s*</.test(body) && !/[a-z0-9-]+\.(?:com|org|io|ch|edu)\s*↗/.test(body), `${f}: no written-out URL or domain as link text`);
  // icon links: accessible name, tooltip, and the same name never points to two different targets
  const seen = new Map();
  let named = 0;
  for (const m of body.matchAll(/<a class="ico[^"]*" (?:data-g-orig )?href="([^"]*)"[^>]*?aria-label="([^"]*)"[^>]*?data-tip="([^"]*)"[^>]*>(.*?)<\/a>/g)) {
    icons++; named++;
    ok(m[2].trim().length > 8 && m[3].trim().length > 3 && /^<svg[\s\S]*<\/svg>$/.test(m[4]), `${f}: icon link has a name, a tooltip and only an icon`, m[2]);
    const key = m[2] + (/ download /.test(m[0]) ? " [download]" : "");
    if (seen.has(key) && seen.get(key) !== m[1]) ok(false, `${f}: icon name is unique per target`, key);
    seen.set(key, m[1]);
    if (/^https?:/.test(m[1])) ok(/target="_blank" rel="noopener noreferrer"/.test(m[0]), `${f}: external icon link opens safely`, m[1]);
  }
  ok((body.match(/<a class="ico/g) || []).length === named, `${f}: every icon link is named`);
  for (const m of html.matchAll(/(?:href|src|poster|data-zoom|data-full)="(\/[^"#?]*)/g)) {
    links++;
    const p = path.join(DIST, decodeURIComponent(m[1]));
    ok(fs.existsSync(p) && (fs.statSync(p).isFile() || fs.existsSync(path.join(p, "index.html"))), `${f}: internal link resolves`, m[1]);
  }
  for (const m of body.matchAll(/<img [^>]*>/g)) if (!/data-lb-img/.test(m[0])) ok(/ width="\d+" height="\d+"/.test(m[0]) && / alt="/.test(m[0]), `${f}: image has intrinsic size and alt`, m[0].slice(0, 60));
}
console.log(`pages: ${htmlFiles.length}, internal references checked: ${links}, icon links checked: ${icons}`);
{ const css = read("assets/site/styles.css");
  ok(!/object-fit:\s*cover/.test(css), "no image is cropped by object-fit: cover");
  ok(/cursor: url\("\/assets\/site\/cursor\.svg"\) 3 3, auto/.test(css) && /@media \(hover: hover\) and \(pointer: fine\)/.test(css) && fs.existsSync(path.join(DIST, "assets/site/cursor.svg")), "custom pointer only for mouse devices, with auto fallback");
  ok(/input\[type="text"\][^{]*\{ cursor: text/.test(css) && /a, a \*, button[^{]*\{ cursor: pointer/.test(css), "text fields and links keep the usual pointers");
  ok(/:focus-visible \{ outline: 3px solid/.test(css) && /\.ico \{[^}]*width: 36px; height: 36px/.test(css) && /@media \(pointer: coarse\) \{ \.ico \{ width: 44px; height: 44px/.test(css), "icon links: visible focus ring, 36 px target (44 px on touch)"); }

// 8. Profile
section("Profile");
const CAREER = "I am a researcher in biochemistry and molecular biology and the Co-Founder, CFO, Product Lead and Data Scientist of Vaionex Corporation, an AI and blockchain development and data science company.";
{ const t = text(about), P = C.profile, x = Object.fromEntries(P.experience.map((e) => [e.role, e]));
  ok(x["KIC PostDoc Fellow"]?.when === "2018 – 2022" && t.includes("2018 – 2022 KIC PostDoc Fellow"), "KIC PostDoc Fellow 2018–2022");
  ok(x["Co-Founder, CFO, Product Lead and Data Scientist"]?.when === "2020 – present" && t.includes("2020 – present Co-Founder, CFO, Product Lead and Data Scientist Vaionex Corporation"), "Vaionex 2020–present with the four roles");
  ok(P.experience.filter((e) => /Vaionex/.test(e.where)).length === 1 && !/Developer/.test(P.experience.map((e) => e.role).join()), "one Vaionex entry; the old 'Developer, 2016–present' entry is gone");
  ok(JSON.stringify(P.languages) === JSON.stringify(["German (Native)", "English (Professional)", "Swedish (Basic)"]) && t.includes("Swedish (Basic)") && !/Dutch/.test(t), "languages: German, English, Swedish (Basic)");
  // Round 2: exact owner sentence; Vaionex is an AI, blockchain and data science company (no consulting / biotech wording)
  ok(P.career[0] === CAREER && about.includes(`<p>${esc(CAREER)}</p>`), "career profile opens with the owner's exact sentence");
  ok(t.includes("Vaionex is an AI and blockchain development and data science company.") && /financial, legal and operational/.test(t) && /product strategy, product development,? and AI and data[- ]science solutions/.test(t) /* round 4: edited wording */ && /Agreements\.ai/.test(P.career[1]), "Vaionex description and role in Experience and career profile");
  ok(!/biotech|consulting company/i.test(about + JSON.stringify(P) + home + JSON.stringify(C.site)), "no biotech / consulting description of Vaionex");
  ok(!/Tegment|Relysia|Satolearn|TimeSeal/i.test(about + JSON.stringify(P)), "excluded products do not appear");
  ok(!/Present/.test(t) && !/2016/.test(t.replace(/© 2016–2026/, "")), "no stale 'Present' / 2016 statements");
  const side = about.slice(about.indexOf('class="portrait"'), about.indexOf('class="prose"'));
  ok(!/Curriculum Vitae|Email/.test(side.slice(side.indexOf('class="profiles"'))) && (side.match(/Curriculum Vitae/g) || []).length === 1 && (side.match(/>Email</g) || []).length === 1, "CV and email appear once as buttons, not again as list rows");
  ok(!/@glycosylation|@glycomics|in\/samuel-schmidt<|github\.com\/ciroyo</.test(side), "profile links without written-out handles");
  for (const p of x["Co-Founder, CFO, Product Lead and Data Scientist"].products) ok(about.includes(`href="${esc(p.url)}"`) && about.includes(`aria-label="Open ${esc(p.name)}"`), "current Vaionex example linked: " + p.name);
}

// 9. search / research chat
section("Ask Glycosearch (website search engine)");
const idx = JSON.parse(read("assets/site/index.json")), ft = JSON.parse(read("assets/site/fulltext.json"));
const byId = Object.fromEntries(idx.entries.map((e) => [e.id, e]));
const index = buildIndex(idx.entries, ft);
const Q = [
  ["Which paper describes the GFP complementation assay?", "paper-05", []],
  ["Find the short hydrophobic cell-penetrating peptides paper and its web app.", "paper-04", ["app"]],
  ["Where can I find the Frapbot GitHub repository?", "paper-12", ["code"]],
  ["Show me the Frapbot paper, its app and the ETH Zurich resource.", "paper-12", ["app", "institution"]],
  ["peptify", "paper-04", []],
  ["protein origami manual", "tool-protein-origami", ["manual"]],
  ["download the frapbot pdf", "paper-12", ["pdf"]],
  ["heparan sulfate clustering", "paper-09", []],
  ["ovarian cancer chondroitin sulfate", "paper-11", []],
  ["CMP-sialic acid transport", "paper-03", []],
  ["bicyclononynes ring-strained alkynes", "paper-14", []],
  ["BCN three-dimensional imaging of living cells", "paper-01", []],
  ["lactam stapled peptides", "paper-13", []],
  ["Cloud Firestore project", "project-03", []],
  ["Discovr github", "project-02", ["code"]],
  ["firedata shiny opencpu press", "project-04", ["press"]],
  ["interstitial cell migration Friedl", "paper-02", []],
  ["Wallbrecher stoichiometry", "paper-07", []],
  ["CPP uptake glycocalyx methods", "paper-06", []],
  ["drug delivery vectors bystanders", "paper-10", []],
  ["glycocalyx-mediated adhesion amoeboid migration nanogrips pdf", "paper-15", ["pdf"]],
  ["surface stress of biomedical silicones", "paper-16", []],
  ["recombinant lubricin biolubricants bioRxiv", "paper-17", ["preprint"]],
  ["guide selection noncanonical ORF screens github", "paper-18", ["code"]],
  ["microprotein sequence scores repository", "paper-19", ["code"]],
  ["CRISPR guide RNA replication SSRN", "paper-18", ["ssrn"]],
];
for (const [q, want, acts] of Q) {
  const r = search(index, q), top = r.hits[0];
  ok(top && top.id === want, `"${q}" → ${want}`, top ? "got " + top.id : "no hit");
  if (top) for (const t of acts) { const a = byId[top.id].actions.filter((x) => x.type === t); ok(top.highlight.includes(t) && a.length > 0, `"${q}" exposes ${t} action`, JSON.stringify(a.map((x) => x.url))); }
  if (top && byId[top.id].kind !== "tool") ok(byId[top.id].actions.some((a) => a.type === "pdf" && a.download), `"${q}" card has PDF download`);
}
{ // mandatory cases on the hit card itself
  const f = byId["paper-12"].actions.map((a) => a.url), p = byId["paper-04"].actions.map((a) => a.url);
  for (const u of ["http://frapbot.kohze.com", "https://github.com/Kohze/Frapbot", "https://www.radboudumc.nl/en/news/2017/frapbot-a-web-application-for-frap-data-analysis"]) ok(f.includes(u), "Frapbot card: " + u);
  ok(f.some((u) => u.startsWith("https://scopem.ethz.ch/education/knowledge-resources/FRAPandFLIP.html")), "Frapbot card: ETH Zurich");
  for (const u of ["https://frapbotbeta.shinyapps.io/peptify/", "https://github.com/Kohze/Peptify.git"]) ok(p.includes(u), "Peptify card: " + u);
  ok(byId["paper-18"].actions.some((a) => a.url === "https://github.com/Kohze/norf-guide-selection") && byId["paper-19"].actions.some((a) => a.url === "https://github.com/Kohze/microprotein-score-transfer") && !byId["paper-18"].actions.some((a) => /microprotein/.test(a.url)) && !byId["paper-19"].actions.some((a) => /norf-guide/.test(a.url)), "Datascience cards carry the right repository each");
}
{ // Protein ORIGAMI in search: found, attributed, never the site owner's software
  const tool = byId["tool-protein-origami"], p13 = byId["paper-13"], want = ["http://www.ibg.kit.edu/protein_origami/?page=index", "https://github.com/sabinereisser/protein_origami", "/manuals/13/PROTEIN%20ORIGAMI.pdf"];
  for (const u of want) { ok(tool.actions.some((a) => a.url === u), "Protein ORIGAMI entry: " + u); ok(!p13.actions.some((a) => a.url === u) && p13.applied.actions.some((a) => a.url === u), "paper 13 index: applied, not own action: " + u); }
  ok(tool.kind === "tool" && /Reißer/.test(tool.authors) && !/Schmidt/.test(tool.authors) && tool.year === 2018 && tool.usedIn === "paper-13", "tool entry: Reißer et al. 2018, used in paper 13");
  ok(!idx.entries.some((e) => /origami/i.test(e.app || "")) && p13.app === "", "no entry lists Protein Origami as its own app");
  const r = search(index, "lactam stapled peptides app"), d = describe(r, byId);
  ok(r.hits[0]?.id === "paper-13" && /belongs? to Protein ORIGAMI, an application by Reißer et al\. that was used in this study/.test(d.say), "asking for the lactam paper's app names the application and its authors", d.say);
  const r2 = search(index, "protein origami"); ok(r2.hits[0]?.id === "tool-protein-origami" && /developed and published by other authors/.test(describe(r2, byId).say), "asking for Protein Origami says it is by other authors", r2.hits[0]?.id);
  const own = idx.entries.filter((e) => e.kind === "paper" && e.actions.some((a) => a.type === "app")).map((e) => e.id).sort().join();
  ok(own === "paper-04,paper-12", "own web apps in the index are Peptify and Frapbot only", own);
}
{ const r = search(index, "Show the Datascience papers and their repositories."); const ids = r.hits.map((h) => h.id); ok(ids.includes("paper-18") && ids.includes("paper-19") && r.hits.slice(0, 2).every((h) => ["paper-18", "paper-19"].includes(h.id)) && r.hits[0].highlight.includes("code"), "Datascience question → both papers first, repositories highlighted", ids.join()); }
{ const r = search(index, "quantum computing pizza recipe"); ok(r.hits.length === 0, "unrelated question → no hits", JSON.stringify(r.hits.map((h) => h.id))); ok(/Nothing in the published/.test(describe(r, byId).say), "no-hit answer is explicit"); }
{ const r = search(index, "github"); ok(r.ambiguous && r.hits.length >= 5, "bare “github” → asks which entry", String(r.hits.length)); }
{ const r = search(index, "glycan symbol nomenclature"); ok(r.hits[0] && r.hits[0].id.startsWith("page-"), "nomenclature question → learning page, not a paper", r.hits[0]?.id); }
{ const r = search(index, "NeuAc alpha2-6 N-linked glycan example"); ok(r.hits[0]?.id === "page-glycan-examples", "N-glycan example question → interactive examples", r.hits[0]?.id); }
{ const r = search(index, "ETH Zurich FRAP and FLIP resource"); const kinds = r.hits.map((h) => byId[h.id].kind); ok(kinds.includes("resource") && kinds.includes("paper"), "ETH question distinguishes reference from paper", kinds.join(",")); }
{ const r = search(index, "curriculum vitae contact"); ok(r.hits[0]?.id === "page-about", "CV/contact → about page", r.hits[0]?.id); ok(/samuel@vaionex\.com/.test(byId["page-about"].keywords) && !JSON.stringify(idx).includes("samuel@glycosearch.com"), "index carries the current contact address only"); }
for (const e of idx.entries) { ok(["paper", "project", "resource", "profile", "tool", "patent"].includes(e.kind), "index kind valid " + e.id); for (const a of [...e.actions, ...((e.applied && e.applied.actions) || [])]) ok(typeof a.aria === "string" && a.aria.length > 8 && !/web\.archive\.org|https?:/.test(a.aria + a.label), `index action named without URL text: ${e.id} ${a.type}`); }
ok(idx.entries.filter((e) => e.kind === "paper").length === 19 && idx.entries.filter((e) => e.kind === "project").length === 4 && idx.entries.filter((e) => e.kind === "tool").length === 1, "index has 19 papers + 4 projects + 1 applied application");
ok(Object.keys(ft).filter((k) => /^paper-1[5-9]$/.test(k)).length === 5, "full text of the five new papers is searchable");
ok(!/Tegment|Relysia|Satolearn|TimeSeal|respora\.com/i.test(JSON.stringify(idx)), "index free of excluded products and of the Respora link");

// 9b. Round 2 (owner order of 2026-11-25, second correction round)
section("Round 2: home video, footer, brand, patent, chapter, CV, profile, filters, themes");
{ // home hero
  const hero = home.slice(home.indexOf('class="hero"'), home.indexOf('class="facts"'));
  ok(hero.includes('data-yt="3NX8KXaOdgk"') && hero.includes('href="https://www.youtube.com/watch?v=3NX8KXaOdgk"') && (hero.match(/<img /g) || []).length === 1 && hero.includes('<img class="yt-poster" src="https://i.ytimg.com/vi/3NX8KXaOdgk/maxresdefault.jpg"') && !/Nestin|home-figure/.test(hero), "home hero: video 3NX8KXaOdgk with a plain video link as fallback; the only image is the video's own poster");
  ok(/<button type="button" class="icon-btn sm" data-yt-sound hidden aria-label="Turn sound on"/.test(hero) && /<button type="button" class="icon-btn sm" data-yt-play hidden aria-label="Pause video"/.test(hero) && /<button type="button" class="yt-replay" data-yt-replay hidden aria-label="Replay the video">/.test(hero), "home hero: own play/pause, sound and replay buttons, hidden until the player reports its state");
  ok(!hero.includes("data-ask-open") && hero.includes(">Start learning</a>") && hero.includes(">Open the playground</a>"), "home hero: no Ask button; Start learning and Open the playground stay");
  ok(hero.includes(esc("Glycosearch explores glycoscience research, from the cell-surface glycocalyx and cell-penetrating peptides to bioorthogonal labeling and data science. Discover publications, research tools and an interactive learning playground.")) && !/Samuel|Schmidt/.test(text(hero)), "home hero: owner's introduction, no personal name");
  ok(!/Samuel|Schmidt/.test(C.home.lead + C.site.description + C.home.intro), "home texts and site description carry no personal name");
  const js = read("assets/site/app.js");
  // Round 3: the player runs without YouTube's control bar; own buttons; poster + Replay instead of the end screen
  ok(/youtube\.com\/iframe_api/.test(js) && /autoplay: reduce \? 0 : 1, mute: 1, playsinline: 1, controls: 0/.test(js) && /unMute\(\)/.test(js) && /\.mute\(\)/.test(js) && /isMuted\(\)/.test(js) && /pauseVideo\(\)/.test(js) && /onAutoplayBlocked/.test(js) && /onError: fail/.test(js), "home video script: IFrame API, muted inline autoplay (off for reduced motion), own play/pause and sound from the real player state, blocked-autoplay and error handling");
  ok(/const ended = st === 0;/.test(js) && /classList\.toggle\("ended", ended\)/.test(js) && /seekTo\(0, true\)/.test(js) && /\.video-frame\.yt\.ended iframe \{ visibility: hidden; \}/.test(read("assets/site/styles.css")) && hero.includes('class="yt-poster"'), "home video: after the end the player is taken out of view, a poster with Replay is shown; replay only on request");
  ok(!/loop: 1|setInterval\([^)]*playVideo/.test(js), "home video script: no forced restart");
  const facts = home.slice(home.indexOf('class="facts"'), home.indexOf("</div>", home.indexOf('class="facts"')));
  ok(/<a href="\/publications\/ep3360891b1-cell-penetrating-peptides-of-human-origin\/"><b>1<\/b><span>patent<\/span><\/a>/.test(facts) && !/glycan symbols/.test(facts) && /<b>19<\/b><span>publications/.test(facts), "home facts: '1 patent' links to the patent entry; 19 publications counted separately; '18 glycan symbols' gone");
  ok((home.match(/data-rgb=/g) || []).length === 18, "home playground keeps all 18 symbols of the chart");
}
{ // footer, brand, favicon, theme on every page
  const FOOT = '<footer class="site-footer"><p>© 2016–2026 Glycosearch</p></footer>';
  const FAV_LINKS = ['<link rel="icon" href="/favicon.ico?v=5" sizes="48x48">', '<link rel="icon" type="image/png" sizes="32x32" href="/assets/site/favicon-32.png?v=5">', '<link rel="icon" type="image/png" sizes="16x16" href="/assets/site/favicon-16.png?v=5">', '<link rel="icon" type="image/svg+xml" href="/assets/site/favicon.svg?v=5">', '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=5">', '<link rel="mask-icon" href="/assets/site/mask-icon.svg?v=5" color="#f96627">'].join("\n");
  const css = read("assets/site/styles.css");
  ok(/\.site-footer \{[^}]*text-align: center/.test(css), "footer line is centred");
  for (const f of htmlFiles) {
    const html = read(f);
    if (html.includes('http-equiv="refresh"')) { ok(html.includes('localStorage.getItem("gs-theme")'), `${f}: redirect stub applies the theme before paint`); ok(html.includes(FAV_LINKS), `${f}: redirect stub carries the same favicon definition`); continue; }
    ok(html.split(FOOT).length === 2 && (html.match(/<footer/g) || []).length === 1, `${f}: footer is exactly the copyright line`);
    ok(/<a class="brand" href="\/" aria-label="Glycosearch home"><svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><path class="ring" d="M12 2\.5l8\.2 4\.75v9\.5L12 21\.5l-8\.2-4\.75v-9\.5z"/.test(html), `${f}: linked brand carries the sugar-ring mark`);
    ok(html.includes(FAV_LINKS), `${f}: favicon variants linked (one shared definition)`);
    const head = html.slice(0, html.indexOf("</head>"));
    ok(head.indexOf('localStorage.getItem("gs-theme")') > -1 && head.indexOf('localStorage.getItem("gs-theme")') < head.indexOf('rel="stylesheet"') && /prefers-color-scheme: dark/.test(head) && head.includes('<meta name="color-scheme" content="light dark">'), `${f}: theme is set before the stylesheet (stored choice, else system)`);
    ok((html.match(/data-theme-toggle/g) || []).length === 1 && /<button class="icon-btn quiet theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark theme"/.test(html), `${f}: one theme switch in the header`);
  }
  const fav = read("assets/site/favicon.svg");
  // Round 3: the tab icon is the sugar ring in the reference orange, on a transparent ground (was: dark ring, blue core)
  ok(fav.includes("M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z") && /<rect width="24" height="24" rx="5\.4" fill="#f96627"\/>/.test(fav) && /stroke="#fff"/.test(fav) && /<circle[^>]*fill="#fff"/.test(fav) && !/#2f3e9e|#1b1e23/.test(fav), "favicon.svg is the same sugar ring, white on the brand orange");
  { const png = (p) => { const b = fs.readFileSync(path.join(DIST, p)); return { ok: b.subarray(1, 4).toString() === "PNG", w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: b[25] }; };
    for (const s of [16, 32, 48]) { const p = png(`assets/site/favicon-${s}.png`); ok(p.ok && p.w === s && p.h === s && p.type === 6, `favicon-${s}.png is a ${s} px PNG with alpha channel`); }
    const ico = fs.readFileSync(path.join(DIST, "favicon.ico")); ok(ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) === 3, "favicon.ico holds three sizes (16, 32, 48)");
    ok(read("assets/site/mask-icon.svg").includes("M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"), "mask icon (Safari pinned tab) is the same ring"); }
  for (const f of ["favicon.ico", "apple-touch-icon.png", "assets/site/icon-192.png", "assets/site/icon-512.png", "assets/site/favicon-16.png", "assets/site/favicon-32.png", "assets/site/favicon-48.png"]) ok(fs.existsSync(path.join(DIST, f)) && fs.statSync(path.join(DIST, f)).size > 150, "icon file present: " + f);
}
{ // theme tokens and contrast (WCAG 2 relative luminance), computed from the stylesheet itself
  const css = read("assets/site/styles.css");
  const block = (re) => Object.fromEntries([...(re.exec(css)?.[1] || "").matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
  const light = block(/^:root \{([\s\S]*?)^\}/m), dark = { ...light, ...block(/^:root\[data-theme="dark"\] \{([\s\S]*?)^\}/m) };
  const noJs = block(/prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme\]\) \{([\s\S]*?)\}/);
  ok(Object.keys(noJs).length >= 15 && Object.entries(noJs).every(([k, v]) => dark[k] === v), "dark tokens for browsers without JavaScript equal the scripted dark theme");
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const [name, T] of [["light", light], ["dark", dark]]) {
    for (const [fg, bg, min] of [["--ink", "--paper", 7], ["--ink", "--surface", 7], ["--ink-2", "--paper", 4.5], ["--ink-2", "--surface", 4.5], ["--muted", "--paper", 4.5], ["--muted", "--surface", 4.5], ["--accent", "--paper", 4.5], ["--accent", "--surface", 4.5], ["--accent-ink", "--accent-soft", 4.5], ["--on-ink", "--ink", 7], ["--on-accent", "--accent-fill", 4.5], ["--on-accent", "--accent-fill-hover", 4.5], ["--ink", "--hover", 7], ["--ink", "--mark", 4.5], ["--control", "--paper", 3], ["--control", "--surface", 3], ["--focus", "--paper", 3], ["--focus", "--surface", 3]])
      ok(T[fg] && T[bg] && cr(T[fg], T[bg]) >= min, `${name} theme contrast ${fg} on ${bg} ≥ ${min}`, T[fg] && T[bg] ? cr(T[fg], T[bg]).toFixed(2) : "token missing");
  }
  ok(lum(dark["--paper"]) < 0.02 && lum(dark["--surface"]) < 0.03 && lum(light["--paper"]) > 0.9, "dark theme has dark page and surface colours; light theme unchanged light");
  ok(light["--doc"] === "#ffffff" && !block(/^:root\[data-theme="dark"\] \{([\s\S]*?)^\}/m)["--doc"], "document surface behind figures, PDF pages and photos stays white in both themes");
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^:root[\s\S]*?^\}/m, "").replace(/:root\[data-theme="dark"\] \{[\s\S]*?\n\}/, "").replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}/, "").replace(/@media print \{[\s\S]*?\n\}/, "");
  const fixed = [...rules.matchAll(/([^{}]+)\{([^{}]*(?:#[0-9a-fA-F]{3,6}\b|rgba?\()[^{}]*)\}/g)].map((m) => m[1].trim()).filter((sel) => !/^\.lightbox|^\.yt-fallback|^\.yt-replay|^\.video-frame\.yt|^\.dot/.test(sel));
  ok(fixed.length === 0, "no hard-coded colours outside the tokens, except the image viewer, the video frame with its replay button, and the status dots", fixed.join(" | ").slice(0, 300));
  ok(!/#2f3e9e|#232f7c|#eceefa|#a3adff|#4a5bd6|#0b57d0|#8fb8ff|rgba\(47, 62, 158/i.test(css + read("assets/site/app.js") + read("assets/site/favicon.svg") + read("assets/site/cursor.svg") + home), "no blue accent value of the earlier design is left in styles, script, icons or pages");
  ok(!/filter:\s*invert|mix-blend-mode/.test(css), "no global colour inversion: scientific figures and glycan colours are untouched");
  const gl = JSON.stringify(G.sugars); ok(/\[\s*0,\s*\d+/.test(gl) && learn.includes('fill="rgb('), "glycan symbols keep their fixed nomenclature colours (inline rgb fills)");
  const js = read("assets/site/app.js"); ok(/localStorage\.setItem\("gs-theme"/.test(js) && /catch \{ \/\* storage blocked/.test(js) && !/location\.reload/.test(js), "theme choice is stored, survives blocked storage, and switching never reloads the page");
}
{ // patent
  const P1 = C.patents[0], ph = read(`publications/${P1.slug}/index.html`), t = text(ph);
  const INV = ["Parvesh Wadhwani", "Philipp Mühlhäuser", "Johannes Reichert", "Lucie Caillon", "Anne S. Ulrich", "Jan Maisch", "Peter Nick", "Cornelia Lee-Thedieck", "Saskia Kraus", "Roland Brock", "Samuel Schmidt", "Aastha Jain"];
  ok(JSON.stringify(P1.inventors) === JSON.stringify(INV), "patent data: twelve inventors in the order of the specification");
  const li = [...ph.matchAll(/<li>(?:<strong>)?([^<]+)(?:<\/strong>)?<\/li>/g)].map((m) => m[1]).filter((n) => INV.includes(n.replace(/&amp;/g, "&")));
  ok(JSON.stringify(li) === JSON.stringify(INV) && ph.includes("<strong>Samuel Schmidt</strong>") && t.includes("12 inventors"), "patent page: complete inventor list in order, Samuel Schmidt marked as one of them");
  ok(ph.includes("<h1>Cell penetrating peptides of human origin</h1>") && t.includes("EP 3 360 891 B1") && t.includes("Karlsruher Institut für Technologie") && t.includes("18156770.2") && t.includes("14 February 2017 (EP 17156097)") && t.includes("14 February 2018") && t.includes("30 March 2022 (Bulletin 2022/13)"), "patent page: number, title, proprietor, application, priority, filing and grant dates");
  ok(t.includes("The patent describes dermcidin-derived cell-penetrating peptides of human origin for transporting cargo molecules into cells.") && t.includes("no statement about the current legal status") && !/sole owner|in force|safe|effective treatment|clinical/i.test(t), "patent page: factual description, no legal-status, efficacy or safety claim");
  ok(ph.includes('href="https://worldwide.espacenet.com/patent/search/family/058056980/publication/EP3360891B1?q=EP3360891B1"') && ph.includes('aria-label="Open patent EP3360891B1 on Espacenet"') && ph.includes('href="https://patentimages.storage.googleapis.com/f2/42/a6/014998e9fedb1a/EP3360891B1.pdf"'), "patent page: Espacenet and specification as icon links");
  ok(pubs.includes('id="patents"') && pubs.includes(">Patents</h2>") && pubs.includes('data-cats="patent"') && pubs.includes(`href="/publications/${P1.slug}/"`) && /19 publications and 1 patent/.test(text(pubs)), "publications page: own Patents list, counted apart from the 19 publications");
  ok(idx.entries.filter((e) => e.kind === "patent").length === 1 && !idx.entries.some((e) => e.kind === "paper" && /EP3360891/.test(JSON.stringify(e))), "search index: one patent entry, not counted as a paper");
  for (const q of ["patent", "EP3360891B1", "dermcidin cell-penetrating peptides patent", "espacenet"]) { const r = search(index, q); ok(r.hits[0]?.id === "patent-01", `"${q}" → patent-01`, r.hits[0]?.id || "no hit"); }
  { const r = search(index, "patent"), d = describe(r, byId); ok(/the patent “Cell penetrating peptides of human origin”/.test(d.say), "research chat names it as a patent", d.say); }
}
{ // book chapter
  const ch = read("publications/glycocalyx-cpp-uptake-methods/index.html"), t = text(ch), b = biblio["paper-06"];
  ok(ch.includes('<p class="kicker">Book chapter') && /Type Book chapter/.test(t) && !/Primary publication|Published in/.test(t.slice(0, t.indexOf("Abstract"))), "paper 06 is shown as a book chapter, not as a journal publication");
  ok(t.includes("Cell-Penetrating Peptides: Methods and Protocols") && t.includes("2nd edition") && /Editor Ülo Langel/.test(t) && t.includes("Methods in Molecular Biology, vol. 1324") && /Pages 123–131/.test(t) && b.doi === "10.1007/978-1-4939-2806-4_8" && ch.includes('href="https://doi.org/10.1007/978-1-4939-2806-4_8"'), "paper 06: book, edition, editor, series volume, pages and chapter DOI");
  ok(ch.includes("<p class=\"authors\">Schmidt, S., Wallbrecher, R., van Kuppevelt, T.H., Brock, R.</p>") && !/Langel[^<]*<\/p>\s*<div class="primary-actions"/.test(ch), "paper 06: chapter authors unchanged; the editor is not listed as an author");
  ok(pubs.includes('data-value="chapter">Book chapter</button>') && (pubs.match(/data-cats="[^"]*\bchapter\b/g) || []).length === 1 && /id="paper-06"[^>]*data-cats="[^"]*\bchapter\b/.test(pubs), "Book chapter is a Type and matches exactly paper 06");
  ok(idx.entries.filter((e) => /glycocalyx-cpp-uptake-methods/.test(e.url)).length === 1 && byId["paper-06"].tags.includes("Book chapter") && fs.existsSync(path.join(DIST, legacy.papers[5].legacyDetail)), "paper 06 keeps its single entry and old URL");
}
{ // filters
  const tb = pubs.slice(pubs.indexOf('id="pub-filter"'), pubs.indexOf("</form>", pubs.indexOf('id="pub-filter"')));
  ok(!/Authorship|data-filter="role"/.test(tb) && (tb.match(/<fieldset/g) || []).length === 2 && /<legend>Type<\/legend>/.test(tb) && /<legend>Category<\/legend>/.test(tb), "filters: Type and Category only; Authorship is no longer selectable");
  ok(["primary", "reviews", "chapter", "preprint", "patent"].every((v) => tb.includes(`data-filter="type" data-value="${v}"`)) && tb.includes('data-filter="topic" data-value="datascience"'), "Type offers article, review, book chapter, preprint and patent; Category keeps Datascience");
  const css = read("assets/site/styles.css"); ok(/\.filters \{ display: grid; grid-template-columns: auto minmax\(0, 1fr\)/.test(css) && /\.filters \{ grid-template-columns: minmax\(0, 1fr\); \}/.test(css), "Type and Category share one row on desktop and stack on narrow screens");
  ok(pubs.includes("First author") && [...legacy.papers, ...added].every((p) => pubs.includes(esc(p.authors))), "author names and authorship tags stay visible in the list");
  const js = read("assets/site/app.js"); ok(/const GROUPS = new Set\(\["type", "topic"\]\)/.test(js) && /!GROUPS\.has\(k\)/.test(js), "old role=… address parameters are ignored and removed, not applied invisibly");
}
{ // profile round 2
  const side = about.slice(about.indexOf('class="portrait"'), about.indexOf('class="prose"'));
  ok(!side.includes("data-support-open") && !/Support chat/.test(text(side)) && about.includes("data-support-open"), "portrait: no support-chat button; the global support access remains");
  const WANT = [["Publons", "https://publons.com/researcher/1750018/dr-samuel-schmidt/"], ["ORCID", "https://orcid.org/0000-0001-9001-7970"], ["ResearchGate", "https://www.researchgate.net/profile/Samuel-Schmidt-4"], ["SSRN", "https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=13836088"], ["LinkedIn", "https://www.linkedin.com/in/samuel-schmidt/"], ["GitHub", "https://github.com/ciroyo"], ["Bluesky", "https://bsky.app/profile/glycomics.bsky.social"], ["X", "https://x.com/glycosylation"], ["Reddit", "https://www.reddit.com/user/Glycomics"], ["YouTube", "https://www.youtube.com/channel/UCZqqeWlCJnn1w35Ndttlu4Q"], ["Twetch", "https://twetch.app/u/14002"], ["Linktree", "https://linktr.ee/glycomics"]];
  const got = [...side.slice(side.indexOf('class="profiles"')).matchAll(/<li><a href="([^"]+)" target="_blank" rel="noopener noreferrer">([^<]+)<\/a><\/li>/g)].map((m) => [m[2], m[1].replace(/&amp;/g, "&")]);
  ok(JSON.stringify(got) === JSON.stringify(WANT), "profile links: the twelve targets in the owner's order", got.map((g) => g[0]).join(", "));
  ok(!/>Twitter</.test(about) && got[7]?.[0] === "X" && !/twitter\.com/.test(about), "X instead of Twitter, same account");
  // Round 3: image marks only, one variant per theme, no plate (was: Cornell wordmark logo, Radboudumc wordmark, Vaionex wordmark on plates)
  const L = C.profile.logos, tl = about.slice(about.indexOf('class="timeline"'));
  const rows = [...tl.matchAll(/<li><div class="when"><span>([^<]+)<\/span>(?:<span class="org-logo" style="--h:(\d+)px"><img class="on-light" src="\/assets\/site\/logos\/([^"]+)" width="\d+" height="\d+" alt="([^"]+)"[^>]*><img class="on-dark" src="\/assets\/site\/logos\/([^"]+)" width="\d+" height="\d+" alt="[^"]+"[^>]*><\/span>)?<\/div><div><h3>([^<]+)<\/h3>/g)].map((m) => ({ when: m[1], light: m[3], dark: m[5], alt: m[4], role: m[6] }));
  ok(rows.length === 4 && rows[0].light === "vaionex-symbol.png" && rows[0].dark === "vaionex-symbol.png" && rows[1].light === "cornell-seal-red.png" && rows[1].dark === "cornell-seal-white.png" && rows[1].role === "KIC PostDoc Fellow" && rows[2].light === "radboud-icon-red.svg" && rows[2].dark === "radboud-icon-white.svg" && rows[3].light === "radboud-icon-red.svg" && rows[3].dark === "radboud-icon-white.svg", "experience: Vaionex symbol (same in both themes), Cornell seal red/white, Radboud University icon red/white under the matching periods", JSON.stringify(rows.map((r) => [r.light, r.dark])));
  for (const f of new Set(Object.values(L).flatMap((l) => [l.light, l.dark]))) { const p = path.join(DIST, "assets/site/logos", f); ok(fs.existsSync(p) && sha(p) === sha(path.join(ADD, "logos", f)), "icon mark served as derived: " + f); }
  { const css = read("assets/site/styles.css"), rule = /\.org-logo \{([^}]*)\}/.exec(css)?.[1] || "";
    ok(!/background|border|padding/.test(rule) && !/org-logo (light|dark)"/.test(about), "icon marks stand directly on the page: no plate, frame or padding box");
    ok(/\.on-dark \{ display: none !important; \}/.test(css) && /:root\[data-theme="dark"\] \.on-light \{ display: none !important; \}/.test(css) && /prefers-color-scheme: dark\) \{ :root:not\(\[data-theme\]\) \.on-light/.test(css), "exactly one theme variant of an image is shown, also without JavaScript");
    const png = (f) => { const b = fs.readFileSync(path.join(ADD, "logos", f)); return { type: b[25], w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
    for (const f of ["cornell-seal-red.png", "cornell-seal-white.png", "vaionex-symbol.png"]) ok(png(f).type === 6 && png(f).w >= 500, "icon mark has an alpha channel and enough pixels for sharp display: " + f);
    const d = JSON.parse(fs.readFileSync(path.join(ADD, "logos/derivatives.json"), "utf8")); ok(d.cornell.outside_transparent === true && d.cornell_white_supplied.opaque_share === 1, "Cornell: outside of the seal is transparent; the supplied white file is recorded as fully opaque (checkerboard baked in), so white is derived from the red seal");
    const svgR = fs.readFileSync(path.join(ADD, "logos/radboud-icon-red.svg"), "utf8"), svgW = fs.readFileSync(path.join(ADD, "logos/radboud-icon-white.svg"), "utf8"), src = fs.readFileSync(path.join(ADD, "logos/source/Logo_Radboud_University.svg"), "utf8");
    const dAttr = (s) => [...s.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join("|");
    ok(dAttr(svgR) === dAttr(src) && dAttr(svgW) === dAttr(src) && /viewBox="0 0 312 400" fill="#[0-9a-f]{6}"/.test(svgR) && /fill="#ffffff"/.test(svgW) && !/<rect|<text/.test(svgR), "Radboud icon: same paths and viewBox as the supplied SVG, recoloured red / white, no background, no wordmark");
    for (const s of ["Cornell_red_bolt.png", "Cornell_white.png", "Logo_Radboud_University.svg", "Radboud_Universiteit_Wapen_in_kleur.png", "Vaionex_symbol.png"]) ok(fs.existsSync(path.join(ADD, "logos/source", s)), "supplied logo original kept in the project: " + s); }
  ok(L.cornell.show <= 64 && L.radboud.show <= 64 && L.vaionex.show <= 64 && L.vaionex.w >= 4 * L.vaionex.show, "icon marks are shown small (optical sizes) and never above their pixel size");
  ok(!/radboudumc|cornell-university\.svg|vaionex\.png/.test(about) && !/Radboudumc logo|Cornell University logo/.test(about), "no wordmark logos of the earlier round are left on the page");
  ok((about.match(/cornell-seal-red\.png/g) || []).length === 1 && rows[0].light !== "cornell-seal-red.png", "Cornell seal appears once, at the 2018–2022 fellowship (no current Cornell position implied)");
  ok(about.includes('aria-label="Open the Vaionex Corporation website"') && about.includes('href="https://www.vaionex.com/"'), "Vaionex link stays in the Experience context");
}
{ // 26 Nov 2026: Experience link buttons right of the affiliation, exact targets and order (owner request)
  const about = fs.readFileSync(path.join(DIST, "about/index.html"), "utf8");
  const SOLL = {
    "Co-Founder, CFO, Product Lead and Data Scientist": ["https://www.vaionex.com/"],
    "KIC PostDoc Fellow": ["https://www.kicnano.cornell.edu", "https://www.duffield.cornell.edu/cbe/"],
    "Roche PostDoc Fellow": ["https://www.ru.nl/en/rimls", "https://www.ru.nl/en/people/brock-r", "https://www.ru.nl/en/research"],
    "Ph.D. candidate": ["https://www.ru.nl/en/rimls", "https://www.ru.nl/en/people/friedl-p", "https://www.ru.nl/en/research"],
  };
  let anzahl = 0;
  for (const [rolle, urls] of Object.entries(SOLL)) {
    const m = about.match(new RegExp(`<h3>${rolle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h3><p class="where with-links"><span class="where-text">([^<]*)</span><span class="ico-group">((?:<a [^>]*>[\\s\\S]*?</a>)+)</span></p>`));
    ok(!!m, `experience links: affiliation and button group present for ${rolle}`);
    if (!m) continue;
    const as = [...m[2].matchAll(/<a ([^>]*)>/g)].map((x) => x[1]);
    const hrefs = as.map((a) => (a.match(/href="([^"]+)"/) || [])[1]);
    const labels = as.map((a) => (a.match(/aria-label="([^"]+)"/) || [])[1]);
    const tips = as.map((a) => (a.match(/data-tip="([^"]+)"/) || [])[1]);
    anzahl += hrefs.length;
    ok(JSON.stringify(hrefs) === JSON.stringify(urls), `experience links: targets and order for ${rolle}`, JSON.stringify(hrefs));
    ok(labels.every((l, i) => l && l === tips[i]) && new Set(labels).size === labels.length, `experience links: distinct accessible names equal to the tooltips for ${rolle}`, JSON.stringify(labels));
    ok(as.every((a) => /class="ico /.test(a) && /target="_blank"/.test(a) && /rel="noopener noreferrer"/.test(a)), `experience links: compact icon buttons opening a new tab for ${rolle}`);
    ok(!/https?:|www\./.test(m[1]) && !/https?:|www\./.test(m[2].replace(/<[^>]+>/g, "")), `experience links: no written URL for ${rolle}`);
  }
  ok(anzahl === 9, "experience links: 1 Vaionex + 8 new link buttons", String(anzahl));
  const labelsAll = [...about.matchAll(/class="ico-group">([\s\S]*?)<\/span><\/p>/g)].map((x) => x[1]).join("");
  for (const n of ["KIC", "Cornell Chemical and Biomolecular Engineering", "RIMLS", "Roland Brock", "Radboud University research", "Peter Friedl"]) ok(labelsAll.includes(n), `experience links: accessible name names ${n}`);
  { const css = fs.readFileSync(path.join(SITE, "src/styles.css"), "utf8");
    ok(/\.timeline \.where\.with-links \{[^}]*grid-template-columns: minmax\(0, 68ch\) auto; justify-content: space-between;[^}]*max-width: none;/.test(css) && /\.timeline \.ico-group \{[^}]*justify-self: end;/.test(css) && /\.linkrows \{[^}]*\}/.test(css) && !/\.linkrows \{[^}]*max-width/.test(css), "experience links: affiliation row spans the full column like the product rows, group anchored at the right edge (26 Nov 2026)");
    ok(/@media \(max-width: 560px\) \{ \.timeline \.where\.with-links \{ grid-template-columns: minmax\(0, 1fr\); \} \}/.test(css), "experience links: on narrow screens the group moves below the affiliation, still right-aligned"); }
  ok(/\.timeline \.ico-group \.ico\[data-tip\]::after \{ left: auto; right: 0; \}/.test(fs.readFileSync(path.join(SITE, "src/styles.css"), "utf8")), "experience links: tooltips open towards the text (not past the right edge)");
}
{ // CV: the file offered for download is the updated edition
  const cvPdf = path.join(DIST, "assets/CV.pdf"), cvDocx = path.join(DIST, "assets/CV.docx"), oldPdf = path.join(SITE, "../assets/CV.pdf"), oldDocx = path.join(SITE, "../assets/CV.docx"), mirror = path.join(SITE, "../legacy-live-2026-11-24/assets/CV.pdf");
  ok(sha(cvPdf) === sha(path.join(ADD, "cv/CV.pdf")) && sha(cvDocx) === sha(path.join(ADD, "cv/CV.docx")), "served CV.pdf and CV.docx are the updated edition from additions/cv");
  // intended exception to the earlier byte comparison: the historical CV is kept in the repository and the mirror, but no longer served
  ok(sha(cvPdf) !== sha(oldPdf) && sha(cvDocx) !== sha(oldDocx) && fs.existsSync(mirror) && sha(mirror) === sha(oldPdf), "historical CV untouched in repository and mirror; intentionally not served any more");
  ok(fs.readFileSync(cvPdf).subarray(0, 5).toString() === "%PDF-" && fs.readFileSync(cvDocx).subarray(0, 2).toString() === "PK", "CV files are a PDF and a DOCX");
  const src = text(fs.readFileSync(path.join(ADD, "cv/CV.html"), "utf8")).replace(/&quot;/g, '"').replace(/ ([;.,*])/g, "$1"); // bold/italic tags leave a space before punctuation
  const docx = execFileSync("unzip", ["-p", cvDocx, "word/document.xml"]).toString().replace(/<w:tab\/>/g, " ").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  const cv = rj("content/cv.json");
  for (const [name, t] of [["PDF source", src], ["DOCX", docx]]) {
    ok(t.includes("an AI and blockchain development and data science company") && t.includes("Co-Founder, CFO, Product Lead and Data Scientist") && t.includes("2020 – present") && t.includes("samuel@vaionex.com") && !/biotech|cornell\.edu|Datascience and biotech/i.test(t), `CV ${name}: Vaionex description, roles, period and contact are current`);
    for (const k of ["journal", "chapter", "preprints", "datascience"]) for (const e of cv.publications[k].items) ok(t.includes(e.title.replace(/\.$/, "")) && t.includes(e.doi), `CV ${name}: ${e.id} listed with DOI under "${cv.publications[k].heading}"`);
    const pos = (h) => t.indexOf(h), J = pos("Peer-reviewed journal articles"), B = pos("Book chapter"), Pp = pos("Preprints (not peer-reviewed)"), D = pos("Data science preprints (not peer-reviewed)"), Pa = Math.max(t.indexOf("PATENT"), t.indexOf("Patent\n"), t.lastIndexOf("Patent "));
    const within = (title, a, b) => { const i = t.indexOf(title); return i > a && (b < 0 || i < b); };
    ok(J > -1 && B > J && Pp > B && D > Pp, `CV ${name}: rubrics journal articles, book chapter, preprints, data science preprints in this order`);
    ok(within("The surface stress of biomedical silicones", J, B) && within("Methods to Study the Role of the Glycocalyx", B, Pp) && within("Glycocalyx-mediated Cell Adhesion and Migration", Pp, D) && within("Recombinant manufacturing of multispecies biolubricants", Pp, D) && within("Guide Selection Transfers Depletion Effects", D, -1) && within("Experimental Context Limits Transfer", D, -1), `CV ${name}: the five new works sit in the right rubrics; preprints are not labelled journal articles`);
    ok(t.includes("Langel, Ü. (ed.), Cell-Penetrating Peptides: Methods and Protocols, 2nd ed.; Methods in Molecular Biology, vol. 1324") && t.includes("pp 123–131"), `CV ${name}: book chapter cited with editor, book, series volume and pages`);
    ok(t.includes("European Patent EP 3 360 891 B1") && t.includes("Wadhwani, P.; Mühlhäuser, P.; Reichert, J.; Caillon, L.; Ulrich, A. S.; Maisch, J.; Nick, P.; Lee-Thedieck, C.; Kraus, S.; Brock, R.; Schmidt, S.; Jain, A.") && t.includes("Co-inventor"), `CV ${name}: patent in its own rubric with all twelve inventors`);
    ok(t.includes("Gounder, R.; Schmidt, S.") && t.includes("github.com/Kohze/norf-guide-selection") && t.includes("github.com/Kohze/microprotein-score-transfer") && t.includes("manuscript dated 29 October 2026") && t.includes("manuscript dated 10 November 2026") && !/Kohze, R\.; Schmidt, S\. (Guide|Experimental)/.test(t), `CV ${name}: data science preprints by Gounder and Schmidt, repositories kept, manuscript dates named as such`);
    ok(!/in preparation|submitted/i.test(t) && (t.match(/Glycocalyx-mediated Cell Adhesion and Migration/g) || []).length === 1, `CV ${name}: the former 'submitted' manuscript appears once, as the bioRxiv preprint`);
    ok(t.includes("German (native), English (professional), Swedish (basic)") && t.includes("KIC Postdoctoral Fellow") && t.includes("2018 – 2022"), `CV ${name}: languages and KIC fellowship 2018–2022`);
  }
  const n = ["journal", "chapter", "preprints", "datascience"].reduce((a, k) => a + cv.publications[k].items.length, 0);
  ok(n === 17 && new Set(["journal", "chapter", "preprints", "datascience"].flatMap((k) => cv.publications[k].items.map((e) => e.id))).size === 17, "CV lists 17 works once each (19 website entries minus the Synfacts highlight, cited under its paper, and the abstract without bibliographic data)");
  ok(about.includes('href="/assets/CV.pdf"') && learn.includes('href="/assets/CV.pdf"'), "CV button and downloads list point to the updated file");
}
{ // Thr/Ser on the general core button, everywhere the widget is used
  for (const [name, html] of [["learning", learn], ["home playground", home]]) {
    const a = html.indexOf('data-glyx="o"'), w = html.slice(a, html.indexOf("data-glyx-links", a));
    const chip = /<button type="button" class="chip" data-res="o-galnac"[^>]*data-general="GalNAcα-Thr\/Ser" aria-label="([^"]+)" data-tip="([^"]+)">GalNAcα-Thr\/Ser<\/button>/.exec(w);
    ok(!!chip && chip[1] === chip[2] && /Thr\/Ser/.test(chip[1]) && /threonine or serine/.test(chip[1]), `${name}: core O-GalNAc button reads GalNAcα-Thr/Ser, with matching accessible name and tooltip`);
    ok(/data-link="α-linked to Thr\/Ser \(threonine or serine\) of the protein; this example shows Thr"/.test(w), `${name}: description names Thr or Ser and says the example shows Thr`);
    const txt = /<svg class="glyx-text"[\s\S]*?<\/svg>/.exec(w)[0];
    ok(/>GalNAcα-Thr<\/text>/.test(txt) && !/Thr\/Ser/.test(txt) && /aria-label="GalNAcα-Thr, N-acetylgalactosamine, reducing end"/.test(w), `${name}: the concrete example structure stays GalNAcα-Thr`);
    const nW = html.slice(html.indexOf('data-glyx="n"'), a > html.indexOf('data-glyx="n"') ? a : undefined); ok(!/Thr|Ser\b/.test(nW.replace(/aria-[a-z]+="[^"]*"/g, "")) || /GlcNAcβ-Asn/.test(nW), `${name}: the N-glycan core is unchanged (Asn)`);
  }
  const o = G.glycans.find((g) => g.id === "o"); ok(o.aglycon === "Thr" && o.aglyconName === "threonine" && o.aglyconGeneral === "Thr/Ser" && o.aglyconGeneralName === "threonine or serine", "data model separates the example (Thr) from the general label (Thr/Ser)");
  ok(sha(path.join(DIST, "learning/Symbol nomenclature written in 2D version of text nomenclature.png")) === sha(path.join(ADD, "learning/Symbol nomenclature written in 2D version of text nomenclature.png")), "original example figure unchanged");
}

// 9c. Round 3 (owner order of 2026-11-25, third round): orange accent, icon marks, favicon, learning figures without
// white boxes or frames, calmer video. Rewritten round-2 expectations are marked "Round 3" where they stand.
section("Round 3: learning figures, chart symbols, frames, accent");
{ const css = read("assets/site/styles.css");
  // chart: 18 vector symbols with the data of the original chart; white parts stay white, outlines follow the theme
  const SPEC = { "Galactose (Gal)": ["circle", "255,255,0"], "N-Acetylgalactosamine (GalNAc)": ["square", "255,255,0"], "Galactosamine (GalN)": ["square-half", "255,255,0"], "N-Acetylneuraminic acid (Neu5Ac)": ["diamond", "200,0,200"], "N-Glycolylneuraminic acid (Neu5Gc)": ["diamond", "233,255,255"], "2-Keto-3-deoxynononic acid": ["diamond-hatch", "0,200,50"],
    "Glucose (Glc)": ["circle", "0,0,250"], "N-Acetylglucosamine (GlcNAc)": ["square", "0,0,250"], "Glucosamine (GlcN)": ["square-half", "0,0,250"], "Fucose (Fuc)": ["triangle", "250,0,0"], "Glucuronic acid (GlcA)": ["diamond-top", "0,0,250"], "Galacturonic acid (GalA)": ["diamond-left", "255,255,0"],
    "Mannose (Man)": ["circle", "0,200,50"], "N-Acetylmannosamine (ManNAc)": ["square", "0,200,50"], "Mannosamine (ManN)": ["square-half", "0,200,50"], "Xylose (Xyl)": ["star", "250,234,213"], "Iduronic acid (IdoA)": ["diamond-bottom", "150,100,50"], "Mannuronic acid (ManA)": ["diamond-right", "0,200,50"] };
  const legacyByName = Object.fromEntries(legacy.nomenclature.shapes.map((x) => [x.label.replace(/, Code.*$/, ""), (/Code \((\d+), (\d+), (\d+)\)/.exec(x.label) || []).slice(1).join(",")]));
  for (const [name, html] of [["learning", learn], ["home playground", home]]) {
    const a = html.indexOf('class="nomen-map"'), chart = html.slice(a, html.indexOf('class="nomen-info"', a));
    const btns = [...chart.matchAll(/<button type="button" aria-pressed="false" data-name="([^"]+)" data-rgb="([\d,]+)" data-kind="([a-z-]+)" aria-label="([^"]+)">(<svg class="sym"[\s\S]*?<\/svg>)<\/button>/g)];
    ok(btns.length === 18 && btns.map((m) => m[1]).join("|") === Object.keys(SPEC).join("|"), name + ": chart has the 18 symbols in the order of the original chart (rows Gal / Glc / Man)");
    ok(btns.every((m) => SPEC[m[1]] && SPEC[m[1]][0] === m[3] && SPEC[m[1]][1] === m[2] && legacyByName[m[1]] === m[2] && m[4] === m[1]), name + ": every symbol has the shape, name and RGB code recorded with the original chart");
    ok(btns.every((m) => m[5].includes('fill="rgb(' + m[2] + ')"') || m[5].includes('stroke="rgb(' + m[2] + ')"')), name + ": every symbol is drawn in its own nomenclature colour");
    const white = btns.filter((m) => /fill="#ffffff"/.test(m[5])).map((m) => m[3]);
    ok(white.length === 8 && white.every((k) => /half|top|bottom|left|right|hatch/.test(k)) && btns.filter((m) => /half|top|bottom|left|right|hatch/.test(m[3])).length === 8, name + ": the eight divided or hatched symbols keep their white part (content, not background)", white.join(","));
    ok(btns.every((m) => /class="shape"/.test(m[5])) && !/<img /.test(chart) && !chart.includes("Glycan_nomenclature_small.png"), name + ": symbols carry a theme-coloured outline; the chart is not a raster image any more");
  }
  ok(/\.sym \.shape, \.glyx \.shape \{ stroke: var\(--ink\)/.test(css) && /\.nomen-map \{ display: grid; grid-template-columns: repeat\(6,/.test(css) && !/\.nomen-map \{[^}]*(border|background)/.test(css), "chart: outlines use the text colour of the theme; grid of six columns; no frame or plate");
  ok(fs.existsSync(path.join(DIST, legacy.nomenclature.image)), "original chart image is still served at its old address");
  // text nomenclature figure as vector text
  const T = G.textFigure, a = learn.indexOf('id="text"'), sec = learn.slice(a, learn.indexOf("</section>", a)), fig = /<svg class="glyx-text textfig"[\s\S]*?<\/svg>/.exec(sec)?.[0] || "";
  ok(!!fig && [T.title, "Linear:", T.linear, "2D:", T.upper, T.core, T.lower].every((x) => fig.includes(">" + esc(x) + "</text>")) && fig.includes(`<text class="pos"`) && (fig.match(/<line class="bond"/g) || []).length === 2, "text nomenclature: title, linear and 2D notation, two bonds with their positions are drawn as text and lines");
  ok(T.linear === "NeuAcα2-3Galβ1-4(Fucα1-3)GlcNAcβ1-2Manα1-R" && T.upper + "-" + T.upperPos + "(" + T.lower + "-" + T.lowerPos + ")" + T.core === T.linear, "text nomenclature: the 2D parts and positions recombine exactly to the linear string");
  ok(/\.textfig text \{[^}]*fill: var\(--ink\)/.test(css) && /\.textfig \.bond \{ stroke: var\(--ink\)/.test(css) && !/<img /.test(sec), "text nomenclature: lettering and bonds follow the theme; no raster image");
  // N-/O-glycan section: the interactive drawings are the figure; no raster figure
  { const b = learn.indexOf('id="examples"'), ex = learn.slice(b, learn.indexOf("</section>", b)); ok(!/<img /.test(ex) && (ex.match(/data-glyx="/g) || []).length === 2 && ex.includes('aria-label="Open the original figure file: symbol and text nomenclature"'), "N-/O-linked examples: two interactive vector drawings, no raster image; original figure linked"); }
  // Glycome / Glycomics: theme derivatives with transparent ground
  const rep = JSON.parse(fs.readFileSync(path.join(ADD, "learning/derived/report.json"), "utf8"));
  for (const n of ["Glycome", "Glycomics"]) {
    for (const t of ["light", "dark"]) { const p = path.join(DIST, `learning/derived/${n}-${t}.png`), b = fs.existsSync(p) ? fs.readFileSync(p) : Buffer.alloc(30); ok(b[25] === 6 && b.readUInt32BE(16) === rep[n].size[0] && b.readUInt32BE(20) === rep[n].size[1], `${n}: ${t} derivative is a PNG with alpha channel in the size of the original`); }
    ok(learn.includes(`<img class="on-light" src="/learning/derived/${n}-light.png"`) && learn.includes(`<img class="on-dark" src="/learning/derived/${n}-dark.png"`), `${n}: light and dark variant on the Learning page`);
    ok(rep[n].background_removed_share > 0.5 && rep[n].neutral_dark_relit_px > 5000 && typeof rep[n].white_highlights_kept === "number", `${n}: derivation report records removed background, relit lettering and kept highlights`);
  }
  ok(rep.Glycomics.white_highlights_kept > 300, "Glycomics: white highlights of the drawing were kept, not keyed out", String(rep.Glycomics.white_highlights_kept));
  // no decorative frames around learning figures, in both themes
  ok(/\.zoom\.plain, \.lfig \.zoom \{ border: 0; border-radius: 0; background: transparent; \}/.test(css) && /\.lcard \.pic \{[^}]*\}/.test(css) && !/\.lcard \.pic \{[^}]*(border|background)/.test(css), "learning figures and their preview tiles have no frame, plate or white ground");
  ok(!/class="zoom frame"/.test(home + learn) && (learn.match(/class="zoom plain"/g) || []).length === 2, "no framed figure markup left on Home and Learning");
  ok((home.match(/class="lcard"/g) || []).length === 6 && !/<span class="pic[^"]*"><img src="\/(learning|assets\/images)\//.test(home), "home: six learning entries, none with a white raster tile");
  // accent: orange tokens, dark text on the orange fill
  const tok = (re) => Object.fromEntries([...(re.exec(css)?.[1] || "").matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
  const lt = tok(/^:root \{([\s\S]*?)^\}/m), dk = tok(/^:root\[data-theme="dark"\] \{([\s\S]*?)^\}/m);
  const hue = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1; return ((mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360; };
  for (const [n, T2] of [["light", lt], ["dark", { ...lt, ...dk }]]) for (const k of ["--accent", "--accent-ink", "--accent-soft", "--accent-fill", "--accent-fill-hover", "--focus"]) ok(hue(T2[k]) >= 10 && hue(T2[k]) <= 35, `${n} theme: ${k} is an orange (hue 10–35°)`, T2[k] + " hue " + hue(T2[k]).toFixed(0));
  ok(lt["--brand"] === "#f96627" && /\.logo \.ring \{ stroke: var\(--brand\); \}/.test(css), "brand mark uses the reference orange #f96627 (median of the supplied fox reference)");
  { const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }, cr = (x, y) => { const [p, q] = [lum(x), lum(y)].sort((u, v) => v - u); return (p + 0.05) / (q + 0.05); };
    ok(cr("#ffffff", lt["--accent-fill"]) < 4.5 && cr(lt["--on-accent"], lt["--accent-fill"]) >= 4.5 && cr(dk["--on-accent"], dk["--accent-fill"]) >= 4.5, "text on the orange fill is dark because white would miss 4.5:1", "white " + cr("#ffffff", lt["--accent-fill"]).toFixed(2) + ", dark " + cr(lt["--on-accent"], lt["--accent-fill"]).toFixed(2));
    ok(cr(lt["--accent-fill"], lt["--paper"]) >= 3 && cr(dk["--accent-fill"], dk["--paper"]) >= 3, "orange fill stands out from the page (non-text contrast ≥ 3) in both themes"); }
  // scientific and institutional colours untouched by the accent change
  ok(JSON.stringify(G.sugars.Gal.rgb) === "[255,255,0]" && JSON.stringify(G.sugars.GlcNAc.rgb) === "[0,0,250]" && JSON.stringify(G.sugars.NeuAc.rgb) === "[200,0,200]" && learn.includes('fill="rgb(0,0,250)"'), "nomenclature colours unchanged (blue GlcNAc stays blue)");
  ok(/fill="#b[0-9a-f]{5}"/.test(fs.readFileSync(path.join(ADD, "logos/radboud-icon-red.svg"), "utf8")) && JSON.parse(fs.readFileSync(path.join(ADD, "logos/derivatives.json"), "utf8")).cornell.red === "#b31b1b", "Cornell and Radboud reds come from the supplied / official files, not from the accent");
}

// 10. optional: live server
const base = arg("url");
section("Round 4: SPAAC sources, quiet buttons, centred marks, profile wording, all symbols, chat entry, institute link");
{ const css = read("assets/site/styles.css"), home = read("index.html"), about = read("about/index.html"), learn = read("learning/index.html");
  const C4 = JSON.parse(fs.readFileSync(path.join(SITE, "content/site.json"), "utf8")), P4 = C4.profile, G4 = JSON.parse(fs.readFileSync(path.join(SITE, "content/glycans.json"), "utf8"));
  // A. SPAAC: one local player, two compact source buttons, the complete method note, no written-out paper line
  const a = learn.indexOf('id="spaac"'), sp = learn.slice(a, learn.indexOf("</section>", a)), spText = text(sp);
  const src = [...sp.matchAll(/<li><span>([^<]+)<\/span><a class="ico[^"]*" href="([^"]+)"([^>]*)aria-label="([^"]+)" data-tip="([^"]+)"/g)].map((m) => ({ label: m[1], href: m[2], rest: m[3], aria: m[4], tip: m[5] }));
  ok(src.length === 2 && src[0].label === "Related paper" && src[1].label === "Video reference", "SPAAC: two source buttons, Related paper and Video reference", JSON.stringify(src.map((x) => x.label)));
  ok(src[0]?.href === "/publications/bicyclononynes-bioorthogonal-labeling-3d-imaging/" && fs.existsSync(path.join(DIST, "publications/bicyclononynes-bioorthogonal-labeling-3d-imaging/index.html")) && /Readily Accessible Bicyclononynes for Bioorthogonal Labeling and Three-Dimensional Imaging of Living Cells/.test(src[0].aria) && src[0].aria === src[0].tip, "SPAAC: paper button opens paper-01, full title in name and tooltip");
  ok(src[1]?.href === "https://youtu.be/62UcawMOqnc" && /YouTube/.test(src[1].aria) && /noopener/.test(src[1].rest) && src[0].aria !== src[1].aria, "SPAAC: video reference button opens youtu.be/62UcawMOqnc, distinct name");
  ok(!spText.includes("Readily Accessible Bicyclononynes") && !/https?:\/\//.test(spText) && !sp.includes("relline"), "SPAAC: no written-out paper title or URL in the visible text");
  ok((sp.match(/<video /g) || []).length === 1 && !/<iframe/.test(sp) && (sp.match(/62UcawMOqnc/g) || []).length === 1, "SPAAC: still exactly one (local) player; the YouTube id occurs once, as a link");
  for (const part of ["IRC", "M06-2X", "6-311+g(d,p)", "G09", "exponent 2", "PBE/def2-TZVP", "IboView", "two intrinsic bond orbitals", "new σ bonds"]) ok(spText.includes(part), `SPAAC method note contains: ${part}`);
  ok(/Method, from the description of the video reference:/.test(spText) && !/Samuel|I calculated|we calculated/i.test(spText), "SPAAC method note is attributed to the video reference, no authorship claim");
  // B. accent buttons are quiet: surface, outline, ink text; no filled orange button left
  ok(/\.btn\.accent \{ background: var\(--btn-accent-bg\); border-color: var\(--btn-accent-border\); color: var\(--btn-accent-text\); \}/.test(css) && /--btn-accent-bg: var\(--surface\); --btn-accent-border: var\(--accent\); --btn-accent-text: var\(--ink\)/.test(css), "accent button: surface, orange outline, ink text (central tokens)");
  ok(/\.btn:disabled[^{]*\{[^}]*--btn-disabled-bg/.test(css) && /\.btn\.accent:hover, \.btn\.accent:active \{/.test(css), "accent button: hover, active and disabled states defined");
  { const filled = [...css.matchAll(/([^{}]+)\{[^}]*background: var\(--accent-fill(?:-hover)?\)[^}]*\}/g)].map((m) => m[1].trim());
    ok(filled.every((s) => /^\.tag\.kind/.test(s)), "no button uses the filled orange any more (only the two kind tags)", filled.join(" | ")); }
  // contrast of the button pairs in both themes (WCAG relative luminance)
  { const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const cr = (x, y) => { const [p, q] = [lum(x), lum(y)].sort((m, n) => n - m); return (p + 0.05) / (q + 0.05); };
    const tok = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+): (#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
    const light = tok(/:root \{([\s\S]*?)\n\}/.exec(css)[1]), dark = { ...light, ...tok(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/.exec(css)[1]) };
    for (const [name, T] of [["light", light], ["dark", dark]]) {
      const pairs = [["text on button", T.ink, T.surface, 4.5], ["text on hover/active", T.ink, T["accent-soft"], 4.5], ["icon on button", T.accent, T.surface, 3], ["icon on hover", T.accent, T["accent-soft"], 3], ["outline against page", T.accent, T.paper, 3], ["hover outline against page", T["accent-ink"], T.paper, 3], ["disabled text", T.muted, T.hover, 4.5], ["focus ring against page", T.focus, T.paper, 3], ["menu text on menu", T.ink, T.surface, 4.5], ["menu subtitle", T.muted, T.surface, 4.5], ["menu subtitle on hover", T.muted, T.hover, 4.5], ["chat icon on header", T.accent, T.paper, 3]];
      for (const [what, fg, bg, need] of pairs) { const r = cr(fg, bg); ok(r >= need, `${name}: ${what} ${fg} on ${bg} = ${r.toFixed(2)}:1 (needs ${need})`); }
    } }
  // C. period and mark are centred as one unit
  ok(/\.timeline \.when \{[^}]*justify-items: center;[^}]*text-align: center;/.test(css) && !/\.timeline \.when \{[^}]*justify-content: space-between/.test(css), "experience: period and mark centred in the date column (no left alignment, no split on small screens)");
  ok((about.match(/<div class="when"><span>[^<]+<\/span><span class="org-logo"/g) || []).length === 4, "experience: all four entries have period + mark in one unit");
  // D. profile wording: first sentence exact, every protected content item still present
  ok(P4.career[0] === "I am a researcher in biochemistry and molecular biology and the Co-Founder, CFO, Product Lead and Data Scientist of Vaionex Corporation, an AI and blockchain development and data science company." && P4.career.length === 5 && P4.experience.length === 4, "profile: first career sentence exact, five paragraphs, four entries");
  const need = {
    "Vaionex": [P4.experience[0].role + " " + P4.experience[0].when + " " + P4.experience[0].text + " " + P4.experience[0].products.map((x) => x.name + " " + x.text).join(" "), ["Co-Founder", "CFO", "Product Lead", "Data Scientist", "2020 – present", "AI and blockchain development and data science company", "financial", "legal", "operational", "product strategy", "product development", "AI and data science solutions", "Product Lead of Agreements.ai", "development and strategic direction", "contract drafting, review and risk analysis", "PitchAI", "pitch deck analysis and feedback", "Admission.ai", "guidance for school applications", "Taxation.ai", "AI-assisted tax and document workflows"]],
    "Cornell": [P4.experience[1].role + " " + P4.experience[1].when + " " + P4.experience[1].where + " " + P4.experience[1].text, ["KIC PostDoc Fellow", "2018 – 2022", "Kavli Institute at Cornell for Nanoscale Science", "Robert Frederick Smith School of Chemical and Biomolecular Engineering", "Kavli Fellow", "biophysical", "biochemical", "glycan layer", "glycocalyx", "nanometer-scale structures", "biological tissues", "biomimetic culture systems"]],
    "Roche/RIMLS": [P4.experience[2].role + " " + P4.experience[2].when + " " + P4.experience[2].where + " " + P4.experience[2].text, ["Roche PostDoc Fellow", "2013 – 2018", "Biochemistry of Integrated Systems", "RIMLS", "GFP complementation assay", "functional cell-penetrating peptides", "from the cell surface to the cytosol", "endosomal release", "glycosylation", "uptake of CPPs", "advanced biochemical approaches", "fluorescence correlation spectroscopy", "fluorescence recovery after photobleaching", "confocal microscopy", "analyze and visualize", "contact regions", "cationic", "negatively charged", "glycan moieties", "CPP binding", "lateral mobility", "glycolipids", "glycoproteins", "atomic force microscopy and spectroscopy (AFM/AFS)", "FRAP technique", "optimized for glycan analysis"]],
    "Ph.D.": [P4.experience[3].role + " " + P4.experience[3].when + " " + P4.experience[3].where + " " + P4.experience[3].text, ["Ph.D. candidate", "2008 – 2012", "Cellbiology and Celldynamics", "advanced imaging procedures", "confocal microscopy", "cell-matrix interactions", "dynamic cell patterning", "tumor migration and invasion", "My responsibilities included", "cell culture technique", "glycocalyx components", "cell migration and invasion", "3D environment", "in vitro and in vivo", "cell and molecular biology", "time-lapse microscopy", "atomic force microscopy and spectroscopy (AFM/AFS)", "glycobiology", "glycochemistry"]],
    "Career": [P4.career.join(" "), ["Agreements.ai", "contract platform", "Robin Gounder", "re-analyze published functional genomics data", "noncanonical open reading frames", "microproteins", "glycobiology", "experimental Ph.D. thesis", "Prof. Dr. Peter Friedl", "Department of Cell Biology", "Radboud Institute for Molecular Life Sciences (RIMLS)", "Nijmegen, The Netherlands", "glycosylation", "tumor cell migration and invasion", "in vitro and in vivo", "multiphoton, confocal and scanning electron microscopy", "complex nanotopography", "cell membranes and collagen fibers", "In 2013", "Roche Postdoc Fellowship (RPF)", "F. Hoffmann-La Roche Ltd, Basel, Switzerland", "Prof. Dr. Roland Brock", "Department of Biochemistry", "GFP complementation assay", "endosomal release", "uptake of CPPs", "In February 2017", "KIC Postdoc Fellowship", "Kavli Institute at Cornell for Nanoscale Science, Cornell University, USA", "from 2018 to 2022"]],
  };
  for (const [k, [t, list]] of Object.entries(need)) { const miss = list.filter((x) => !t.includes(x)); ok(miss.length === 0, `profile content kept after the edit: ${k} (${list.length} items)`, miss.join(" | ")); }
  ok(P4.career.every((p) => about.includes(`<p>${esc(p)}</p>`)) && P4.experience.every((x) => about.includes(`<p>${esc(x.text)}</p>`)), "profile: the page shows exactly the edited wording");
  ok(!/biotech|consult/i.test(P4.career.join(" ") + P4.experience.map((x) => x.text).join(" ")) && !/Tegment|Relysia|Satolearn|TimeSeal/.test(about), "profile: no biotech wording, excluded products stay excluded");
  // E. all 18 symbols on the home card, all twelve profile links
  { const card = /<span class="mini-chart">([\s\S]*?)<\/span>\s*<\/span>/.exec(home)?.[1] ?? /<span class="mini-chart">([\s\S]*?)<\/span>/.exec(home)[1];
    const n = (home.slice(home.indexOf('class="mini-chart"')).split("</a>")[0].match(/<svg class="sym"/g) || []).length;
    ok(n === 18 && G4.chart.symbols.length === 18, "home card Symbol nomenclature renders all 18 symbols", String(n));
    ok(/\.mini-chart \{[^}]*repeat\(6, 1fr\)/.test(css), "home card: 6 x 3 grid like the chart on Learning");
    ok(!/18 glycan symbols/.test(text(home)) && /1\s*patent/i.test(text(home)), "home: no '18 glycan symbols' figure, '1 patent' stays"); void card; }
  { const links = [...(/<ul class="profiles"[^>]*>([\s\S]*?)<\/ul>/.exec(about)[1]).matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => m[2]);
    ok(links.join(",") === "Publons,ORCID,ResearchGate,SSRN,LinkedIn,GitHub,Bluesky,X,Reddit,YouTube,Twetch,Linktree", "all twelve profile links, in the given order", links.join(",")); }
  // F. one compact chat entry on every page; no dock, no wide header button
  for (const f of htmlFiles) { const h = read(f); if (!h.includes('id="ask"')) continue;
    const toggles = (h.match(/data-chat-toggle/g) || []).length, menu = /<div class="chat-menu" id="chat-menu" role="menu"[^>]*hidden>([\s\S]*?)<\/div>/.exec(h)?.[1] || "";
    ok(toggles === 1 && (menu.match(/role="menuitem"/g) || []).length === 2 && /data-ask-open>[\s\S]*Ask Glycosearch[\s\S]*data-support-open>[\s\S]*Support chat/.test(menu) && !h.includes('class="dock"') && !h.includes("ask-trigger") && !h.includes("d-support"), `${f}: one chat entry with two labelled options, no dock or header pill`); }
  { const app = read("assets/site/app.js");
    ok(/aria-haspopup="menu" aria-expanded="false" aria-controls="chat-menu" aria-label="Research chat and support"/.test(home) && /e\.key === "Escape"[^\n]*closeChat\(true\)/.test(app) && /ArrowDown/.test(app) && /pointerdown/.test(app), "chat entry: named button, Escape returns focus, arrow keys, closes on outside press");
    ok(/\.icon-btn \{ width: 44px; height: 44px;/.test(css) && /\.chat-menu button \{[^}]*min-height: 52px/.test(css), "chat entry: 44 px target, 52 px menu rows");
    ok(/hideWidget/.test(app) && /support-fallback/.test(home) && /Chat unavailable/.test(app), "support: Tawk bubble stays hidden behind the own entry; unavailable state and e-mail fallback kept"); }
  // G. tab label: the support widget must not switch the page title to "1 new message"; unread count goes to the chat entry
  { const app = read("assets/site/app.js");
    ok(/new MutationObserver\(\(\) => \{ if \(document\.title !== pageTitle\) document\.title = pageTitle; \}\)/.test(app) && /onUnreadCountChanged/.test(app) && /new message/.test(app), "page title stays the page's own (Tawk's '1 new message' title switch is undone); unread count shown at the chat entry");
    ok(!/link\[rel|rel~=|createElement\("link"\)|querySelector\(["']link/.test(app), "no own script touches the favicon links"); }
  // G2. current institute link
  { const row = /<li><div><span class="t">Nanoscale Glycoscience<\/span>[\s\S]*?<\/li>/.exec(about)?.[0] || "";
    ok(/href="https:\/\/www\.kicnano\.cornell\.edu\/"/.test(row) && /aria-label="Open the Kavli Institute at Cornell \(KIC\) website"/.test(row) && !/kicnano/.test(text(row)) && !/web\.archive\.org/.test(row), "Nanoscale Glycoscience: compact link button to https://www.kicnano.cornell.edu/, no URL line");
    ok(!about.includes("kicnano.cornell.edu/fellows") && !read("assets/site/index.json").includes("kicnano.cornell.edu/fellows"), "old /fellows/ link is gone from the page and the search index"); }
}

if (base) {
  section("HTTP (running preview) " + base);
  const get = async (p, o) => { try { return await fetch(base + p, o); } catch (e) { return { status: 0, headers: new Map(), text: async () => String(e) }; } };
  for (const p of [...NAV.map((n) => n[0]), "/resources/", ...items.map(([, , o, b]) => `${b}${o.slug}/`), "/assets/site/index.json", "/assets/site/app.js", "/assets/site/cursor.svg", "/papers.html", "/projects.html", "/ajax-lightbox-gallery/project12.html", "/learning/Glycome.jpg"]) { const r = await get(p); ok(r.status === 200, "GET " + p, String(r.status)); }
  for (const [, it, , , isLegacy] of items) { const rel = isLegacy ? it.pdf.path : it.pdf, bytes = fs.statSync(path.join(DIST, rel)).size; const r = await get(fileUrl(rel), { method: "HEAD" }); ok(r.status === 200 && r.headers.get("content-type") === "application/pdf" && +r.headers.get("content-length") === bytes, `HEAD PDF ${it.id}`, `${r.status} ${r.headers.get("content-length")}`); }
  { const r = await get("/assets/movies/video_white.mp4", { headers: { range: "bytes=0-99" } }); ok(r.status === 206, "video supports range requests", String(r.status)); }
  { const r = await get("/nope/"); ok(r.status === 404, "unknown path → 404 page", String(r.status)); }
  { const r = await get("/api/ask/status"); const j = r.status === 200 ? JSON.parse(await r.text()) : {}; ok(typeof j.configured === "boolean", "ask status endpoint answers", JSON.stringify(j)); console.log("ask endpoint:", JSON.stringify(j));
    if (j.configured === false) { const p = await get("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: '{"q":"frapbot"}' }); ok(p.status === 503, "unconfigured AI endpoint says 503 (browser falls back to search)", String(p.status)); } }
}

{ // In vivo section: Bettina Weigelin with two icon links (owner request of 25 Nov 2026)
  const lh = fs.readFileSync(path.join(DIST, "learning/index.html"), "utf8");
  const a = lh.indexOf('id="in-vivo"'), b = lh.indexOf("<section", a + 10), part = lh.slice(a, b < 0 ? undefined : b);
  ok(/<ul class="srcline"[^>]*><li><span>Dr\. Bettina Weigelin \(Ph\.D\.\)<\/span>/.test(part) && (part.match(/class="srcline"/g) || []).length === 1, "in vivo: name shown once in one line");
  ok(part.includes('href="https://www.isct.uni-tuebingen.de/wsic/research/research-groups/imaging-sciences/multiscale-immunoimaging"') && part.includes('aria-label="Bettina Weigelin — research group"'), "in vivo: research group link with its own name");
  ok(part.includes('href="https://www.linkedin.com/in/bettina-weigelin/"') && part.includes('aria-label="Bettina Weigelin — LinkedIn"'), "in vivo: LinkedIn link with its own name");
  ok(/<figure class="lfig full">[\s\S]*<img[\s\S]*<figcaption>/.test(part) && (part.match(/<figcaption>/g) || []).length === 1 && !/>https?:\/\//.test(part), "in vivo: original image and caption kept, no written URL");
  ok(!/Bettina Weigelin/.test(fs.readFileSync(path.join(DIST, "about/index.html"), "utf8").split('class="profiles"')[1].split("</ul>")[0]), "in vivo links are not part of the personal profile links");
}

console.log(`\n${pass} checks passed, ${fails.length} failed`);
for (const f of fails) console.log("FAIL  " + f);
process.exit(fails.length ? 1 : 0);

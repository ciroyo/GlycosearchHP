// Glycosearch site search — shared by the browser ("Ask Glycosearch" without a language model)
// and by the optional server endpoint (retrieval step). Pure functions, no dependencies.
// It only ever returns entries and actions that exist in the published content index.

const STOP = new Set(`a an and are as at be by can could describe describes described do does for from find get give has have how i in is it its me my of on or please show tell that the their there this to was what where which who with you your about any some into via using use used paper papers publication publications article study work entry page site website glycosearch link links linked resource`.split(/\s+/));

// Query vocabulary -> action types that exist in the content model.
const INTENTS = [
  { type: "code", words: ["github", "repo", "repository", "repositories", "code", "source", "sourcecode", "git"], label: "GitHub repository" },
  { type: "app", words: ["app", "apps", "webapp", "application", "tool", "online", "shiny"], phrases: ["web app", "web application"], label: "web app" },
  { type: "pdf", words: ["pdf", "download", "downloads", "fulltext"], phrases: ["full text"], label: "PDF" },
  { type: "manual", words: ["manual", "handbook", "guide", "instructions"], label: "manual" },
  { type: "press", words: ["press", "news", "coverage", "media"], label: "press coverage" },
  { type: "institution", words: ["eth", "zurich", "zürich", "scopem"], label: "ETH Zurich resource" },
  { type: "wiki", words: ["wiki", "documentation", "docs"], label: "wiki" },
  { type: "gsoc", words: ["gsoc"], phrases: ["summer of code", "google summer"], label: "Google Summer of Code page" },
  { type: "preprint", words: ["biorxiv"], label: "bioRxiv preprint" },
  { type: "ssrn", words: ["ssrn"], label: "SSRN preprint" },
  { type: "patent", words: ["espacenet"], label: "Espacenet record" },
];

// Abbreviation expansion (both directions are indexed because entries are expanded the same way).
const SYN = {
  cpp: ["cell", "penetrating", "peptide"], cpps: ["cell", "penetrating", "peptide"],
  gag: ["glycosaminoglycan"], gags: ["glycosaminoglycan"],
  hs: ["heparan", "sulfate"], hspg: ["heparan", "sulfate", "proteoglycan"],
  cs: ["chondroitin", "sulfate"], sulphate: ["sulfate"], tumor: ["tumour"], tumors: ["tumour"],
  bcn: ["bicyclononyne"], bicyclononynes: ["bicyclononyne"],
  frap: ["fluorescence", "recovery", "photobleaching"], labelling: ["labeling"],
  firebase: ["firedata"], firestore: ["firedata"],
  datascience: ["data", "science"], norf: ["noncanonical", "orf"], norfs: ["noncanonical", "orf"], orfs: ["orf"],
  silicones: ["silicone"], biolubricants: ["biolubricant"], lubricins: ["lubricin"], origami: ["origami"],
};

export function norm(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[‐-―­]/g, "-");
}
function stem(t) {
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us") && !t.endsWith("is")) return t.slice(0, -1);
  return t;
}
export function tokens(s) {
  return norm(s).split(/[^a-z0-9]+/).filter(Boolean).map(stem);
}
function expand(list) {
  const out = [];
  for (const t of list) { out.push(t); if (SYN[t]) out.push(...SYN[t].map(stem)); }
  return out;
}

const FIELDS = [["title", 6], ["shortTitle", 5], ["app", 6], ["keywords", 3.5], ["authors", 3], ["tagText", 2.5], ["actionText", 1.5], ["text", 1.6]];

export function buildIndex(entries, fulltext) {
  const docs = entries.map((e) => {
    const f = {};
    const src = { ...e, tagText: (e.tags || []).join(" "), actionText: [...(e.actions || []), ...((e.applied && e.applied.actions) || [])].map((a) => a.label + " " + (a.name || "")).join(" ") + (e.applied ? " " + e.applied.name : "") };
    for (const [k] of FIELDS) {
      const m = new Map();
      for (const t of expand(tokens(src[k]))) m.set(t, (m.get(t) || 0) + 1);
      f[k] = m;
    }
    let ft = null;
    if (fulltext && fulltext[e.id]) { ft = new Set(expand(tokens(fulltext[e.id]))); }
    return { e, f, ft };
  });
  const df = new Map();
  for (const d of docs) {
    const seen = new Set();
    for (const [k] of FIELDS) for (const t of d.f[k].keys()) seen.add(t);
    if (d.ft) for (const t of d.ft) seen.add(t);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  return { docs, df, n: docs.length, fulltext: fulltext || null };
}

export function parseQuery(q) {
  const n = " " + norm(q).replace(/[^a-z0-9]+/g, " ") + " ";
  const raw = tokens(q);
  const intents = [];
  const intentWords = new Set();
  for (const it of INTENTS) {
    let hit = false;
    for (const p of it.phrases || []) if (n.includes(" " + p + " ")) { hit = true; p.split(" ").forEach((w) => intentWords.add(stem(w))); }
    for (const w of it.words) if (raw.includes(stem(w))) { hit = true; intentWords.add(stem(w)); }
    if (hit) intents.push(it);
  }
  let kind = null;
  if (/\b(patent|patents|inventor|inventors|invention)\b/.test(n)) kind = "patent";
  else if (/\b(project|projects)\b/.test(n)) kind = "project";
  else if (/\b(paper|papers|publication|publications|article)\b/.test(n)) kind = "paper";
  const content = raw.filter((t) => !STOP.has(t) && !intentWords.has(t) && t !== "project" && t !== "web");
  const terms = [...new Set(expand(content))];
  return { raw, content, terms, intents, kind };
}

function sentenceFor(text, terms) {
  if (!text) return null;
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/);
  let best = null, bestScore = 0;
  for (const p of parts) {
    const ts = new Set(expand(tokens(p)));
    let s = 0; for (const t of terms) if (ts.has(t)) s++;
    if (s > bestScore) { bestScore = s; best = p; }
  }
  if (!best) return null;
  return best.length > 320 ? best.slice(0, 317).replace(/\s+\S*$/, "") + "…" : best;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function markTerms(text, terms) {
  const set = new Set(terms);
  return escapeHtml(text).replace(/[A-Za-z0-9À-ɏ]+/g, (w) => {
    const t = tokens(w)[0];
    if (!t) return w;
    if (set.has(t) || (SYN[t] && SYN[t].some((x) => set.has(stem(x))))) return "<mark>" + w + "</mark>";
    return w;
  });
}

export function search(index, q, opts = {}) {
  const limit = opts.limit || 4;
  const pq = parseQuery(q);
  const { terms, intents, kind } = pq;
  const idf = (t) => Math.log(1 + (index.n + 1) / ((index.df.get(t) || 0) + 0.5));
  const scored = [];
  for (const d of index.docs) {
    let score = 0; const matched = new Set(); let ftOnly = new Set();
    for (const t of terms) {
      let best = 0;
      for (const [k, w] of FIELDS) {
        const c = d.f[k].get(t);
        if (c) best = Math.max(best, w * (1 + Math.min(c - 1, 3) * 0.15));
      }
      if (!best && d.ft && d.ft.has(t)) { best = 0.9; ftOnly.add(t); }
      if (best) { score += best * idf(t); matched.add(t); }
    }
    // phrase bonus: adjacent content terms appearing adjacently in the title
    const tt = expand(tokens(d.e.title));
    for (let i = 0; i + 1 < pq.content.length; i++) {
      const a = pq.content[i], b = pq.content[i + 1];
      for (let j = 0; j + 1 < tt.length; j++) if (tt[j] === a && tt[j + 1] === b) { score += 3; break; }
    }
    // actions of an applied application count for finding the entry, but stay attributed to its authors (see describe)
    const types = new Set([...(d.e.actions || []), ...((d.e.applied && d.e.applied.actions) || [])].map((a) => a.type));
    const wanted = intents.filter((it) => types.has(it.type));
    if (terms.length && matched.size === 0) continue;
    if (!terms.length && !wanted.length) continue;
    const coverage = terms.length ? matched.size / terms.length : 1;
    score *= 0.55 + 0.45 * coverage;
    if (wanted.length) score += terms.length ? 1.2 * wanted.length : 4 * wanted.length;
    if (kind && d.e.kind === kind) score += 1.5;
    if (score <= 0) continue;
    scored.push({ d, score, matched, coverage, wanted, ftOnly });
  }
  scored.sort((a, b) => b.score - a.score || a.d.e.order - b.d.e.order);
  const top = scored[0];
  let picked = scored;
  if (top && terms.length) {
    const floor = Math.max(top.score * 0.42, 2.2);
    picked = scored.filter((s) => s.score >= floor);
    if (top.score < 2.2) picked = [];
  }
  const total = picked.length;
  picked = picked.slice(0, terms.length ? limit : 8);
  const hits = picked.map((s) => {
    const e = s.d.e;
    let snippet = null;
    const sent = sentenceFor(e.text, [...s.matched]);
    if (sent) snippet = { html: markTerms(sent, [...s.matched]), source: e.basisLabel, basis: e.basis };
    else if (s.ftOnly.size && index.fulltext && index.fulltext[e.id]) {
      const fs = sentenceFor(index.fulltext[e.id], [...s.ftOnly]);
      if (fs) snippet = { html: markTerms(fs, [...s.ftOnly]), source: "PDF full text (machine-extracted)", basis: "fulltext" };
    }
    return { id: e.id, score: Math.round(s.score * 100) / 100, coverage: s.coverage, highlight: intents.map((i) => i.type), missing: intents.filter((it) => !s.wanted.includes(it)).map((i) => i.label), snippet };
  });
  const dominant = hits.length === 1 || (hits.length > 1 && picked[0].score >= picked[1].score * 1.45);
  return { query: q, terms, intents: intents.map((i) => ({ type: i.type, label: i.label })), kind, hits, total, dominant, ambiguous: !terms.length && hits.length > 1 };
}

// Plain-language summary of a search result. Template-based: it states only what the index contains.
export function describe(result, byId) {
  const { hits, intents, terms } = result;
  if (!hits.length) {
    return { say: "Nothing in the published Glycosearch content matches that question.", basis: "No matching entry in the site index." };
  }
  const first = byId[hits[0].id];
  const kindName = { paper: "paper", project: "project", resource: "reference", profile: "page", tool: "application", patent: "patent" }[first.kind] || "entry";
  if (result.ambiguous) {
    const what = intents.map((i) => i.label).join(" / ");
    return { say: `${hits.length === result.total ? hits.length : "Several"} entries on this site have a ${what}. Pick the one you mean:`, basis: "Listed from the link records of each entry." };
  }
  let say;
  if (result.dominant) {
    say = `Best match: the ${kindName} “${first.title}”${first.authorsShort ? " (" + first.authorsShort + ")" : ""}.`;
    if (first.kind === "tool") say += " It was developed and published by other authors and used in a study on this site.";
    const acts = first.actions || [];
    if (intents.length) {
      const have = [], miss = [], applied = [];
      for (const it of intents) {
        const found = acts.filter((a) => a.type === it.type);
        const used = first.applied ? first.applied.actions.filter((a) => a.type === it.type) : [];
        if (found.length) have.push(...found.map((a) => `${a.label}${a.name && !a.label.includes(a.name) ? " (" + a.name + ")" : ""}`));
        else if (used.length) applied.push(it.label);
        else miss.push(it.label);
      }
      if (have.length) say += ` Linked directly below: ${have.join(", ")}.`;
      if (applied.length) say += ` The ${applied.join(" and ")} belong${applied.length === 1 ? "s" : ""} to ${first.applied.name}, an application by ${first.applied.by} that was used in this study.`;
      if (miss.length) say += ` No ${miss.join(" or ")} is recorded for this entry.`;
    }
    if (hits.length > 1) say += ` ${hits.length - 1} related ${hits.length - 1 === 1 ? "entry follows" : "entries follow"}.`;
  } else {
    say = `${hits.length} entries match${terms.length ? "" : " that"}. The closest are listed first — open the one you mean.`;
  }
  const bases = new Set(hits.map((h) => (h.snippet && h.snippet.basis) || byId[h.id].basis));
  let basis = "Matched against titles, authors and abstracts.";
  if (bases.has("fulltext")) basis = "Matched against abstracts and machine-extracted PDF text.";
  return { say, basis };
}

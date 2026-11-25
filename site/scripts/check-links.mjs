#!/usr/bin/env node
// Checks every external link used on the site once and writes content/link-status.json.
// A failing target is reported, never removed from the site. Usage: node scripts/check-links.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const idx = JSON.parse(fs.readFileSync(path.join(SITE, "dist/assets/site/index.json"), "utf8"));
const C = JSON.parse(fs.readFileSync(path.join(SITE, "content/site.json"), "utf8"));
const urls = new Map();
const add = (u, where) => { if (/^https?:/.test(u)) urls.set(u, [...(urls.get(u) || []), where]); };
for (const e of idx.entries) for (const a of e.actions) add(a.url, e.id + ":" + a.label);
for (const l of C.profile.links) add(l.url, "about:" + l.label);
for (const a of C.profile.activities) if (a.url) add(a.url, "about:" + a.title);
for (const x of C.profile.experience) for (const l of x.links || []) add(l.url, "about:" + l.label);
add(C.support.embedUrl, "support");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
async function probe(u) {
  for (const method of ["GET"]) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000);
      const r = await fetch(u, { method, redirect: "follow", signal: c.signal, headers: { "user-agent": UA, accept: "text/html,*/*" } });
      clearTimeout(t); r.body?.cancel?.();
      return { status: r.status, final: r.url !== u ? r.url : undefined };
    } catch (e) { return { status: 0, note: (e.cause?.code || e.name || "error") }; }
  }
}
const out = { _checked: new Date().toISOString(), _note: "HTTP status from this machine with a browser user agent. 403/429/999 often mean bot protection, not a dead page." };
const list = [...urls.keys()];
const res = await Promise.all(list.map(probe));
list.forEach((u, i) => { out[u] = { ...res[i], usedBy: urls.get(u) }; });
fs.writeFileSync(path.join(SITE, "content/link-status.json"), JSON.stringify(out, null, 1));
for (const u of list) console.log(String(out[u].status).padEnd(4), u, out[u].final ? "→ " + out[u].final : "", out[u].note || "");

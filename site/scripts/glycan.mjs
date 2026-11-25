// Renders the interactive "symbol and text nomenclature" widget from content/glycans.json.
// Everything is generated from one residue list per glycan, so the 2D text notation, the two symbol
// drawings and the residue list always refer to the same residue ids. Output is plain inline SVG + HTML:
// complete and readable without JavaScript; app.js only adds the cross-highlighting.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const lc = (n) => (/^[A-Z]-/.test(n) ? n : n[0].toLowerCase() + n.slice(1));

export function residueInfo(G, g, r) {
  const s = G.sugars[r.sugar];
  const parent = r.parent ? g.residues.find((x) => x.id === r.parent) : null;
  // token = the concrete example structure (as in the supplied figure); general = the label of the general core button
  const token = r.parent ? `${r.sugar}${r.anomer}${r.from}-${r.to}` : `${r.sugar}${r.anomer || ""}-${g.aglycon}`;
  const general = !r.parent && g.aglyconGeneral ? `${r.sugar}${r.anomer || ""}-${g.aglyconGeneral}` : null;
  const link = parent
    ? `${r.anomer}${r.from}-${r.to} linked: carbon ${r.from} of ${r.sugar} to position ${r.to} of ${parent.sugar} (${lc(G.sugars[parent.sugar].name)})`
    : general
      ? `${r.anomer ? r.anomer + "-linked" : "Linked"} to ${g.aglyconGeneral} (${g.aglyconGeneralName}) of the protein; this example shows ${g.aglycon}`
      : `${r.anomer ? r.anomer + "-linked" : "Linked"} to ${g.aglycon} (${g.aglyconName}) of the protein`;
  const tip = general ? `${general}: ${s.name}, ${r.anomer}-linked to ${g.aglyconGeneralName}` : "";
  return { id: r.id, token, general, tip, name: `${r.sugar} · ${s.name}${s.note ? " (" + s.note + ")" : ""}`, link, where: r.where, label: `${token}, ${s.name}, ${r.where}` };
}

function textSvg(G, g) {
  const cw = 9.2, pad = 10, gap = 46, yU = 44, yC = 84, yL = 124;
  const T = g.text, byId = Object.fromEntries(g.residues.map((r) => [r.id, r]));
  const armTok = (ids) => ids.map((id, i) => { const r = byId[id]; return { r, s: i === ids.length - 1 ? `${r.sugar}${r.anomer}${r.from}` : `${r.sugar}${r.anomer}${r.from}-${r.to}` }; });
  const coreTok = T.core.map((id) => { const r = byId[id]; return { r, s: r.parent ? `${r.sugar}${r.anomer}${r.from}-${r.to}` : `${r.sugar}${r.anomer || ""}-${g.aglycon}` }; });
  const up = armTok(T.upper), lo = armTok(T.lower);
  const w = (toks) => toks.reduce((n, t) => n + t.s.length, 0) * cw;
  const xA = pad + Math.max(w(up), w(lo)), xC = xA + gap, W = Math.round(xC + w(coreTok) + pad), H = 140;
  const tok = (x, y, s, extra = "") => `<rect class="hit" x="${(x - 3).toFixed(1)}" y="${y - 17}" width="${(s.length * cw + 6).toFixed(1)}" height="24" rx="4"/><text x="${x.toFixed(1)}" y="${y}" textLength="${(s.length * cw).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(s)}</text>${extra}`;
  const grp = (r, inner, first) => `<g class="res" data-res="${r.id}" role="button" tabindex="${first ? 0 : -1}" aria-label="${esc(residueInfo(G, g, r).label)}">${inner}</g>`;
  const out = [];
  let first = true;
  const arm = (toks, y, lower) => {
    let x = xA - w(toks);
    toks.forEach((t, i) => {
      let extra = "";
      if (i === toks.length - 1) {
        const y1 = lower ? y - 9 : y - 2, y2 = lower ? yC + 9 : yC - 15;
        extra = `<line class="bond" x1="${xA + 5}" y1="${y1}" x2="${xA + 24}" y2="${y2}"/><text class="pos" x="${xA + 28}" y="${lower ? yC + 18 : yC - 13}">${t.r.to}</text>`;
      }
      out.push(grp(t.r, tok(x, y, t.s, extra), first)); first = false;
      x += t.s.length * cw;
    });
  };
  arm(up, yU, false);
  arm(lo, yL, true);
  let x = xC;
  for (const t of coreTok) {
    out.push(grp(t.r, tok(x, yC, t.s), false));
    if (T.top && byId[T.top].parent === t.r.id) {
      const f = byId[T.top], s = `${f.sugar}${f.anomer}${f.from}`, cx = x + (t.r.sugar.length * cw) / 2;
      out.push(grp(f, tok(cx - (s.length * cw) / 2, 28, s, `<line class="bond" x1="${cx}" y1="34" x2="${cx}" y2="46"/><text class="pos" x="${cx}" y="62" text-anchor="middle">${f.to}</text>`), false));
    }
    x += t.s.length * cw;
  }
  return `<svg class="glyx-text" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${esc(g.title)} written in the 2D text nomenclature">${out.join("")}</svg>`;
}

function shape(kind, x, y, fill, upright) {
  const a = `class="shape" fill="${fill}"`;
  if (kind === "circle") return `<circle ${a} cx="${x}" cy="${y}" r="12.5"/>`;
  if (kind === "square") return `<rect ${a} x="${x - 12}" y="${y - 12}" width="24" height="24"/>`;
  if (kind === "diamond") return `<polygon ${a} points="${x},${y - 14.5} ${x + 14.5},${y} ${x},${y + 14.5} ${x - 14.5},${y}"/>`;
  // triangle: points up in the horizontal drawing and right in the upright one, as in the supplied figure
  return upright ? `<polygon ${a} points="${x - 11},${y - 13} ${x + 14},${y} ${x - 11},${y + 13}"/>` : `<polygon ${a} points="${x},${y - 14} ${x + 13},${y + 11} ${x - 13},${y + 11}"/>`;
}

function symbolSvg(G, g, upright) {
  const U = 46, pad = 22;
  const maxX = Math.max(...g.residues.map((r) => r.pos[0])), maxY = Math.max(...g.residues.map((r) => r.pos[1]));
  // upright drawing = horizontal drawing turned clockwise by 90 degrees
  const P = (r) => (upright ? [pad + (maxY - r.pos[1]) * U, pad + r.pos[0] * U] : [pad + r.pos[0] * U, pad + r.pos[1] * U]);
  const W = Math.round(2 * pad + (upright ? maxY : maxX) * U), H = Math.round(2 * pad + (upright ? maxX : maxY) * U);
  const byId = Object.fromEntries(g.residues.map((r) => [r.id, r]));
  const edges = [], labels = [], nodes = [];
  g.residues.forEach((r, i) => {
    const [x, y] = P(r), s = G.sugars[r.sugar];
    if (r.parent) {
      const [px, py] = P(byId[r.parent]);
      edges.push(`<line class="edge" data-edge="${r.id}" x1="${x}" y1="${y}" x2="${px}" y2="${py}"/>`);
      const mx = (x + px) / 2, my = (y + py) / 2, flat = Math.abs(y - py) < 1;
      labels.push(`<text class="lk" data-edge="${r.id}" x="${flat ? mx : mx + 6}" y="${flat ? my - 5 : my + 3}" text-anchor="${flat ? "middle" : "start"}">${r.anomer}${r.to}</text>`);
    }
    nodes.push(`<g class="res" data-res="${r.id}" role="button" tabindex="${i === 0 ? 0 : -1}" aria-label="${esc(residueInfo(G, g, r).label)}"><circle class="hit" cx="${x}" cy="${y}" r="21"/>${shape(s.shape, x, y, `rgb(${s.rgb.join(",")})`, upright)}</g>`);
  });
  return `<svg class="glyx-sym${upright ? " up" : ""}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${esc(g.title)} drawn with symbols${upright ? ", upright" : ""}">${edges.join("")}${labels.join("")}${nodes.join("")}</svg>`;
}

export function glycanWidget(G, id) {
  const g = G.glycans.find((x) => x.id === id);
  const info = g.residues.map((r) => residueInfo(G, g, r));
  const byId = Object.fromEntries(g.residues.map((r) => [r.id, r]));
  const armName = (ids) => byId[ids[0]].where.split(",")[0];
  const groups = [[armName(g.text.upper), g.text.upper], [armName(g.text.lower), g.text.lower], ["Core", [...g.text.core, ...(g.text.top ? [g.text.top] : [])]]];
  return `<div class="glyx" data-glyx="${g.id}">
  <div class="glyx-views">
    <figure class="glyx-view wide"><figcaption>2D text</figcaption>${textSvg(G, g)}</figure>
    <figure class="glyx-view"><figcaption>Symbols</figcaption>${symbolSvg(G, g, false)}</figure>
    <figure class="glyx-view"><figcaption>Symbols, upright</figcaption>${symbolSvg(G, g, true)}</figure>
  </div>
  <div class="glyx-panel">
    <output class="glyx-out" aria-live="polite"><span class="name">Select a residue</span><span class="code">Hover or tap a text part or a symbol. Arrow keys move along the chain.</span></output>
    <div class="glyx-groups">${groups.map(([label, ids]) => `<div class="glyx-group"><p class="glyx-glabel">${esc(label)}</p><ul class="glyx-list" aria-label="${esc(g.title)}: ${esc(label)}">${ids.map((id) => info.find((r) => r.id === id)).map((r) => `<li><button type="button" class="chip" data-res="${r.id}" aria-pressed="false" data-name="${esc(r.name)}" data-link="${esc(r.link)}" data-where="${esc(r.where)}"${r.general ? ` data-general="${esc(r.general)}" aria-label="${esc(r.tip)}" data-tip="${esc(r.tip)}"` : ""}>${esc(r.general || r.token)}</button></li>`).join("")}</ul></div>`).join("")}</div>
    <button type="button" class="chip glyx-toggle" data-glyx-links aria-pressed="false">Linkages on symbols</button>
  </div>
</div>`;
}

// ---------- chart symbols and the text-nomenclature figure (vector, theme-aware) ----------
// Outlines, lettering and bond lines take the text colour of the page (class "shape" / currentColor), so they are
// visible in the light and in the dark theme. Fills are the fixed nomenclature colours; white halves are drawn white.
export function chartSymbol(sym) {
  const c = `rgb(${sym.rgb.join(",")})`, W = "#ffffff", o = 'class="shape" fill="none"';
  const dia = "50,4 96,50 50,96 4,50";
  const half = (pts) => `<polygon points="${dia}" fill="${W}"/><polygon points="${pts}" fill="${c}"/><polygon ${o} points="${dia}"/>`;
  const body = {
    "circle": () => `<circle class="shape" cx="50" cy="50" r="45" fill="${c}"/>`,
    "square": () => `<rect class="shape" x="5" y="5" width="90" height="90" fill="${c}"/>`,
    "square-half": () => `<rect x="5" y="5" width="90" height="90" fill="${W}"/><polygon points="5,5 95,5 95,95" fill="${c}"/><rect ${o} x="5" y="5" width="90" height="90"/>`,
    "diamond": () => `<polygon class="shape" points="${dia}" fill="${c}"/>`,
    "diamond-top": () => half("4,50 50,4 96,50"),
    "diamond-bottom": () => half("4,50 50,96 96,50"),
    "diamond-left": () => half("50,4 4,50 50,96"),
    "diamond-right": () => half("50,4 96,50 50,96"),
    "diamond-hatch": () => { const id = "h" + sym.rgb.join(""); const lines = []; for (let v = 11; v < 96; v += 7.5) lines.push(`<path d="M${v} 0V100M0 ${v}H100"/>`); return `<clipPath id="${id}"><polygon points="${dia}"/></clipPath><polygon points="${dia}" fill="${W}"/><g clip-path="url(#${id})" stroke="${c}" stroke-width="2" fill="none">${lines.join("")}</g><polygon ${o} points="${dia}"/>`; },
    "triangle": () => `<polygon class="shape" points="50,10 88,88 12,88" fill="${c}"/>`,
    "star": () => { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 19 : 47, a = -Math.PI / 2 + i * Math.PI / 5; p.push((50 + r * Math.cos(a)).toFixed(1) + "," + (54 + r * Math.sin(a)).toFixed(1)); } return `<polygon class="shape" points="${p.join(" ")}" fill="${c}"/>`; },
  }[sym.kind];
  if (!body) throw new Error("unknown symbol kind " + sym.kind);
  return `<svg class="sym" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${body()}</svg>`;
}

// "Modified IUPAC condensed": the same glycan in linear and in 2D notation, as in the supplied figure
// 'Text nomenclature.png' (kept unchanged as the source). Strings are data in content/glycans.json -> textFigure.
export function textFigure(T) {
  const cw = 9.2, t = (x, y, str, cls = "") => `<text${cls ? ` class="${cls}"` : ""} x="${x.toFixed(1)}" y="${y}" textLength="${(str.length * cw).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(str)}</text>`;
  const x0 = 150, xA = x0 + Math.max(T.upper.length, T.lower.length) * cw, xC = xA + 34, W = Math.round(Math.max(x0 + T.linear.length * cw, xC + T.core.length * cw) + 12);
  return `<svg class="glyx-text textfig" viewBox="0 0 ${W} 212" width="${W}" height="212" role="img" aria-label="${esc(T.alt)}">
  <text class="tf-title" x="6" y="22">${esc(T.title)}</text>
  <text class="tf-label" x="52" y="70">Linear:</text>${t(x0, 70, T.linear)}
  <text class="tf-label" x="52" y="128">2D:</text>
  ${t(xA - T.upper.length * cw, 124, T.upper)}<line class="bond" x1="${xA + 3}" y1="126" x2="${xA + 20}" y2="140"/><text class="pos" x="${xA + 12}" y="128">${T.upperPos}</text>
  ${t(xC, 152, T.core)}
  ${t(xA - T.lower.length * cw, 184, T.lower)}<line class="bond" x1="${xA + 3}" y1="174" x2="${xA + 20}" y2="160"/><text class="pos" x="${xA + 12}" y="181">${T.lowerPos}</text>
</svg>`;
}
export { symbolSvg, textSvg };

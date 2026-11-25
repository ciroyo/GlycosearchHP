#!/usr/bin/env python3
"""Extracts papers/projects from the live mirror (legacy-live-2026-11-24) into content/legacy-extract.json.
Deterministic; no text is rewritten. Cross-checks against the Brain link inventory if given."""
import re, json, os, sys, html, hashlib
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
M = os.path.join(ROOT, "legacy-live-2026-11-24")
def rd(p): return open(os.path.join(M, p), encoding="utf-8").read()
def clean(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
def listing(page, prefix):
    t = rd(page); out = {}
    for m in re.finditer(r'<div class="cbp-item ([^"]*)">(.*?)</div>\s*</div>\s*</div>|<div class="cbp-item ([^"]*)">(.*?)(?=<div class="cbp-item |<div id="js-loadMore|</div>\s*</section|$)', t, re.S):
        cls = (m.group(1) or m.group(3)).split(); body = m.group(2) or m.group(4)
        n = re.search(prefix + r"/project(\d+)\.html", body)
        if not n: continue
        thumb = re.search(r'<img src="([^"]+)"', body)
        title = re.search(r'cbp-l-caption-title[^>]*>(.*?)</div>', body, re.S)
        desc = re.search(r'cbp-l-caption-desc[^>]*>(.*?)(?:</div>|$)', body, re.S)
        out[int(n.group(1))] = {"categories": cls, "thumbnail": thumb.group(1) if thumb else None,
            "shortTitle": clean(title.group(1)) if title else None, "authorsShort": clean(desc.group(1)) if desc else None}
    return out
def detail(path):
    t = rd(path)
    imgs = re.findall(r'<a href="([^"]+)" class="cbp-lightbox"', t)
    g = lambda c: clean(re.search(r'class="%s">(.*?)</div>' % c, t, re.S).group(1))
    wrap = t[t.index("cbp-l-inline-view-wrap"):]
    acts = [(html.unescape(h).strip(), clean(l)) for h, l in re.findall(r'<a href="([^"]+)"[^>]*class="cbp-l-inline-view"[^>]*>(.*?)</a>', wrap, re.S)]
    return {"title": g("cbp-l-inline-title"), "authors": g("cbp-l-inline-subtitle"), "abstract": g("cbp-l-inline-desc"), "images": imgs, "rawActions": acts}
def finfo(rel):
    p = os.path.join(M, rel)
    if not os.path.isfile(p): return {"path": rel, "exists": False}
    b = open(p, "rb").read()
    return {"path": rel, "exists": True, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}
def build(kind, page, prefix, count):
    lst = listing(page, prefix); items = []
    for n in range(1, count + 1):
        src = f"{prefix}/project{n}.html"; d = detail(src); l = lst.get(n, {})
        pdf = None; actions = []
        for href, label in d["rawActions"]:
            if label.lower() == "get pdf": pdf = finfo(href)
            else:
                local = not re.match(r"^[a-z]+:", href)
                actions.append({"legacyLabel": label, "url": href, "local": local, **({"file": finfo(href)} if local else {})})
        items.append({"id": f"{kind}-{n:02d}", "legacyNumber": n, "legacyDetail": src, **d, **l, "pdf": pdf, "actions": actions,
                      "images": [finfo(i) for i in d["images"]], "thumbnail": finfo(l["thumbnail"]) if l.get("thumbnail") else None})
        del items[-1]["rawActions"]
    return items
data = {"extractedFrom": "legacy-live-2026-11-24 (mirror of http://glycosearch.com/ on 2026-11-24)",
        "papers": build("paper", "papers.html", "ajax-lightbox-gallery", 14),
        "projects": build("project", "projects.html", "ajax-lightbox-gallery-projects", 4)}
i = rd("index.html"); k = i.index("imageMapPro(") + 12
im, _ = json.JSONDecoder().raw_decode(i[k:])
data["nomenclature"] = {"image": "assets/images/Glycan_nomenclature_small.png", "width": im["general"]["width"], "height": im["general"]["height"],
    "shapes": [{"key": s["title"].split("_")[-1].replace("rect-", ""), "shape": s["type"], "x": s["x"], "y": s["y"], "w": s["width"], "h": s["height"],
                "label": re.findall(r'"text": "([^"]*)"', json.dumps(s["tooltip_content"], ensure_ascii=False))[0]} for s in im["spots"]]}
json.dump(data, open(os.path.join(ROOT, "site/content/legacy-extract.json"), "w"), indent=1, ensure_ascii=False)
# report + cross-check
errs = []
for it in data["papers"] + data["projects"]:
    miss = [x["path"] for x in it["images"] if not x["exists"]]
    print(it["id"], "| cats", " ".join(it.get("categories") or ["?"]), "| imgs", len(it["images"]), "| pdf", it["pdf"] and it["pdf"].get("bytes"), "| actions", [a["legacyLabel"] for a in it["actions"]], "| abstract", len(it["abstract"]), "chars")
    if miss: errs.append((it["id"], "missing images", miss))
    if not it["pdf"] or not it["pdf"]["exists"]: errs.append((it["id"], "pdf missing"))
    if not it.get("shortTitle"): errs.append((it["id"], "no listing entry"))
    for a in it["actions"]:
        if a["local"] and not a["file"]["exists"]: errs.append((it["id"], "local action file missing", a["url"]))
if len(sys.argv) > 1:
    inv = json.load(open(sys.argv[1]))
    for kind in ("papers", "projects"):
        for a, b in zip(inv[kind], data[kind]):
            if a["title"] != b["title"]: errs.append((b["id"], "title differs from inventory", a["title"], b["title"]))
            from urllib.parse import unquote
            if unquote(a["pdf_url"]).replace("http://glycosearch.com/", "") != b["pdf"]["path"]: errs.append((b["id"], "pdf differs", a["pdf_url"], b["pdf"]["path"]))
            ia = [x["url"].replace("http://glycosearch.com/", "") for x in a["actions"]]; ib = [x["url"] for x in b["actions"]]
            if ia != ib: errs.append((b["id"], "actions differ", ia, ib))
    print("inventory cross-check done")
print("ERRORS:", errs if errs else "none")

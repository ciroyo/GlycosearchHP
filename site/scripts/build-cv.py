#!/usr/bin/env python3
"""Build the curriculum vitae offered on the website from content/cv.json.

Usage:  python3 scripts/build-cv.py          (needs python-docx; the PDF is printed with Google Chrome, headless)
Output: additions/cv/CV.docx  editable edition
        additions/cv/CV.html  print source of the PDF (not published)
        additions/cv/CV.pdf   the file served at /assets/CV.pdf
The historical CV (../assets/CV.docx, ../assets/CV.pdf and the live mirror) is not read or changed.
The PDF uses its own fixed light print style: the website theme (light/dark) has no influence on it.
"""
import html, json, pathlib, subprocess, sys
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Inches

SITE = pathlib.Path(__file__).resolve().parent.parent
CV = json.loads((SITE / "content/cv.json").read_text(encoding="utf-8"))
OUT = SITE / "additions/cv"
OUT.mkdir(parents=True, exist_ok=True)
ME = "Schmidt, S."
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# ---- one neutral structure for both outputs: sections of blocks; a run is (text, style) with style in "", "b", "i"
def cite(e):
    runs = []
    for i, a in enumerate(e["authors"]):
        runs.append((a, "b" if a.rstrip("*") == ME else ""))
        runs.append(("; " if i < len(e["authors"]) - 1 else " ", ""))
    runs.append((e["title"].rstrip(".") + ". ", ""))
    runs.append((e["venue"], "i" if False else ""))
    if e.get("doi"):
        runs.append((" doi:" + e["doi"], ""))
    if e.get("code"):
        runs.append((". Code: " + e["code"], ""))
    if e.get("note"):
        runs.append((" " + e["note"], "i"))
    return runs

def sections():
    P = CV["publications"]
    S = []
    S.append(("Profile", [("p", [(CV["profile"], "")])]))
    S.append(("Professional experience", [("entry", x) for x in CV["experience"]]))
    S.append(("Education", [("entry", x) for x in CV["education"]]))
    S.append(("Honors and awards", [("dated", (y, t)) for y, t in CV["awards"]]))
    pubs = []
    n = sum(len(P[k]["items"]) for k in ("journal", "chapter", "preprints", "datascience"))
    for key in ("journal", "chapter", "preprints", "datascience"):
        pubs.append(("sub", P[key]["heading"]))
        for e in P[key]["items"]:
            pubs.append(("num", (cite(e), e.get("sub", []))))
    pubs.append(("fine", P["note"]))
    S.append(("Publications", pubs))
    S.append((CV["patent"]["heading"], [("num", (cite(e), [])) for e in CV["patent"]["items"]]))
    S.append(("Invited seminars", [("li", t) for t in CV["seminars"]]))
    S.append(("Teaching activities", [("li", t) for t in CV["teaching"]]))
    S.append(("Service", [("li", t) for t in CV["service"]]))
    S.append(("Activities", [("li", t) for t in CV["activities"]]))
    S.append(("Languages", [("p", [(", ".join(CV["languages"]), "")])]))
    return S

# ---- HTML (print source of the PDF)
def h(s): return html.escape(s, quote=False)
def runs_html(runs): return "".join(f"<{st}>{h(t)}</{st}>" if st else h(t) for t, st in runs)
def build_html():
    out = []
    for title, blocks in sections():
        out.append(f'<section><h2>{h(title)}</h2>')
        num = 0; open_ol = False; open_ul = False
        def close():
            nonlocal open_ol, open_ul
            if open_ol: out.append("</ol>"); open_ol = False
            if open_ul: out.append("</ul>"); open_ul = False
        for kind, v in blocks:
            if kind not in ("num",) and open_ol: close()
            if kind not in ("li",) and open_ul: close()
            if kind == "p": out.append(f"<p>{runs_html(v)}</p>")
            elif kind == "entry":
                out.append(f'<div class="entry"><div class="when">{h(v["when"])}</div><div><p class="what">{h(v["what"])}</p><p class="where">{h(v["where"])}</p>' + (f'<p>{h(v["text"])}</p>' if v.get("text") else "") + "</div></div>")
            elif kind == "dated": out.append(f'<div class="entry"><div class="when">{h(v[0])}</div><div><p>{h(v[1])}</p></div></div>')
            elif kind == "sub": out.append(f"<h3>{h(v)}</h3>")
            elif kind == "fine": out.append(f'<p class="fine">{h(v)}</p>')
            elif kind == "num":
                if not open_ol: out.append(f'<ol start="{num + 1}">'); open_ol = True
                num += 1
                runs, sub = v
                out.append("<li>" + runs_html(runs) + ("<ul>" + "".join(f"<li>{h(s)}</li>" for s in sub) + "</ul>" if sub else "") + "</li>")
            elif kind == "li":
                if not open_ul: out.append("<ul>"); open_ul = True
                out.append(f"<li>{h(v)}</li>")
        close()
        out.append("</section>")
    css = """
@page { size: Letter; margin: 16mm 18mm 18mm; @bottom-center { content: "Dr. Samuel Schmidt · Curriculum Vitae · " counter(page) " / " counter(pages); font: 8pt "Helvetica Neue", Arial, sans-serif; color: #5f6670; } }
* { box-sizing: border-box; }
html { color-scheme: only light; }
body { margin: 0; background: #fff; color: #1b1e23; font: 9.8pt/1.4 Georgia, "Times New Roman", serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; hyphens: manual; }
header { border-bottom: 1.2pt solid #1b1e23; padding-bottom: 9pt; margin-bottom: 4pt; }
.kicker { font: 600 7.6pt "Helvetica Neue", Arial, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #5f6670; margin: 0 0 5pt; }
h1 { font: 400 23pt/1.1 Georgia, serif; margin: 0 0 4pt; }
.role { font: 400 10.6pt "Helvetica Neue", Arial, sans-serif; margin: 0 0 3pt; }
.contact { font: 400 9pt "Helvetica Neue", Arial, sans-serif; color: #454b54; margin: 0; }
h2 { font: 700 8.2pt "Helvetica Neue", Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #2f3e9e; margin: 12pt 0 5pt; padding-bottom: 2.5pt; border-bottom: .6pt solid #c9c5bb; break-after: avoid; }
h3 { font: 700 9.4pt "Helvetica Neue", Arial, sans-serif; margin: 10pt 0 4pt; break-after: avoid; }
p { margin: 0 0 3pt; }
.entry { display: grid; grid-template-columns: 27mm 1fr; column-gap: 4mm; margin-bottom: 4.5pt; break-inside: avoid; }
.when { font: 400 8.8pt "Helvetica Neue", Arial, sans-serif; color: #454b54; padding-top: 1pt; }
.what { font-weight: 700; margin-bottom: 1pt; }
.where { color: #454b54; margin-bottom: 2pt; }
ol, ul { margin: 0; padding-left: 6.5mm; }
li { margin-bottom: 3.4pt; break-inside: avoid; overflow-wrap: anywhere; }
li ul { margin-top: 2pt; } li li { margin-bottom: 1.5pt; font-size: 9.4pt; color: #454b54; }
.fine { font-size: 8.8pt; color: #5f6670; margin-top: 4pt; }
"""
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Curriculum Vitae — {h(CV["name"])}</title><meta name="author" content="{h(CV["name"])}"><style>{css}</style></head><body>
<header><p class="kicker">Curriculum Vitae · {h(CV["edition"])}</p><h1>{h(CV["name"])} <span style="font-size:12pt;color:#454b54">({h(CV["degrees"])})</span></h1><p class="role">{h(CV["role"])}</p><p class="contact">{h(" · ".join(CV["contact"]))}</p></header>
{"".join(out)}
</body></html>"""

# ---- DOCX (editable)
SERIF, SANS = "Georgia", "Arial"
def font(run, name, size, bold=None, italic=None, color=None):
    run.font.name = name; run._element.rPr.rFonts.set(qn("w:eastAsia"), name); run.font.size = Pt(size)
    if bold is not None: run.bold = bold
    if italic is not None: run.italic = italic
    if color: run.font.color.rgb = RGBColor(*color)
def para(doc, after=3, before=0, left=None, hanging=None, keep=False):
    p = doc.add_paragraph(); f = p.paragraph_format
    f.space_after = Pt(after); f.space_before = Pt(before); f.line_spacing = 1.12
    if left is not None: f.left_indent = Inches(left)
    if hanging is not None: f.first_line_indent = Inches(-hanging)
    if keep: f.keep_with_next = True
    return p
def bottom_border(p, color="C9C5BB", size=6):
    pPr = p._p.get_or_add_pPr(); b = OxmlElement("w:pBdr"); e = OxmlElement("w:bottom")
    for k, v in (("w:val", "single"), ("w:sz", str(size)), ("w:space", "2"), ("w:color", color)): e.set(qn(k), v)
    b.append(e); pPr.append(b)
def add_runs(p, runs, size=10):
    for t, st in runs: font(p.add_run(t), SERIF, size, bold=(st == "b") or None, italic=(st == "i") or None)
def page_field(p):
    for code in ("PAGE", "NUMPAGES"):
        r = p.add_run(); font(r, SANS, 8, color=(0x5F, 0x66, 0x70))
        for tag, txt in (("begin", None), (None, code), ("end", None)):
            if tag:
                c = OxmlElement("w:fldChar"); c.set(qn("w:fldCharType"), tag); r._r.append(c)
            else:
                i = OxmlElement("w:instrText"); i.set(qn("xml:space"), "preserve"); i.text = txt; r._r.append(i)
        if code == "PAGE": font(p.add_run(" / "), SANS, 8, color=(0x5F, 0x66, 0x70))
def build_docx(path):
    d = Document()
    s = d.sections[0]; s.page_width = Inches(8.5); s.page_height = Inches(11)
    s.left_margin = s.right_margin = Inches(0.8); s.top_margin = Inches(0.75); s.bottom_margin = Inches(0.8)
    st = d.styles["Normal"]; st.font.name = SERIF; st.font.size = Pt(10); st.element.rPr.rFonts.set(qn("w:eastAsia"), SERIF)
    d.core_properties.title = "Curriculum Vitae — " + CV["name"]; d.core_properties.author = CV["name"]; d.core_properties.subject = "Edition " + CV["edition"]
    fp = s.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    font(fp.add_run(CV["name"] + " · Curriculum Vitae · "), SANS, 8, color=(0x5F, 0x66, 0x70)); page_field(fp)
    p = para(d, after=3); font(p.add_run("CURRICULUM VITAE · " + CV["edition"].upper()), SANS, 7.5, bold=True, color=(0x5F, 0x66, 0x70))
    p = para(d, after=2); font(p.add_run(CV["name"]), SERIF, 22); font(p.add_run("  (" + CV["degrees"] + ")"), SERIF, 12, color=(0x45, 0x4B, 0x54))
    p = para(d, after=1); font(p.add_run(CV["role"]), SANS, 10.5)
    p = para(d, after=6); font(p.add_run(" · ".join(CV["contact"])), SANS, 9, color=(0x45, 0x4B, 0x54)); bottom_border(p, "1B1E23", 10)
    for title, blocks in sections():
        p = para(d, before=10, after=5, keep=True); font(p.add_run(title.upper()), SANS, 8.5, bold=True, color=(0x2F, 0x3E, 0x9E)); bottom_border(p)
        num = 0; table = None
        for kind, v in blocks:
            if kind not in ("entry", "dated"): table = None
            if kind == "p": add_runs(para(d), v)
            elif kind in ("entry", "dated"):
                # two-column row without borders: period | text (robust in Word, Pages, LibreOffice and Google Docs)
                if table is None:
                    table = d.add_table(rows=0, cols=2); table.autofit = False
                    table.columns[0].width = Inches(1.15); table.columns[1].width = Inches(5.75)
                    tblPr = table._tbl.tblPr; w = OxmlElement("w:tblW"); w.set(qn("w:w"), str(int(6.9 * 1440))); w.set(qn("w:type"), "dxa")
                    for old_w in tblPr.findall(qn("w:tblW")): tblPr.remove(old_w)
                    tblPr.append(w)
                cells = table.add_row().cells
                cells[0].width = Inches(1.15); cells[1].width = Inches(5.75)
                when, lines = (v["when"], [(v["what"], "b", None), (v["where"], "", (0x45, 0x4B, 0x54))] + ([(v["text"], "", None)] if v.get("text") else [])) if kind == "entry" else (v[0], [(v[1], "", None)])
                p = cells[0].paragraphs[0]; p.paragraph_format.space_after = Pt(0); font(p.add_run(when), SANS, 8.8, color=(0x45, 0x4B, 0x54))
                for i, (t, stl, col) in enumerate(lines):
                    p = cells[1].paragraphs[0] if i == 0 else cells[1].add_paragraph()
                    p.paragraph_format.space_after = Pt(5 if i == len(lines) - 1 else 1); p.paragraph_format.line_spacing = 1.12
                    font(p.add_run(t), SERIF, 10, bold=(stl == "b") or None, color=col)
            elif kind == "sub":
                p = para(d, before=6, after=3, keep=True); font(p.add_run(v), SANS, 9.5, bold=True)
            elif kind == "fine": font(para(d, before=2).add_run(v), SERIF, 8.8, color=(0x5F, 0x66, 0x70))
            elif kind == "num":
                num += 1; runs, sub = v
                p = para(d, after=4 if not sub else 1, left=0.3, hanging=0.3); p.paragraph_format.tab_stops.add_tab_stop(Inches(0.3))
                font(p.add_run(f"{num}.\t"), SERIF, 10); add_runs(p, runs)
                for i, s_ in enumerate(sub):
                    q = para(d, after=4 if i == len(sub) - 1 else 1, left=0.5, hanging=0.14); font(q.add_run("– " + s_), SERIF, 9.3, color=(0x45, 0x4B, 0x54))
            elif kind == "li":
                p = para(d, after=3, left=0.3, hanging=0.18); font(p.add_run("•  " + v), SERIF, 10)
    d.save(path)

if __name__ == "__main__":
    (OUT / "CV.html").write_text(build_html(), encoding="utf-8")
    build_docx(OUT / "CV.docx")
    r = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={OUT / 'CV.pdf'}", (OUT / "CV.html").as_uri()], capture_output=True, text=True, timeout=120)
    if r.returncode != 0 or not (OUT / "CV.pdf").exists():
        sys.exit("PDF printing failed: " + r.stderr[-500:])
    for f in ("CV.docx", "CV.pdf"): print(f, (OUT / f).stat().st_size, "bytes")

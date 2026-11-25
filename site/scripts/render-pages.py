#!/usr/bin/env python3
"""Render every page of the PDFs added on 2026-11-25 as a complete page image (no cropping).

Usage:  python3 scripts/render-pages.py        (needs PyMuPDF: pip install pymupdf)
Input:  additions/papers_pdfs/<n>/<file>.pdf   (originals, never modified)
Output: additions/pages/paper-<n>/p-001.png …  plus additions/pages/pages.json (page count, size, PDF sha256)
The site build (scripts/build.mjs) only reads the output; it does not need Python.
"""
import hashlib, json, pathlib, sys
import fitz  # PyMuPDF

SITE = pathlib.Path(__file__).resolve().parent.parent
ADD = SITE / "additions"
DPI = 160
meta = {}
for folder in sorted((ADD / "papers_pdfs").iterdir()):
    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        continue
    pdf = pdfs[0]
    pid = f"paper-{folder.name}"
    out = ADD / "pages" / pid
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("p-*.png"):
        old.unlink()
    doc = fitz.open(pdf)
    pages = []
    for i, page in enumerate(doc, 1):
        pix = page.get_pixmap(dpi=DPI, alpha=False)  # full page rectangle: margins, headers and footers included
        name = f"p-{i:03d}.png"
        pix.save(out / name)
        pages.append({"file": f"pages/{pid}/{name}", "w": pix.width, "h": pix.height})
    meta[pid] = {"pdf": str(pdf.relative_to(ADD)), "pdfSha256": hashlib.sha256(pdf.read_bytes()).hexdigest(), "dpi": DPI, "count": len(pages), "pages": pages}
    print(pid, len(pages), "pages", file=sys.stderr)
(ADD / "pages" / "pages.json").write_text(json.dumps(meta, indent=1))

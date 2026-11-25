#!/usr/bin/env python3
"""Theme derivatives of the two raster learning figures (Glycome.jpg, Glycomics.jpg). Needs Pillow and numpy.
The originals in additions/learning/ are never changed and stay downloadable.

What is changed, and what is not:
  * Only the white BACKGROUND becomes transparent: near-white, unsaturated pixels connected to the image border
    (flood fill), plus enclosed pockets of pure flat paper white (inside letters, between lines). Tinted light
    details of the drawing (highlights) stay as they are. No inversion of the picture.
  * A 2 px band next to the removed background is un-mixed from white, so no white fringe remains on a dark page.
  * Dark variant only: neutral dark pixels (black lettering, the measured curve, leader lines, symbol outlines)
    are mapped to light greys so they stay readable on a dark page. Coloured pixels keep their colour.
Output: additions/learning/derived/<name>-light.png, <name>-dark.png, and report.json (pixel statistics).
"""
import json, pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

D = pathlib.Path(__file__).resolve().parent.parent / "additions" / "learning"
OUT = D / "derived"; OUT.mkdir(exist_ok=True)
report = {}
# (name, source file, relight neutral darks in the dark variant). The SPAAC frame is a still of the archive
# animation (white ground); it is a 3D rendering, so its dark atoms are left as they are.
JOBS = (("Glycome", D / "Glycome.jpg", True), ("Glycomics", D / "Glycomics.jpg", True), ("spaac-frame", D.parent / "derived" / "spaac-animation-frame.png", False))
for name, src, relight in JOBS:
    rgb = np.array(Image.open(src).convert("RGB")).astype(np.int16)
    h, w, _ = rgb.shape
    mx, mn = rgb.max(2), rgb.min(2)
    near_white = ((mn >= 236) & (mx - mn <= 14)).astype(np.uint8) * 255
    pad = np.pad(near_white, 1, constant_values=255)           # a white ring so the fill reaches every border pixel
    m = Image.fromarray(pad).copy(); ImageDraw.floodfill(m, (0, 0), 128)  # copy: fromarray images are read-only
    bg = np.array(m)[1:-1, 1:-1] == 128                         # background = white connected to the border
    # Paper-white pockets that the fill cannot reach (inside letters, between crossing lines, under the measured
    # curve) are background as well. They are told apart from white picture content by being pure, flat paper white
    # (all channels >= 247, no tint). Checked by eye for both figures: Glycome has no white-filled symbols at all;
    # in Glycomics the highlights of the spheres and tools are tinted (lavender / light blue) and are not touched.
    cand = (mn >= 247) & (mx - mn <= 6) & ~bg
    # ... but tiny pure-white spots that are NOT next to black lettering or lines are specular highlights of the
    # drawing (spheres in Glycomics) and must stay. A pocket counts as background if it is large (>= 60 px) or
    # touches neutral dark pixels (letters, curve, leader lines).
    ndark = ((mx - mn <= 38) & (mx <= 150)).astype(np.uint8) * 255
    near_dark = np.array(Image.fromarray(ndark).filter(ImageFilter.MaxFilter(5))) > 0
    pockets = np.zeros_like(cand); seen = np.zeros_like(cand); kept_highlights = 0
    for y0, x0 in zip(*np.where(cand)):
        if seen[y0, x0]: continue
        comp = []; stack = [(y0, x0)]; seen[y0, x0] = True; touches = False
        while stack:
            y, x = stack.pop(); comp.append((y, x)); touches = touches or near_dark[y, x]
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < h and 0 <= xx < w and cand[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True; stack.append((yy, xx))
        if len(comp) >= 60 or touches:
            ys, xs = zip(*comp); pockets[list(ys), list(xs)] = True
        else: kept_highlights += 1
    bg = bg | pockets
    enclosed_white = (near_white == 255) & ~bg                  # remaining light pixels: part of the drawing, kept
    band = np.array(Image.fromarray(bg.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    band &= ~bg
    alpha = np.full((h, w), 255, np.float32)
    alpha[bg] = 0
    out = rgb.astype(np.float32)
    # un-mix white from the anti-aliased edge pixels: c = a*fg + (1-a)*255
    a_edge = 1 - out[band].min(1) / 255.0
    a_edge = np.clip(a_edge * 1.15, 0.0, 1.0)
    fg = np.where(a_edge[:, None] > 0.02, (out[band] - (1 - a_edge[:, None]) * 255) / np.maximum(a_edge[:, None], 0.02), 0)
    out[band] = np.clip(fg, 0, 255); alpha[band] = a_edge * 255
    light = np.dstack([out, alpha]).astype(np.uint8)
    Image.fromarray(light, "RGBA").save(OUT / f"{name}-light.png", optimize=True)
    dark = out.copy()
    v = dark.max(2); sat = dark.max(2) - dark.min(2)
    neutral_dark = (sat <= 38) & (v <= 150) & (alpha > 0) & relight
    grey = dark[neutral_dark].mean(1)
    dark[neutral_dark] = (236 - grey * 0.62)[:, None]           # black -> #ececec, mid grey stays mid grey
    Image.fromarray(np.dstack([dark, alpha]).astype(np.uint8), "RGBA").save(OUT / f"{name}-dark.png", optimize=True)
    report[name] = {"size": [w, h], "background_removed_share": round(float(bg.mean()), 4), "paper_white_pockets_px": int(pockets.sum()), "white_highlights_kept": kept_highlights, "light_pixels_kept_in_drawing_px": int(enclosed_white.sum()), "edge_band_px": int(band.sum()), "neutral_dark_relit_px": int(neutral_dark.sum())}
(OUT / "report.json").write_text(json.dumps(report, indent=1))
print(json.dumps(report))

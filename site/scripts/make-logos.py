#!/usr/bin/env python3
"""Icon marks for the Experience timeline, derived from the files the owner supplied on 2026-11-25
(additions/logos/source/, byte-identical copies; never modified). Needs Pillow and numpy.

Outputs (additions/logos/):
  cornell-seal-red.png    the red seal, cropped to its outline (transparent outside)
  cornell-seal-white.png  the same seal in white. The supplied Cornell_white.png is fully opaque with a
                          checkerboard pattern baked into the pixels, so it cannot be placed on a dark page;
                          the white variant is therefore made from the alpha mask of the red seal.
  radboud-icon-red.svg / radboud-icon-white.svg   the emblem paths of Logo_Radboud_University.svg, recoloured;
                          red taken from the official Radboud University logo file (RU_logo_NL_official.png)
  vaionex-symbol.png      the supplied symbol, cropped to its outline
"""
import collections, json, pathlib, re
import numpy as np
from PIL import Image

L = pathlib.Path(__file__).resolve().parent.parent / "additions" / "logos"
SRC = L / "source"
report = {}

def crop_alpha(im, pad=2):
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 8)
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, im.width), min(ys.max() + pad + 1, im.height))
    return im.crop(box), box

red = Image.open(SRC / "Cornell_red_bolt.png").convert("RGBA")
red_c, box = crop_alpha(red)
red_c.save(L / "cornell-seal-red.png", optimize=True)
arr = np.array(red_c)
white = arr.copy(); white[..., :3] = 255
Image.fromarray(white).save(L / "cornell-seal-white.png", optimize=True)
op = arr[arr[..., 3] > 250][:, :3]
report["cornell"] = {"size": red_c.size, "red": "#%02x%02x%02x" % tuple(int(v) for v in np.median(op, 0)), "outside_transparent": bool((arr[[0, 0, -1, -1], [0, -1, 0, -1], 3] == 0).all())}
# how the supplied white file looks: opaque, checkerboard
w = np.array(Image.open(SRC / "Cornell_white.png").convert("RGBA"))
report["cornell_white_supplied"] = {"size": [int(w.shape[1]), int(w.shape[0])], "opaque_share": float((w[..., 3] == 255).mean()), "distinct_grey_levels": sorted({int(v) for v in np.unique(w[::7, ::7, 0])})[:12]}

svg = (SRC / "Logo_Radboud_University.svg").read_text(encoding="utf-8")
paths = re.findall(r'<path id="([^"]+)"[^>]*? d="([^"]+)"', svg, flags=re.S)
ru = np.array(Image.open(SRC / "RU_logo_NL_official.png").convert("RGBA"))
px = ru[(ru[..., 3] > 250) & (ru[..., 0] > 150) & (ru[..., 1] < 90)][:, :3]
ru_red = "#%02x%02x%02x" % collections.Counter(map(tuple, px)).most_common(1)[0][0]
for name, fill in (("red", ru_red), ("white", "#ffffff")):
    body = "".join(f'<path fill-rule="nonzero" d="{d}"/>' for _, d in paths)
    (L / f"radboud-icon-{name}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 312 400" fill="{fill}">{body}</svg>\n', encoding="utf-8")
# Alternative, not used by default: the shield alone, without the motto band that surrounds it in the emblem
# ("IN DEI NOMINE FELICITER", path id "tekst"). The motto is part of the emblem, not a name wordmark, so the
# default icon keeps it. To switch, point profile.logos.radboud in content/site.json to radboud-shield-*.svg.
for name, fill in (("red", ru_red), ("white", "#ffffff")):
    body = "".join(f'<path fill-rule="nonzero" d="{d}"/>' for pid, d in paths if pid == "logo")
    (L / f"radboud-shield-{name}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 312 400" fill="{fill}">{body}</svg>\n', encoding="utf-8")
report["radboud"] = {"paths": [p for p, _ in paths], "red": ru_red, "viewBox": "0 0 312 400", "note": "path 'tekst' is the motto band of the emblem (IN DEI NOMINE FELICITER), checked on a rendering; it is not the wordmark 'Radboud Universiteit'", "alternative_without_motto": ["radboud-shield-red.svg", "radboud-shield-white.svg"]}

v = Image.open(SRC / "Vaionex_symbol.png").convert("RGBA")
v_c, vbox = crop_alpha(v, pad=8)
v_c.thumbnail((640, 640), Image.LANCZOS)
v_c.save(L / "vaionex-symbol.png", optimize=True)
report["vaionex"] = {"size": v_c.size, "crop_box": [int(x) for x in vbox]}
(L / "derivatives.json").write_text(json.dumps(report, indent=1, default=lambda o: list(o)))
print(json.dumps(report, default=lambda o: list(o)))

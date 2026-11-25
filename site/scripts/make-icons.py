#!/usr/bin/env python3
"""Draws the Glycosearch tab and touch icons into src/icons/ (standard library only).
White sugar ring on the brand orange, the same geometry as FAVICON in build.mjs:
  tab icons (16, 32, 48, favicon.ico): rounded orange tile, ring at 80 %
  touch icons (180, 192, 512): full orange square (the system rounds it), ring at 62 %
Run:  python3 scripts/make-icons.py   then   node scripts/build.mjs
"""
import math, os, struct, zlib
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "icons")
ORANGE, WHITE = (0xF9, 0x66, 0x27), (255, 255, 255)
HEX = [(12, 2.5), (20.2, 7.25), (20.2, 16.75), (12, 21.5), (3.8, 16.75), (3.8, 7.25)]
STROKE, DOT, RADIUS = 2.7, 3.6, 5.4

def seg_dist(px, py, a, b):
    ax, ay = a; bx, by = b; dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)

def sample(x, y, scale, rounded):
    """colour and alpha of one point in the 24-unit icon space"""
    if rounded:
        qx, qy = abs(x - 12) - (12 - RADIUS), abs(y - 12) - (12 - RADIUS)
        if math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) > RADIUS: return None
    mx, my = 12 + (x - 12) / scale, 12 + (y - 12) / scale        # into the molecule's own space
    if math.hypot(mx - 12, my - 12) <= DOT: return WHITE
    if min(seg_dist(mx, my, HEX[i], HEX[(i + 1) % 6]) for i in range(6)) <= STROKE / 2: return WHITE
    return ORANGE

def render(size, scale, rounded, ss=8):
    rows = []
    for j in range(size):
        row = bytearray([0])
        for i in range(size):
            r = g = b = a = 0
            for v in range(ss):
                for u in range(ss):
                    c = sample((i + (u + .5) / ss) * 24 / size, (j + (v + .5) / ss) * 24 / size, scale, rounded)
                    if c: r += c[0]; g += c[1]; b += c[2]; a += 1
            n = ss * ss
            row += bytes([round(r / a), round(g / a), round(b / a), round(255 * a / n)] if a else [0, 0, 0, 0])
        rows.append(bytes(row))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")

def write(name, data):
    with open(os.path.join(OUT, name), "wb") as f: f.write(data)
    print(name, len(data))

tab = {s: render(s, .8, True) for s in (16, 32, 48)}
for s, d in tab.items(): write(f"favicon-{s}.png", d)
head, body, off = struct.pack("<HHH", 0, 1, 3), b"", 6 + 16 * 3
for s, d in tab.items():
    head += struct.pack("<BBBBHHII", s, s, 0, 0, 1, 32, len(d), off); body += d; off += len(d)
write("favicon.ico", head + body)
for name, s in (("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)): write(name, render(s, .62, False, ss=4))

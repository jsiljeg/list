# -*- coding: utf-8 -*-
"""Recolour the atrium nail face into the app's palette: gold nails on charcoal.

The earlier attempt redrew the sculpture as SVG strokes, and every variant of it
failed the same way. The face is legible only because of how the nails cluster —
lash arcs, a vertical bank down the nose ridge, two bands for the lips — and
independent strokes placed on a grid cannot reproduce a cluster. Dense sampling
mats the lace into a blob; sparse sampling is confetti. The nails are already in
the photograph, so the honest move is to keep them and change only the colour.

What this does: the wall is saturated cobalt and the metal is grey, so
saturation alone separates them, with a soft ramp between the two thresholds so
the nail edges do not alias. Each pixel's own brightness then decides how much
gold it gets, which keeps the sculpture's modelling — bright nail heads, shaded
shanks — instead of flattening it to a silhouette.

Run from the repo root:  python scripts/face-asset.py [out] [width]
"""
import colorsys
import os
import sys

from PIL import Image

SRC = "data/source/atrium-face-source.jpg"
OUT = sys.argv[1] if len(sys.argv) > 1 else "assets/atrium-face.webp"
WIDE = int(sys.argv[2]) if len(sys.argv) > 2 else 1200
BG = (22, 21, 19)             # --bg
GOLD = (201, 169, 97)         # --gold
S_FULL, S_NONE = 0.30, 0.52   # saturation: all metal below, all wall above
LUM_LO, LUM_HI = 60, 200      # brightness range the gold is modulated across

im = Image.open(SRC).convert("RGB")
im = im.resize((WIDE, int(round(WIDE * im.height / im.width))), Image.LANCZOS)
w, h = im.size
px = im.load()
out = Image.new("RGB", (w, h))
op = out.load()

for y in range(h):
    for x in range(w):
        r, g, b = [c / 255 for c in px[x, y]]
        _, s, v = colorsys.rgb_to_hsv(r, g, b)
        a = 1.0 if s <= S_FULL else (0.0 if s >= S_NONE else (S_NONE - s) / (S_NONE - S_FULL))
        if v < 0.30:                       # deep shadow is wall, not metal
            a *= max(0.0, (v - 0.16) / 0.14)
        lum = (0.299 * r + 0.587 * g + 0.114 * b) * 255
        t = min(1.0, max(0.0, (lum - LUM_LO) / (LUM_HI - LUM_LO)))
        k = a * (0.35 + 0.65 * t)          # how much gold this pixel gets
        op[x, y] = tuple(int(round(BG[i] + (GOLD[i] - BG[i]) * k)) for i in range(3))

out.save(OUT, quality=86, method=6)
print("%s — %dx%d, %.0f kB" % (OUT, w, h, os.path.getsize(OUT) / 1024))

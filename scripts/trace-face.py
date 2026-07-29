# -*- coding: utf-8 -*-
"""Redraw the atrium nail face as gold strokes on charcoal.

The photograph is only the source: the nails are grey metal on saturated cobalt,
so saturation separates them cleanly from the ground. Every cell of a grid that
looks like metal emits one short stroke, angled from the local brightness
gradient so the strokes lie along the sculpture's own grain rather than at random.
Output is an SVG of plain lines — sharp at any size, gold on charcoal, and no
cobalt to fight the palette. The stroke colour is written out literally rather
than left as currentColor, because the drawing is used as a CSS background-image
(behind the story splash), where inherited colour does not reach it.

Run from the repo root:  python scripts/trace-face.py [source image]

The default source is the colour photograph archived in data/source/ — the copy
in assets/ is greyscale, so the saturation split cannot be recovered from it.
"""
import colorsys
import math
import random
import sys

from PIL import Image, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else "data/source/atrium-face-source.jpg"
OUT = "assets/atrium-face.svg"
W, H = 300, 224          # sampling grid, not the output size
STEP = 2                 # one candidate stroke every STEP cells
SAT_MAX, VAL_MIN = 0.42, 0.30
STROKE = "#c9a961"       # --gold
random.seed(7)           # a fixed seed so the drawing is reproducible

im = Image.open(SRC).convert("RGB").resize((W, H), Image.LANCZOS)
lum = im.convert("L").filter(ImageFilter.GaussianBlur(1.2))
px, lp = im.load(), lum.load()


def is_metal(x, y):
    r, g, b = [c / 255 for c in px[x, y]]
    _, s, v = colorsys.rgb_to_hsv(r, g, b)
    return s < SAT_MAX and v > VAL_MIN


def grain(x, y):
    """Angle of the local brightness edge — the direction a nail lies in."""
    if not (1 <= x < W - 1 and 1 <= y < H - 1):
        return random.uniform(0, math.pi)
    gx = (lp[x + 1, y - 1] + 2 * lp[x + 1, y] + lp[x + 1, y + 1]
          - lp[x - 1, y - 1] - 2 * lp[x - 1, y] - lp[x - 1, y + 1])
    gy = (lp[x - 1, y + 1] + 2 * lp[x, y + 1] + lp[x + 1, y + 1]
          - lp[x - 1, y - 1] - 2 * lp[x, y - 1] - lp[x + 1, y - 1])
    if abs(gx) + abs(gy) < 24:                    # flat: no grain to follow
        return random.uniform(0, math.pi)
    return math.atan2(gx, -gy) + random.uniform(-0.35, 0.35)


strokes = []
for gy in range(1, H - 1, STEP):
    for gx in range(1, W - 1, STEP):
        if not is_metal(gx, gy):
            continue
        a = grain(gx, gy)
        half = random.uniform(1.5, 2.6)
        jx, jy = random.uniform(-.6, .6), random.uniform(-.6, .6)
        x1, y1 = gx + jx - math.cos(a) * half, gy + jy - math.sin(a) * half
        x2, y2 = gx + jx + math.cos(a) * half, gy + jy + math.sin(a) * half
        strokes.append("M%.1f %.1fL%.1f %.1f" % (x1, y1, x2, y2))

body = "".join('<path d="%s"/>' % s for s in strokes)
svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" fill="none" '
    'stroke="%s" stroke-width=".9" stroke-linecap="round" '
    'stroke-opacity=".85">%s</svg>' % (W, H, STROKE, body)
)
open(OUT, "w", encoding="utf-8").write(svg)
print("%s — %d strokes, %.0f kB" % (OUT, len(strokes), len(svg) / 1024))

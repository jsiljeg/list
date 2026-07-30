# -*- coding: utf-8 -*-
"""Recolour one of the atrium's nail sculptures into the app's palette.

Generalised from scripts/face-asset.py, which did this for the face. Both
sculptures sit on a strongly coloured wall (the face on cobalt, the bowl on red)
while the nails themselves are grey metal, so *saturation alone* separates
subject from ground — no tracing, no masks by hand. A soft ramp between the two
thresholds keeps the nail edges from aliasing, and each pixel's own brightness
decides how much gold it gets, so the modelling survives (bright heads, shaded
shanks) instead of flattening into a silhouette.

Why not redraw them as SVG strokes: tried, twice. The face failed because its
legibility lives in how nails *cluster*, which independent strokes cannot make.
The bowl fails differently — a closed oval with marks radiating off it reads as
an eye or a sun at every size, and a side-on saucer reads as a smiling mouth,
which is exactly the complaint that sent us back here.

Run from the repo root:

    python scripts/nail-asset.py face
    python scripts/nail-asset.py bowl

Add a width to override, e.g. `python scripts/nail-asset.py bowl 520`.
"""
import colorsys
import os
import sys

from PIL import Image

BG = (22, 21, 19)             # --bg
GOLD = (201, 169, 97)         # --gold

SUBJECTS = {
    # src, out, width, saturation window (all metal below S_FULL, all wall
    # above S_NONE), brightness range the gold is modulated across, alpha out
    "face": dict(src="data/source/atrium-face-source.jpg",
                 out="assets/atrium-face.webp",
                 wide=1200, s_full=0.30, s_none=0.52,
                 lum=(60, 200), alpha=False),
    # The bowl is an inline ornament, so it wants transparency rather than a
    # baked charcoal ground: the closing mark sits on the list background and
    # must not paint a rectangle over it.
    "bowl": dict(src="data/source/atrium-bowl-source.jpg",
                 out="assets/atrium-bowl.webp",
                 wide=440, s_full=0.30, s_none=0.52,
                 lum=(60, 200), alpha=True),
}

name = sys.argv[1] if len(sys.argv) > 1 else "face"
if name not in SUBJECTS:
    sys.exit("unknown subject %r — one of: %s" % (name, ", ".join(SUBJECTS)))
cfg = SUBJECTS[name]
wide = int(sys.argv[2]) if len(sys.argv) > 2 else cfg["wide"]
s_full, s_none = cfg["s_full"], cfg["s_none"]
lum_lo, lum_hi = cfg["lum"]

if not os.path.exists(cfg["src"]):
    sys.exit("missing source photo: %s" % cfg["src"])

im = Image.open(cfg["src"]).convert("RGB")
im = im.resize((wide, int(round(wide * im.height / im.width))), Image.LANCZOS)
w, h = im.size
px = im.load()
out = Image.new("RGBA" if cfg["alpha"] else "RGB", (w, h))
op = out.load()

for y in range(h):
    for x in range(w):
        r, g, b = [c / 255 for c in px[x, y]]
        _, s, v = colorsys.rgb_to_hsv(r, g, b)
        a = 1.0 if s <= s_full else (0.0 if s >= s_none else (s_none - s) / (s_none - s_full))
        if v < 0.30:                       # deep shadow is wall, not metal
            a *= max(0.0, (v - 0.16) / 0.14)
        lum = (0.299 * r + 0.587 * g + 0.114 * b) * 255
        t = min(1.0, max(0.0, (lum - lum_lo) / (lum_hi - lum_lo)))
        k = a * (0.35 + 0.65 * t)          # how much gold this pixel gets
        if cfg["alpha"]:
            op[x, y] = GOLD + (int(round(255 * k)),)
        else:
            op[x, y] = tuple(int(round(BG[i] + (GOLD[i] - BG[i]) * k)) for i in range(3))

out.save(cfg["out"], quality=86, method=6)
print("%s — %dx%d, %.0f kB" % (cfg["out"], w, h, os.path.getsize(cfg["out"]) / 1024))

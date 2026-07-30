# -*- coding: utf-8 -*-
"""Measure a glass silhouette off a product photo, row by row.

Every glass icon that was drawn by eye came out wrong in the same direction —
too narrow at the shoulder, and ending in a V where the real bowl tapers. Two of
them shipped that way. The fix is not to look harder: it is to measure.

The photos are a lit glass on a near-black ground, so for each row the leftmost
and rightmost pixel that beats the row's own background median by `--thresh` is
the outline. The row median is taken from the outer 12 columns, which handles
the vertical gradient these product shots have.

    python scripts/trace-outline.py photo.png            # profile + summary
    python scripts/trace-outline.py photo.png --marks    # write photo.edges.png

Read the summary, not just the numbers: `rim / widest` is the ratio every
eyeballed attempt got wrong, and `bowl merges into stem at` is the row where the
width stops falling — a bowl that ends above it has been drawn as a V.

To turn the profile into a path, map photo pixels to the icon's viewBox with one
uniform scale (`px per unit` below), then verify by overlaying the candidate SVG
back on the photo at that exact offset and scale — a stretched overlay flatters
a wrong curve, which is how one of these got approved once already.
"""
import sys

from PIL import Image, ImageDraw

args = [a for a in sys.argv[1:] if not a.startswith("--")]
if not args:
    sys.exit(__doc__)
src = args[0]
thresh = 7
for a in sys.argv[1:]:
    if a.startswith("--thresh="):
        thresh = int(a.split("=", 1)[1])

im = Image.open(src).convert("L")
w, h = im.size
px = im.load()


def row_bg(y):
    s = [px[x, y] for x in range(12)] + [px[x, y] for x in range(w - 12, w)]
    s.sort()
    return s[len(s) // 2]


prof = []
for y in range(h):
    bg = row_bg(y)
    left = right = None
    for x in range(w):
        if px[x, y] - bg > thresh:
            if left is None:
                left = x
            right = x
    prof.append((y, left, right))

hit = [(y, l, r) for y, l, r in prof if l is not None]
if not hit:
    sys.exit("nothing found above the background — try a lower --thresh")

top = hit[0][0]
bottom = hit[-1][0]
width = {y: r - l for y, l, r in hit}

# The stem is the long run of near-minimum width, and it has to be found first:
# without it the widest row is the foot, which is wider than the bowl on most
# stemware, and every ratio below comes out wrong. Search only the middle band —
# a stray pixel in the last row of the photo is narrower than any stem.
band = [y for y in width if top + (bottom - top) * 0.30 < y < top + (bottom - top) * 0.88]
minw = min(width[y] for y in band)
stem = [y for y in band if width[y] <= minw * 1.25]
stem_top = min(stem)

bowl = [t for t in hit if t[0] < stem_top]
widest = max(bowl, key=lambda t: t[2] - t[1])
centre = (widest[1] + widest[2]) / 2

# The rim: a little below the top, so the rim ellipse has resolved but the bowl
# has not started to swell. Taking the topmost row instead catches the far edge
# of the ellipse and reads far too narrow.
rim_y = top + max(4, int((bottom - top) * 0.025))
rim = next(t for t in bowl if t[0] >= rim_y)

merge = stem_top

print("size %dx%d   glass rows %d..%d" % (w, h, top, bottom))
print("rim      y=%-4d width %d" % (rim[0], rim[2] - rim[1]))
print("widest   y=%-4d width %d   centre x=%.1f" % (widest[0], widest[2] - widest[1], centre))
print("rim / widest = %.3f" % ((rim[2] - rim[1]) / (widest[2] - widest[1])))
print("bowl merges into stem at y=%d (%.0f%% down the glass)"
      % (merge, 100 * (merge - top) / (bottom - top)))
print("px per unit if the glass spans 92 viewBox units: %.2f" % ((bottom - top) / 92.0))
print()
print("  y     left  right  width")
for y, l, r in prof[::18]:
    if l is not None:
        print("%5d %6d %6d %6d" % (y, l, r, r - l))

if "--marks" in sys.argv:
    vis = Image.open(src).convert("RGB")
    d = ImageDraw.Draw(vis)
    for y, l, r in prof:
        if l is not None:
            d.point((l, y), fill=(255, 60, 60))
            d.point((r, y), fill=(255, 60, 60))
    out = src.rsplit(".", 1)[0] + ".edges.png"
    vis.save(out)
    print("\nmarked outline written to %s" % out)

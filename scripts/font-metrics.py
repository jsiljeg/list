# -*- coding: utf-8 -*-
"""Measure the webfont against its local fallbacks, so the swap can be made invisible.

Markazi Text and Raleway both load from Google Fonts with display=swap: the first
paint is always a local font, and if that local font sets text wider than the real
one, the heading is laid out too big and then visibly snaps smaller when the
webfont lands. That is what the language screen was doing — Georgia sets the same
string 33% wider than Markazi.

The fix is a @font-face in css/style.css that borrows the fallback's outlines and
overrides its metrics to the webfont's. This script prints the numbers that go in
it. Re-run it if a font in the stack is ever changed.

    python scripts/font-metrics.py

Needs `pip install playwright` and `playwright install chromium`, and network
access to fonts.googleapis.com.
"""
import json

from playwright.sync_api import sync_playwright

GOOGLE = ("https://fonts.googleapis.com/css2?family=Markazi+Text:wght@400;500;600"
          "&family=Raleway:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap")

# (webfont, [local fallbacks in stack order])
STACKS = [
    ("Markazi Text", ["Georgia", "Times New Roman"]),
    ("Raleway", ["Segoe UI", "Arial"]),
]

SAMPLE = "Odaberite jezik · Choose your language — Château Margaux 2015"

MEASURE = """async ([families, sample]) => {
  for (const f of families) await document.fonts.load('1000px "' + f + '"');
  await document.fonts.ready;
  const ctx = document.createElement('canvas').getContext('2d');
  const out = {};
  for (const f of families) {
    ctx.font = '1000px "' + f + '"';
    const m = ctx.measureText(sample);
    out[f] = {w: m.width, a: m.fontBoundingBoxAscent, d: m.fontBoundingBoxDescent};
  }
  return out;
}"""


def main():
    families = [f for web, locals_ in STACKS for f in [web] + locals_]
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content('<meta charset=utf-8><link rel=stylesheet href="%s">' % GOOGLE)
        page.wait_for_timeout(3000)
        m = page.evaluate(MEASURE, [families, SAMPLE])
        browser.close()

    for web, fallbacks in STACKS:
        w = m[web]
        em = w["a"] + w["d"]
        print("\n%s: width %.1f, ascent %.3fem, descent %.3fem (line %.3f)"
              % (web, w["w"], w["a"] / 1000, w["d"] / 1000, em / 1000))
        for fb in fallbacks:
            f = m[fb]
            if abs(f["w"] - w["w"]) < 1:
                print("  %-18s not installed here (measured identical to the default)" % fb)
                continue
            adj = w["w"] / f["w"]
            print("  %-18s size-adjust: %.1f%%  ascent-override: %.1f%%  descent-override: %.1f%%"
                  % (fb, adj * 100, w["a"] / 10 / adj, w["d"] / 10 / adj))
            print("  %-18s (fallback sets this sample %+.1f%% wide)" % ("", (f["w"] / w["w"] - 1) * 100))
    print("\nraw:", json.dumps(m))


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""Bottle-by-bottle checklist, in wine-list order.

Written for one pass through the cellar: every wine missing something appears
once, with everything it needs listed under it, so no bottle has to be picked up
twice. A wine sold both by the glass and by the bottle is listed once, at its
first position, because it is the same bottle either way.

    python scripts/label-checklist.py        # writes docs/label-checklist.md

Re-run after each batch of answers — it reads the data, so it shrinks as the
gaps get filled.
"""
import json
import os
import re
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="backslashreplace")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

d = json.load(open("data/wines.json", encoding="utf-8"))
i18n = open("js/i18n.js", encoding="utf-8").read()

def hr_block(name):
    """The Croatian half of one i18n group, as a {key: label} dict. Some groups
    quote their keys ("bottle-red") and some do not (sparkling), so the quotes
    come off after matching — leaving them on is why the headings first came out
    as raw ids."""
    m = re.search(r"\b%s:\s*\{(.*?)\n  \}" % name, i18n, re.S)
    if not m:
        return {}
    pairs = re.findall(r'("[^"]+"|[A-Za-z_][\w-]*)\s*:\s*"([^"]+)"', m.group(1))
    return {k.strip('"'): v for k, v in pairs}

SECTIONS = hr_block("sections")
CATEGORIES = hr_block("categories")

# Questions that need the bottle in hand, keyed by producer + a name fragment.
OPEN = {
    ("Roagna", "Barbaresco Paj"): "which cuvée — Crichët Pajé or Pajè Vecchie Viti? the name may be wrong",
    ("Walter Scott", "Cuvée Ruth"): "vintage",
    ("Clai", "Tasel"): "vintage",
    ("Casa Rojo", "Tokyo"): "grape varieties, and whether it is sparkling — we hold it as a still red",
    ("Tomac", "Diplomat"): "dosage — we say Extra Brut, a Brut Nature also exists",
    ("Movia", "Puro Brut"): "dosage — we say Brut, you saw 1–2 g RS which would be Brut Nature",
    ("Pertois-Moriset", "Assemblage"): "full name — '2017 Grand Cru Oger Extra Brut'? we hold 'L'Assemblage Brut'",
    ("L'Hoste", "Hoste"): "full name — 'Grand Rosé Brut'? and the Decanter 90",
    ("Heymann-Löwenstein", "Schieferterrassen Beeren"): "Auslese or Beerenauslese — we hold Beerenauslese",
    ("Petrač", "Bregh"): "grapes — we hold Cabernet Sauvignon alone, you asked about CS + Merlot",
    ("Korak", "Sauvignon 2024"): "which vineyard — Klemenka or Kamenice?",
    ("Jakopić", "Sauvignon 2024"): "vineyard, if the label names one",
}

PLACEHOLDER = re.compile(r"autohtone|španjolske sorte|sorte$", re.I)
BUBBLES = re.compile(r"^(sparkling|champagne)")

seen = set()
out = []
total = 0

for sec in d["sections"]:
    for cat in sec["categories"]:
        sec_name = SECTIONS.get(sec["id"], sec["id"])
        cat_name = CATEGORIES.get(cat["id"], cat["id"])
        # "Bijela vina · Bijela vina" helps nobody
        head = sec_name if sec_name == cat_name else "%s · %s" % (sec_name, cat_name)
        block = []
        for g in cat["groups"]:
            for it in g["items"]:
                ins = it.get("insight")
                if not ins:
                    continue                       # water and the like carry none
                name = str(it.get("name", ""))
                prod = str(it.get("producer", "") or "")
                key = (name.lower(), prod.lower())
                if key in seen:
                    continue                       # same bottle, second listing
                need = []

                if not (ins.get("alcohol") or "").strip():
                    need.append("alcohol %")
                if ins.get("sweetness") is None and not BUBBLES.match(ins.get("style") or ""):
                    need.append("sweetness — suho / polusuho / poluslatko / slatko")
                if BUBBLES.match(ins.get("style") or "") and not ins.get("dosage"):
                    need.append("dosage — Brut Nature / Extra Brut / Brut / …")
                if it.get("terroir") is None:
                    need.append("vineyard, or confirm the label names none")
                if not re.search(r"\b(19|20)\d\d\b", name) and not BUBBLES.match(ins.get("style") or ""):
                    need.append("vintage")
                if PLACEHOLDER.search(ins.get("grape") or ""):
                    need.append('grape varieties — we hold the placeholder "%s"' % ins.get("grape"))
                for (p, frag), q in OPEN.items():
                    if p.lower() in prod.lower() and frag.lower() in name.lower():
                        need.append(q)

                if need:
                    seen.add(key)
                    total += 1
                    block.append((name, prod, need))
        if block:
            out.append((head, block))

lines = [
    "# Bottle-by-bottle checklist",
    "",
    "In wine-list order. **%d bottles** need something, and everything each one needs" % total,
    "is listed under it — no bottle has to be picked up twice. A wine poured both by",
    "the glass and by the bottle appears once, at its first position.",
    "",
    "Regenerate after each batch of answers: `python scripts/label-checklist.py`",
]
for head, block in out:
    lines += ["", "## " + head]
    for name, prod, need in block:
        lines += ["", "**%s** — %s" % (name, prod or "—")]
        lines += ["- [ ] " + n for n in need]

open("docs/label-checklist.md", "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")
print("\n".join(lines))
print("\n%d bottles listed" % total)

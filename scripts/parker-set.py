# -*- coding: utf-8 -*-
"""Record a verified Robert Parker score against a library wine.

The score itself has always been in library/wines.json; what was missing was
whether anyone had ever seen it on robertparker.com. `checked` is that date.
Called once per wine while working through docs/parker-verification.md:

    python scripts/parker-set.py <ref> <score> <YYYY-MM-DD>

Prints the old score beside the new one, so a silent correction is impossible.
The file round-trips exactly (ensure_ascii=False, indent=1, CRLF) — the whole
reason this is a script and not a sed.
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, "library", "wines.json")


def load():
    with open(LIB, encoding="utf-8") as fh:
        return json.load(fh)


def save(data):
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    with io.open(LIB, "w", encoding="utf-8", newline="\r\n") as fh:
        fh.write(text)


def main(ref, score, date):
    data = load()
    wine = data["wines"].get(ref)
    if wine is None:
        sys.exit("no such ref: %s" % ref)
    hits = [r for r in wine.get("ratings", []) if r.get("critic") == "Robert Parker"]
    if len(hits) != 1:
        sys.exit("%s has %d Robert Parker ratings, expected 1" % (ref, len(hits)))
    rating = hits[0]
    was = rating.get("score")
    rating["score"] = score
    rating["checked"] = date
    save(data)
    flag = "  <-- CHANGED" if was != score else ""
    print("%-58s %s -> %s%s" % (ref, was, score, flag))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])

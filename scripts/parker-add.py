# -*- coding: utf-8 -*-
"""Add a Parker score we did not have, or record that there is none.

The mirror of parker-set.py, which updates a score already on file. This one is
for the sweep in docs/parker-missing.md, where the two outcomes are equally
useful: a score, or a zero. A zero costs the same lookup as a hit, so it is
written to scripts/lib/parker-none.json and never looked up again.

    python scripts/parker-add.py <ref> <score>     # found one
    python scripts/parker-add.py <ref> none        # looked, there is none

Refuses a wine that already carries a Parker rating. Re-run rank-ratings.py
afterwards — a new score does not arrive in the right place by itself.
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, "library", "wines.json")
NONE = os.path.join(ROOT, "scripts", "lib", "parker-none.json")
DATE = "2026-09-06"


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def save(path, data):
    with io.open(path, "w", encoding="utf-8", newline="\r\n") as fh:
        fh.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")


def main(ref, score):
    lib = load(LIB)
    wine = lib["wines"].get(ref)
    if wine is None:
        sys.exit("no such ref: %s" % ref)
    if any(r["critic"] == "Robert Parker" for r in wine.get("ratings", [])):
        sys.exit("%s already has a Robert Parker rating" % ref)

    if score == "none":
        none = load(NONE)
        none["checked"][ref] = DATE
        none["checked"] = dict(sorted(none["checked"].items()))
        save(NONE, none)
        print("%-62s no Parker review" % ref)
        return

    wine.setdefault("ratings", []).append(
        {"critic": "Robert Parker", "score": score, "checked": DATE})
    save(LIB, lib)
    print("%-62s + Robert Parker %s" % (ref, score))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])

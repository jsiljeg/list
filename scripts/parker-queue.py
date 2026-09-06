# -*- coding: utf-8 -*-
"""What is still to look up on robertparker.com, and in what order.

Two lists are being worked at once and they are opposites: every score we hold
is verified (docs/parker-verification.md), and this is the other direction —
wines with no Parker rating that may well have one.

The unit is **producer + vintage**, not one wine at a time. A producer's whole
vintage comes back on one screen, so 136 wines collapse to ~100 queries and a
single lookup can answer five Meursaults. Sorted dearest first.

    python scripts/parker-queue.py          # what is left
    python scripts/parker-queue.py --all    # including the answered zeros
"""
import collections
import io
import json
import os
import re
import sys

# Windows consoles default to cp1252, which cannot print "Podveršič" or a €.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return json.load(fh)


def main(show_all):
    lib = read("library/wines.json")["wines"]
    lst = read("lists/theatrium.json")
    none = read("scripts/lib/parker-none.json")["checked"]

    price = {}
    for sec in lst["sections"]:
        for cat in sec["categories"]:
            for grp in cat["groups"]:
                for it in grp["items"]:
                    price[it["ref"]] = max(price.get(it["ref"], 0), it.get("price") or 0)

    todo = []
    for ref, w in lib.items():
        ins = w.get("insight") or {}
        if not ins or ins.get("kind") == "spirit":
            continue
        if any(r["critic"] == "Robert Parker" for r in w.get("ratings", [])):
            continue
        if not show_all and ref in none:
            continue
        # Parker's coverage of Croatia and Slovenia is thin and irregular; those
        # are a spot-check, not a sweep, so they are reported separately.
        todo.append(ref)

    home = [r for r in todo if (lib[r]["insight"].get("country") in ("HR", "SI"))]
    away = [r for r in todo if r not in home]

    pairs = collections.defaultdict(list)
    for ref in away:
        m = re.search(r"\b(19|20)\d{2}\b", lib[ref]["name"])
        pairs[(lib[ref]["producer"], m.group(0) if m else "NV")].append(ref)

    order = sorted(pairs, key=lambda k: -max(price.get(r, 0) for r in pairs[k]))
    print("%d wines to check, %d producer+vintage queries "
          "(%d answered zeros on file, %d HR/SI left aside)"
          % (len(away), len(pairs), len(none), len(home)))
    print()
    for i, key in enumerate(order, 1):
        refs = sorted(pairs[key], key=lambda r: -price.get(r, 0))
        print("%3d. %-34s %-5s %6s €  %s"
              % (i, key[0][:34], key[1], price.get(refs[0], 0) or "-",
                 " | ".join(lib[r]["name"] for r in refs)))


if __name__ == "__main__":
    main("--all" in sys.argv)

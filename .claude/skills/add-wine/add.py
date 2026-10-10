# -*- coding: utf-8 -*-
"""Write a new wine into the library, the list and (if new) producers.json.

    python .claude/skills/add-wine/add.py draft.json            # write
    python .claude/skills/add-wine/add.py draft.json --dry-run  # show, write nothing

The draft is one JSON file, so a whole addition is reviewable before anything
touches the live data:

    {
      "wine": { "name": ..., "producer": ..., "insight": {...}, "terroir": "",
                "note": {8 langs}, "notePlain": true, "tags": [...],
                "ratings": [...] },
      "listings": [ {"after": "<ref>", "price": 130},
                    {"before": "<ref>", "price": 12, "section": "glass"} ],
      "producer": { "name": "Le Ragose", "region": "...", "blurb": {8 langs} }
    }

- `ref` is derived exactly as split-library.py derives it; pass "ref" only to
  check it.
- Each listing is placed beside an existing ref (`after`/`before`), so it lands
  in the right section, category and group. A wine poured by the glass *and*
  sold by the bottle is one ref listed twice; when the anchor is itself listed
  in both, `section` ("glass", "bottle-red", ...) says which one you mean. `vol` (litres, a number) and
  `recommended` are passed through; `new` defaults to true (NOVO).
- **Never writes `anchor`.** A listing added after 10.09.2026 had no price that
  day and carries none (CLAUDE.md, "The anchor price").
- Refuses a ref already in the library and a producer already in
  producers.json — an existing estate's blurb is edited, not overwritten.
- Files round-trip exactly: ensure_ascii=False, indent=1, CRLF.
"""
import importlib.util
import io
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
LANGS = ["hr", "en", "it", "fr", "de", "zh", "sl", "es"]

spec = importlib.util.spec_from_file_location("split_library", os.path.join(ROOT, "scripts", "split-library.py"))
split_library = importlib.util.module_from_spec(spec)
spec.loader.exec_module(split_library)


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return json.load(fh)


def save(rel, data):
    with io.open(os.path.join(ROOT, rel), "w", encoding="utf-8", newline="\r\n") as fh:
        fh.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")


def place(node, anchor, entry, before, section=None):
    """Insert entry beside the first item whose ref is anchor. True if placed."""
    if section is not None:
        return any(place(s, anchor, entry, before) for s in node["sections"] if s.get("id") == section)
    if isinstance(node, dict):
        return any(place(v, anchor, entry, before) for v in node.values())
    if isinstance(node, list):
        for i, it in enumerate(node):
            if isinstance(it, dict) and it.get("ref") == anchor:
                node.insert(i if before else i + 1, entry)
                return True
        return any(place(v, anchor, entry, before) for v in node)
    return False


def main(path, dry):
    with open(path, encoding="utf-8") as fh:
        draft = json.load(fh)
    wine = draft["wine"]
    ref = split_library.ref_for(wine)
    if draft.get("ref") and draft["ref"] != ref:
        sys.exit("ref mismatch: draft says %s, the name gives %s" % (draft["ref"], ref))

    problems = []
    for key in ("note",):
        if key in wine:
            missing = [l for l in LANGS if not wine[key].get(l)]
            if missing:
                problems.append("note missing %s" % ", ".join(missing))
    prod = draft.get("producer")
    if prod:
        missing = [l for l in LANGS if not prod.get("blurb", {}).get(l)]
        if missing:
            problems.append("blurb missing %s" % ", ".join(missing))
    for l in draft.get("listings", []):
        if "anchor" in l:
            problems.append("a new listing never carries an anchor")
        if not (l.get("after") or l.get("before")) or l.get("price") is None:
            problems.append("each listing needs after|before and a price")
    if problems:
        sys.exit("draft not ready:\n  " + "\n  ".join(problems))

    lib = load("library/wines.json")
    if ref in lib["wines"]:
        sys.exit("already in the library: %s (edit it, or list the existing ref)" % ref)
    lst = load("lists/theatrium.json")
    producers = load("data/producers.json")
    if prod and prod["name"] in producers["producers"]:
        sys.exit("producer already has a blurb: %s — edit it instead" % prod["name"])

    lib["wines"][ref] = wine
    for l in draft.get("listings", []):
        entry = {"ref": ref, "price": l["price"]}
        if l.get("vol") is not None:
            entry["vol"] = l["vol"]
        if l.get("recommended"):
            entry["recommended"] = True
        if l.get("new", True):
            entry["new"] = True
        anchor = l.get("before") or l.get("after")
        if not place(lst, anchor, entry, bool(l.get("before")), l.get("section")):
            sys.exit("anchor ref not on the list: %s" % anchor)
        print("listed  %-60s %s €%s  %s %s" % (ref, l["price"], " %s l" % l["vol"] if l.get("vol") else "",
                                                "before" if l.get("before") else "after", anchor))
    if prod:
        producers["producers"][prod["name"]] = {"region": prod.get("region", ""), "blurb": prod["blurb"]}
        print("blurb   %s" % prod["name"])

    if dry:
        print("dry run — nothing written")
        return
    save("library/wines.json", lib)
    save("lists/theatrium.json", lst)
    if prod:
        save("data/producers.json", producers)
    print("written %s" % ref)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], "--dry-run" in sys.argv)

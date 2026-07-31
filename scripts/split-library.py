# -*- coding: utf-8 -*-
"""One-time migration: split data/wines.json into a reusable wine library and a
per-venue list.

    python scripts/split-library.py            # write library/ + lists/
    python scripts/split-library.py --check    # rebuild wines.json and diff it

What a wine *is* — grape, region, terroir, alcohol, aromas, pairings, notes in
eight languages, critic scores — is the same bottle in any restaurant, and is
where all the research went. What a venue *does* with it — price, which section
it sits in, the running order, the star, the NOVO badge — is not. Held in one
file, the second list has to be a copy, and the copy drifts.

The acceptance test is `--check`: rebuilding wines.json from the two halves must
reproduce the committed file byte for byte. Not "looks right" — identical.

Windows note: read and write with encoding='utf-8' explicitly (cp1252 default
mangles every Croatian diacritic), and keep the CRLF the data files use.
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# The pre-split list, frozen. `--check` proves the two halves still rebuild it
# exactly, which is the whole warrant for the migration. It stops matching the
# day the list legitimately changes — that is expected, and the day it does,
# this snapshot has done its job and the check is history rather than a gate.
WINES = ROOT / "data" / "source" / "wines-presplit.json"
LIBRARY = ROOT / "library" / "wines.json"
LIST = ROOT / "lists" / "theatrium.json"

# What the venue decides. Everything else on an item belongs to the bottle and
# moves to the library. `recommended` is Filho's pick *here*; `new` is new *here*.
VENUE_FIELDS = ("price", "recommended", "new")

# Croatian and the other Latin alphabets on the list, flattened for slugs.
# unicodedata strips the combining accents; đ/ð and ß have no decomposition.
EXTRA = {"đ": "d", "Đ": "d", "ß": "ss", "ø": "o", "æ": "ae", "œ": "oe", "ł": "l"}


def slug(text):
    text = "".join(EXTRA.get(ch, ch) for ch in text)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def ref_for(item):
    """`producer--wine`, or just the name for the things nobody makes (water)."""
    p, n = slug(item.get("producer", "")), slug(item["name"])
    return f"{p}--{n}" if p else n


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, obj):
    """Match the existing files exactly: one-space indent, real UTF-8, CRLF."""
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, indent=1) + "\n"
    # Path.write_text grew `newline` only in 3.10; this box runs 3.9.
    with open(path, "w", encoding="utf-8", newline="\r\n") as fh:
        fh.write(text)


def split(data):
    library, lst, clashes = {}, {"currency": data.get("currency", "EUR"), "sections": []}, []
    for sec in data["sections"]:
        out_sec = {k: v for k, v in sec.items() if k != "categories"}
        out_sec["categories"] = []
        for cat in sec["categories"]:
            out_cat = {k: v for k, v in cat.items() if k != "groups"}
            out_cat["groups"] = []
            for grp in cat["groups"]:
                out_grp = {k: v for k, v in grp.items() if k != "items"}
                out_grp["items"] = []
                for item in grp["items"]:
                    ref = ref_for(item)
                    facts = {k: v for k, v in item.items() if k not in VENUE_FIELDS}
                    if ref in library:
                        # The same wine poured by the glass and sold by the
                        # bottle: one entry, two prices. If the two copies ever
                        # disagreed, that is the drift this whole exercise is
                        # meant to end — so it is an error, not a merge.
                        if library[ref] != facts:
                            clashes.append(ref)
                    else:
                        library[ref] = facts
                    entry = {"ref": ref}
                    entry.update({k: item[k] for k in VENUE_FIELDS if k in item})
                    out_grp["items"].append(entry)
                out_cat["groups"].append(out_grp)
            out_sec["categories"].append(out_cat)
        lst["sections"].append(out_sec)
    return library, lst, clashes


def rebuild(library, lst):
    """The reverse: put the two halves back into the old shape, field order and
    all, so `--check` compares like with like."""
    data = {"currency": lst.get("currency", "EUR"), "sections": []}
    for sec in lst["sections"]:
        out_sec = {k: v for k, v in sec.items() if k != "categories"}
        out_sec["categories"] = []
        for cat in sec["categories"]:
            out_cat = {k: v for k, v in cat.items() if k != "groups"}
            out_cat["groups"] = []
            for grp in cat["groups"]:
                out_grp = {k: v for k, v in grp.items() if k != "items"}
                out_grp["items"] = []
                for entry in grp["items"]:
                    facts = library[entry["ref"]]
                    item, venue = {}, {k: v for k, v in entry.items() if k != "ref"}
                    # name, producer, then price, then the rest — the order the
                    # hand-written file has always used.
                    for k in ("name", "producer"):
                        if k in facts:
                            item[k] = facts[k]
                    if "price" in venue:
                        item["price"] = venue["price"]
                    for k, v in facts.items():
                        if k not in item:
                            item[k] = v
                    for k, v in venue.items():
                        if k != "price":
                            item[k] = v
                    out_grp["items"].append(item)
                out_cat["groups"].append(out_grp)
            out_sec["categories"].append(out_cat)
        data["sections"].append(out_sec)
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="rebuild wines.json from library/ + lists/ and diff it")
    args = ap.parse_args()

    if args.check:
        rebuilt = rebuild(read_json(LIBRARY)["wines"], read_json(LIST))
        original = read_json(WINES)
        if rebuilt == original:
            n = len(read_json(LIBRARY)["wines"])
            print(f"identical — {n} library wines rebuild data/wines.json exactly")
            return 0
        print("MISMATCH — the split loses or changes something:", file=sys.stderr)
        a = json.dumps(original, ensure_ascii=False, indent=1).splitlines()
        b = json.dumps(rebuilt, ensure_ascii=False, indent=1).splitlines()
        import difflib
        for line in list(difflib.unified_diff(a, b, "committed", "rebuilt", n=2))[:60]:
            print(line, file=sys.stderr)
        return 1

    data = read_json(WINES)
    library, lst, clashes = split(data)
    if clashes:
        print("Two copies of the same wine disagree — fix wines.json first:", file=sys.stderr)
        for ref in sorted(set(clashes)):
            print("  " + ref, file=sys.stderr)
        return 1
    items = sum(len(g["items"]) for s in lst["sections"] for c in s["categories"] for g in c["groups"])
    write_json(LIBRARY, {"wines": library})
    write_json(LIST, lst)
    print(f"{items} listings -> {len(library)} library wines "
          f"({items - len(library)} were duplicate copies)")
    print(f"  {LIBRARY.relative_to(ROOT)}  {LIBRARY.stat().st_size:,} bytes")
    print(f"  {LIST.relative_to(ROOT)}  {LIST.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Seed the anchor price ("sidrena cijena") onto every item of a venue's list.

From 01.10.2026 a Croatian price list must print, beside the price a guest
pays today, the regular price that applied on the reference day. For a
restaurant that day is **10.09.2026**, and the owner confirmed the list has
not moved since: every anchor is seeded from the price standing today.

This is a one-shot. It runs once per venue list and then never again, because
the whole point of the field is that it does *not* follow the price:

    "price":  48,      <- what the guest pays tonight; edit this freely
    "anchor": 45,      <- what it cost on 10.09.2026; never edit this

A wine added to the list after the reference day did not have a price on it,
so it gets no anchor and the card prints none. That is why the seeding is
deliberately not idempotent-by-default over new items — `--all` would happily
stamp today's price on a bottle that arrived last week and quietly claim it
was for sale in September.

It also writes the warrant: a frozen copy of the reference-day price list,
which `scripts/validate.mjs` diffs the data against on every deploy. Keyed by
shelf (glass / bottle / the section for spirits, rakija-beer, other) rather
than by category, so a wine reclassified from white to dessert keeps its
anchor. The warrant lives under data/source/, which the site never publishes:
the public artefact is the cjenik in /cjenik/, generated from the same data.

    python scripts/anchor-prices.py          # report what it would do
    python scripts/anchor-prices.py --write  # seed + write the warrant
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIST = ROOT / "lists" / "theatrium.json"
DATE = "2026-09-10"
WARRANT = ROOT / "data" / "source" / f"anchor-prices-{DATE}.json"


def shelf(section_id: str) -> str:
    """The shelf a listing sits on — what makes its price its own.

    The same wine is poured by the glass and sold by the bottle at two prices,
    so a ref alone is not a listing. But which *bottle* category it sits in is
    the venue's filing, not a price, so all of them collapse to "bottle".
    """
    if section_id == "glass":
        return "glass"
    return "bottle" if section_id.startswith("bottle-") else section_id


def items(list_data):
    for sec in list_data["sections"]:
        for cat in sec["categories"]:
            for grp in cat["groups"]:
                for item in grp["items"]:
                    yield sec, cat, grp, item


def key(sec, item):
    return "|".join([shelf(sec["id"]), item["ref"], str(item.get("vol") or "")])


def dump(path: Path, data) -> None:
    """Both JSON data files round-trip as one-space indent, CRLF, real UTF-8."""
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    path.write_bytes(text.replace("\n", "\r\n").encode("utf-8"))


def main() -> int:
    write = "--write" in sys.argv
    data = json.loads(LIST.read_text(encoding="utf-8"))

    seeded, already, unpriced = 0, 0, 0
    rows = []
    for sec, _cat, grp, item in items(data):
        if item.get("price") is None:
            unpriced += 1
            continue
        if "anchor" in item:
            already += 1
        else:
            seeded += 1
            # rebuild the dict so `anchor` sits directly under `price`
            rebuilt = {}
            for k, v in item.items():
                rebuilt[k] = v
                if k == "price":
                    rebuilt["anchor"] = v
            grp["items"][grp["items"].index(item)] = rebuilt
            item = rebuilt
        rows.append({"shelf": shelf(sec["id"]), "ref": item["ref"],
                     "vol": item.get("vol"), "price": item["anchor"]})

    dupes = len(rows) - len({(r["shelf"], r["ref"], r["vol"]) for r in rows})
    print(f"{len(rows)} priced listings — {seeded} seeded, {already} already carried an "
          f"anchor, {unpriced} have no price, {dupes} duplicate keys")
    if dupes:
        print("refusing to write a warrant with a duplicate key", file=sys.stderr)
        return 1

    if not write:
        print("dry run; pass --write")
        return 0

    dump(LIST, data)
    rows.sort(key=lambda r: (r["shelf"], r["ref"], str(r["vol"] or "")))
    dump(WARRANT, {
        "note": ("The regular prices in force on the reference day, frozen. "
                 "Croatian anchor-price rules, in force 01.10.2026. "
                 "Never edit: scripts/validate.mjs diffs lists/*.json against this."),
        "date": DATE, "currency": data.get("currency", "EUR"), "prices": rows,
    })
    print(f"wrote {LIST.relative_to(ROOT)} and {WARRANT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

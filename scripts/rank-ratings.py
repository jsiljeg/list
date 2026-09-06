# -*- coding: utf-8 -*-
"""Order every wine's ratings by how much the critic's opinion is worth.

Ratings used to be stored highest score first, which prints the loudest number
rather than the most authoritative one — a Suckling 97 above a Parker 95 tells
a guest the wrong thing. The order now comes from scripts/lib/critics.json: one
rank per critic, plus a promotion for a specialist inside their own region.

    python scripts/rank-ratings.py --check    # report, change nothing
    python scripts/rank-ratings.py            # rewrite library/wines.json

The table is shared with scripts/validate.mjs, which fails the deploy on a wine
left out of order — so this script is the only thing that decides the order and
there is nowhere for a second opinion to creep in.
"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, "library", "wines.json")
TABLE = os.path.join(ROOT, "scripts", "lib", "critics.json")


def load_table():
    with open(TABLE, encoding="utf-8") as fh:
        return json.load(fh)


def rank(critic, wine, table):
    """Where this critic's number belongs on this particular wine."""
    base = table["rank"].get(critic)
    if base is None:
        raise KeyError("%r is not in critics.json" % critic)
    where = table["specialists"].get(critic)
    if where:
        insight = wine.get("insight") or {}
        rungs = [r.strip() for r in (insight.get("region") or "").split(",")]
        rungs.append(insight.get("country") or "")
        if any(w in rungs for w in where):
            # Promoted: in front of every generalist, behind the three
            # global references, and still in rank order among themselves.
            return table["specialistRank"] + base / 100.0
    return float(base)


def main(check_only):
    table = load_table()
    with open(LIB, encoding="utf-8") as fh:
        data = json.load(fh)

    moved = []
    for ref, wine in data["wines"].items():
        ratings = wine.get("ratings")
        if not ratings:
            continue
        want = sorted(ratings, key=lambda r: rank(r["critic"], wine, table))
        if [r["critic"] for r in want] != [r["critic"] for r in ratings]:
            moved.append((ref, [r["critic"] for r in ratings],
                          [r["critic"] for r in want]))
            wine["ratings"] = want

    for ref, was, now in moved:
        print("%s\n    was  %s\n    now  %s" % (ref, " · ".join(was), " · ".join(now)))
    print("\n%d wines reordered" % len(moved))

    if not check_only and moved:
        text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
        with io.open(LIB, "w", encoding="utf-8", newline="\r\n") as fh:
            fh.write(text)
        print("written")


if __name__ == "__main__":
    main("--check" in sys.argv)

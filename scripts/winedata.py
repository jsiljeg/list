# -*- coding: utf-8 -*-
"""Reading the wine data from Python, after the library split.

The cellar tools used to open data/wines.json directly. That file is now two:
`library/wines.json` (what a wine is) and `lists/theatrium.json` (what this
venue charges for it). `load_list()` hands back the joined tree in exactly the
old shape, so a script that walks sections/categories/groups/items needs no
other change.

Windows: always encoding='utf-8' — the cp1252 default eats Croatian diacritics.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The venue decides these; everything else on an item comes from the library.
VENUE_FIELDS = ("price", "recommended", "new", "vol")


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return json.load(fh)


def load_library():
    """{ref: facts} — every wine we have researched, venue-independent."""
    return _read("library/wines.json")["wines"]


def load_list(rel="lists/theatrium.json"):
    """A venue's list with every ref resolved, in the pre-split shape."""
    wines = load_library()
    lst = _read(rel)
    for sec in lst["sections"]:
        for cat in sec["categories"]:
            for grp in cat["groups"]:
                items = []
                for entry in grp["items"]:
                    facts = wines.get(entry["ref"])
                    if facts is None:
                        raise KeyError(
                            "%s references %r, which is not in library/wines.json"
                            % (rel, entry["ref"]))
                    item = dict(facts)
                    item.update({k: v for k, v in entry.items() if k != "ref"})
                    items.append(item)
                grp["items"] = items
    return lst


def iter_items(lst=None):
    """Every listing, flat, with where it sits — the usual walk, written once."""
    lst = lst if lst is not None else load_list()
    for sec in lst["sections"]:
        for cat in sec["categories"]:
            for grp in cat["groups"]:
                for item in grp["items"]:
                    yield sec, cat, grp, item

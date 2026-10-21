# -*- coding: utf-8 -*-
"""Put one Dodaj vino card onto today's main when `git merge --squash` cannot.

    python3 .github/wine-intake/replay.py <ref> <branch>

Run in a clean checkout of main with <branch> fetched. Called by
publish-wine.yml only after the textual merge has conflicted.

Why it exists (2026-10-21, before Filho's first batch of 20+ bottles): every
card is written on a branch cut from main *at the time of its run*, and
add.py appends a new wine at the end of library/wines.json and a new house at
the end of data/producers.json. Two cards waiting on the preview at once
therefore both edit the same last lines, and the second "Objavi" conflicts —
for ever, since tapping it again re-runs the same merge. One wine at a time
never showed it.

So the card is re-applied as data, not as text: what the branch changed
against its own merge-base is computed per file and laid onto main.

- library/wines.json, data/producers.json: keys the branch added or changed.
  A wine main already has under the same ref is refused — the same bottle was
  sent twice and published first from the other card. A *house* main already
  has is kept as main has it: two bottles of one new estate both write its
  story, and the first one published wins.
- lists/theatrium.json: the branch's listings of <ref> that its base did not
  have, placed in the same section/category/group beside the same neighbour.
- data/unavailable.json: hide rules the branch added or removed.
- js/i18n.js, js/zh-terms.js: a three-way `git merge-file`, and --union when
  that conflicts. Both files are one entry per line with trailing commas, so
  two cards adding a term each keep both lines.

Files round-trip with json.dumps(ensure_ascii=False, indent=1) + "\\n", LF.
"""
import json
import subprocess
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

JSON_FILES = ["library/wines.json", "data/producers.json", "lists/theatrium.json", "data/unavailable.json"]
JS_FILES = ["js/i18n.js", "js/zh-terms.js"]


def git(*args, check=True):
    r = subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8")
    if check and r.returncode:
        sys.exit("git %s: %s" % (" ".join(args), r.stderr.strip()))
    return r


def show(rev, path):
    r = git("show", "%s:%s" % (rev, path), check=False)
    return r.stdout if r.returncode == 0 else None


def load(text):
    return json.loads(text.replace("\r\n", "\n"))


def dump(path, data):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")


def merge_map(name, base, branch, main, refuse_existing):
    """Keys added or changed on the branch, laid onto main."""
    for k, v in branch.items():
        if base.get(k) == v:
            continue
        if main.get(k) == v:
            continue
        if k not in base and k in main:
            if refuse_existing:
                sys.exit("%s: %s je već na karti (objavljeno s druge kartice)" % (name, k))
            print("keep    %s %s as main has it" % (name, k))
            continue
        if k in base and main.get(k) != base[k]:
            print("note    %s %s changed on main too; the card's version wins" % (name, k))
        main[k] = v
        print("set     %s %s" % (name, k))


def listings(doc, ref):
    """Each listing of ref with where it sits: (section, category, group key, prev ref, next ref, item)."""
    out = []
    for sec in doc["sections"]:
        for cat in sec["categories"]:
            for gi, g in enumerate(cat["groups"]):
                items = g["items"]
                for i, it in enumerate(items):
                    if it.get("ref") == ref:
                        prev = items[i - 1].get("ref") if i > 0 else None
                        nxt = items[i + 1].get("ref") if i + 1 < len(items) else None
                        out.append((sec["id"], cat.get("id"), g.get("country"), gi, prev, nxt, it))
    return out


def slot(it):
    return it.get("vol") or 0.75


def merge_list(ref, base, branch, main):
    have = {(s, c, slot(it)) for s, c, _, _, _, _, it in listings(base, ref)}
    mine = {(s, c, slot(it)) for s, c, _, _, _, _, it in listings(main, ref)}
    for s, c, country, gi, prev, nxt, it in listings(branch, ref):
        key = (s, c, slot(it))
        if key in have:
            continue
        if key in mine:
            sys.exit("lista: %s je već u %s/%s (objavljeno s druge kartice)" % (ref, s, c))
        sec = next((x for x in main["sections"] if x["id"] == s), None)
        cat = sec and next((x for x in sec["categories"] if x.get("id") == c), None)
        if not cat:
            sys.exit("lista: na karti više nema %s/%s" % (s, c))
        groups = [g for g in cat["groups"] if g.get("country") == country] or cat["groups"][gi:gi + 1]
        if not groups:
            sys.exit("lista: na karti više nema grupe %s u %s/%s" % (country, s, c))
        g = groups[0]
        refs = [x.get("ref") for x in g["items"]]
        if prev in refs:
            at = refs.index(prev) + 1
        elif nxt in refs:
            at = refs.index(nxt)
        else:
            at = len(refs)
        g["items"].insert(at, it)
        print("listed  %s in %s/%s at %d" % (ref, s, c, at))


def rule_key(r):
    return json.dumps(r, ensure_ascii=False, sort_keys=True)


def merge_hidden(base, branch, main):
    b = {rule_key(r) for r in base["hidden"]}
    n = {rule_key(r) for r in branch["hidden"]}
    gone, added = b - n, [r for r in branch["hidden"] if rule_key(r) not in b]
    main["hidden"] = [r for r in main["hidden"] if rule_key(r) not in gone]
    have = {rule_key(r) for r in main["hidden"]}
    main["hidden"] += [r for r in added if rule_key(r) not in have]


def merge_js(path, base_rev, branch):
    base, theirs = show(base_rev, path), show(branch, path)
    if base == theirs:
        return
    tmp = {}
    for name, text in (("base", base), ("theirs", theirs)):
        tmp[name] = "%s.%s" % (path, name)
        with open(tmp[name], "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text.replace("\r\n", "\n"))
    r = git("merge-file", path, tmp["base"], tmp["theirs"], check=False)
    if r.returncode:
        git("checkout", "--", path)
        git("merge-file", "--union", path, tmp["base"], tmp["theirs"])
        print("union   %s" % path)
    else:
        print("merged  %s" % path)
    for f in tmp.values():
        subprocess.run(["rm", "-f", f])


def main(ref, branch):
    base_rev = git("merge-base", "HEAD", branch).stdout.strip()
    docs = {}
    for p in JSON_FILES:
        b, n = show(base_rev, p), show(branch, p)
        if b is None or n is None or b == n:
            continue
        with open(p, encoding="utf-8") as fh:
            docs[p] = (load(b), load(n), load(fh.read()))
    if "library/wines.json" in docs:
        b, n, m = docs["library/wines.json"]
        merge_map("knjižnica", b["wines"], n["wines"], m["wines"], True)
    if "data/producers.json" in docs:
        b, n, m = docs["data/producers.json"]
        merge_map("vinarija", b["producers"], n["producers"], m["producers"], False)
    if "lists/theatrium.json" in docs:
        merge_list(ref, *docs["lists/theatrium.json"])
    if "data/unavailable.json" in docs:
        merge_hidden(*docs["data/unavailable.json"])
    for p, (_, _, m) in docs.items():
        dump(p, m)
    for p in JS_FILES:
        merge_js(p, base_rev, branch)
    git("add", *JSON_FILES, *JS_FILES)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

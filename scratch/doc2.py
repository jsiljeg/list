# -*- coding: utf-8 -*-
"""CLAUDE.md updates for the second 2026-08-02 round. One-shot."""

ADD = """## Copyright, and what is actually protectable (2026-08-02)

The repo is **public** - GitHub Pages on the free plan requires it - and every
data file is one request away: wines.json 458 kB, producers.json 258 kB,
i18n.js 118 kB. A complete copy takes about a second. There is no technical fix
for that; anything a browser renders, a scraper takes.

So the answer is a notice, not a wall. `LICENSE` is all-rights-reserved and
names what it covers (the data and its eight translations, the source, the
drawn artwork, the sculptures), and `ui.copyright` puts one line under the
footer in every language. Neither stops a copy; both turn "found it online"
into a documented one.

Worth being clear about what is and isn't the asset. The wine list itself
copies badly - a competitor gets wines they don't stock at prices they don't
charge against a menu they don't cook. What is genuinely reusable is the
*engine*: 226 aroma keys and 65 pairing keys in eight languages, the region
ladders, the glass research, the whole structure. That is what a licence is
for.

Do not "improve" this with obfuscation or a bundler. It buys minutes against a
copier and costs the no-build design that makes a price edit live in a minute.

"""

OLD_HELPER = """**It answers with a glass as well as a bottle.** It searched `bottle-*` only,
so it could offer nothing but a whole bottle - useless to the guest most likely
to ask (one person, one dish) and it ignored the shelf the owner curates
hardest: 28% of the by-the-glass pours are picks, against 9% of the bottles.
Two glasses then three bottles. The budget bands are bottle prices and are not
applied to the glasses. A wine offered by the glass is dropped from the bottle
list rather than repeating itself into one of three slots."""

NEW_HELPER = """**The second question is "a glass or a bottle?"** It used to be "budget for a
bottle?", which presumed a bottle before the guest had said they wanted one,
and it searched `bottle-*` only - so the helper could offer nothing else. That
made it useless to the guest most likely to ask (one person, one dish) and
ignored the shelf the owner curates hardest: 28% of the by-the-glass pours are
picks against 9% of the bottles. The first fix showed two glasses under every
band, which the owner rightly called out: a bottle budget says nothing about a
glass, so the same two wines repeated four times. Now:

    "Na casu"    -> four glass pours, no bottles
    a price band -> three bottles, then *one* glass underneath

The single glass under a bottle answer is a nudge, not a competing list. It
costs one line, keeps the cheapest way to say yes in front of every guest, and
comes last because a bottle is what was asked for. A wine offered by the glass
is dropped from the bottle list rather than repeating itself into one of three
slots. `any` was labelled "Bez ogranicenja" / "No limit" while filtering to
500 EUR and up - the opposite of what it did; it now says Ikone (500 EUR+),
which is both true and the name that shelf already has."""

OLD_SEARCH = "**How to find the next gap: type what a guest would type and count.**"

NEW_SEARCH = """**The flavour half is labelled on screen.** The owner asked whether aromas
belong in search at all, and the honest answer is that they do - but a guest
who typed "orange" and got 45 rows had no way to know the first twelve were the
answer and the rest merely smell of it. A divider (`ui.byFlavour`) between the
two halves is the whole fix, and it only appears when both halves have content,
so the common single-sense query stays clean.

The test for whether a field belongs in search at all: **does the word narrow
the list?** Body fails it (three values across 308 wines, so "puno" returns
276). Aroma passes (10-85 wines). Food passes, and it is the question a
restaurant guest actually has.

**How to find the next gap: type what a guest would type and count.**"""

REGION_ADD = """**Twelve cards, Croatia first.** California and Oregon joined (13 wines), and
the order is no longer arbitrary: Croatia leads - which is what the wine list
itself does inside every category, so the Regions screen should not invent a
different convention - then by how many wines we pour. Dalmatia, Northern
Croatia, Istria, Burgundy, Champagne, Bordeaux, Tuscany, Piedmont, Friuli,
Veneto, Germany, California.

**The maps are schematic and not to scale, on purpose** - a to-scale Burgundy
beside Bordeaux is an invisible sliver. What they must get right is relative
position and neighbours, and all twelve were checked against that: the communes
run in order down the Cote d'Or, the two banks are on the right sides of the
Gironde, the Adige separates the Valpolicella rather than crossing it, the
Carso sits east of the Isonzo, Sonoma is west of Napa with the Mayacamas
between them. Label geometry is now a test rather than an eyeball, in Croatian,
German and Chinese - localizing changes every label's width, so what fits in
one language can hang off the frame in another.

"""

p = 'CLAUDE.md'
s = open(p, 'rb').read().decode('utf-8')
nl = '\r\n' if '\r\n' in s else '\n'

anchor = "## Windows environment notes"
assert anchor in s
s = s.replace(anchor, ADD.replace('\n', nl) + anchor, 1)

assert OLD_HELPER.replace('\n', nl) in s, "helper block not found"
s = s.replace(OLD_HELPER.replace('\n', nl), NEW_HELPER.replace('\n', nl), 1)

assert OLD_SEARCH in s
s = s.replace(OLD_SEARCH, NEW_SEARCH.replace('\n', nl), 1)

anchor2 = "**Everything on the screen is localized, including inside the maps.**"
assert anchor2 in s
s = s.replace(anchor2, REGION_ADD.replace('\n', nl) + anchor2, 1)

open(p, 'wb').write(s.encode('utf-8'))
print("ok")

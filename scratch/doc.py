# -*- coding: utf-8 -*-
"""Append the 2026-08-02 sections to CLAUDE.md. One-shot."""

SEARCH = """## The search box answers in four blocks (2026-08-02)

Everything the card prints is now typeable, which for a *restaurant* list meant
one large gap: **aromas and food pairings were searchable nowhere**. Twenty of
twenty-two food words a guest might type - "janjetina", "tartufi", "kamenice",
"prsut", "biftek" - returned nothing, though every one was already translated
into eight languages two files away.

`itemHay()` therefore builds **two** strings, and `itemCore()` exposes the
first:

- **core** - what the wine *is*: name, producer, grape, region, terroir,
  country, style, sweetness, tags, critic names, plus SEARCH_ALIAS and
  STYLE_ALIAS.
- **flavour** - what it tastes like and goes with: aromas and pairings, in all
  eight languages, plus PAIRING_ALIAS.

Results come out in four blocks: wine-core, wine-flavour, other-core,
other-flavour. Wines before spirits is the owner's rule; identity before
flavour had to follow it, because the moment aromas became searchable "orange"
matched both the eleven orange wines and every wine with orange peel in its
nose, and the weaker sense buried the stronger.

**Body is deliberately excluded.** It went in with style and sweetness and was
measured back out the same day: "srednje puno" contains "puno", so a query of
"puno" returned 276 of 308 wines, and English "medium" begins with "med", so a
Croatian searching for honey got 130 wines that merely have a body. Every match
correct, every match useless. "Lagano" still works through the style string.

Three alias tables, each for a different failure:

- `SEARCH_ALIAS` - grape and place synonyms, applied to core only.
- `STYLE_ALIAS` - words for a *shelf* that the card strings don't contain,
  because those are written to be read, not typed ("amber", "skin contact",
  "pjenusac", "bijela vina").
- `PAIRING_ALIAS` - food words the stored phrasing misses. `hayMatch` anchors
  at a word start, so "jela s tartufima" answers "tartufi" by luck of Croatian
  morphology while "truffle dishes" does not answer "truffles".

**How to find the next gap: type what a guest would type and count.** That is
how all of the above was found - a battery of ~250 queries across grapes,
regions, colours, countries, foods, aromas, badges, producers and formats, with
every zero investigated. A zero is only a bug if we pour the thing: "viognier",
"priorat" and "vega sicilia" correctly return nothing.

"""

HELPER = """## The sommelier: what it scores, and what it can answer with (2026-08-02)

`dishScore()` is three points per pairing the wine and the dish share, three
for the style, one for being one of Filho's picks. That has not changed. Two
things around it did.

**It answers with a glass as well as a bottle.** It searched `bottle-*` only,
so it could offer nothing but a whole bottle - useless to the guest most likely
to ask (one person, one dish) and it ignored the shelf the owner curates
hardest: 28% of the by-the-glass pours are picks, against 9% of the bottles.
Two glasses then three bottles. The budget bands are bottle prices and are not
applied to the glasses. A wine offered by the glass is dropped from the bottle
list rather than repeating itself into one of three slots.

**The menu is validated.** `data/menu.json` speaks the pairing vocabulary and
was never checked, and it showed: the Tiramisu asked for a pairing called
`coffee`, which is in no dictionary and on no wine, so it silently scored zero
for as long as it existed. `validate.mjs` now fails the deploy on a dish key
that no wine carries, and *warns* on one carried by fewer than five wines -
which is not an error but does mean that dish falls back to matching on style
alone.

**Pairings are foods, not recipes.** Three bottles carried lists pasted from
their producer's own notes - `salmon_zucchini_tart`, `goat_cheese_veg_tiramisu`,
`scallops_basil_mustard`, `istrian_fuzi`, `green_tomato_sorbet`, `chicken_rice`
- each on exactly one wine, unreadable on the card and unmatchable by any dish.
Twenty such keys were merged into the shared vocabulary, and near-duplicates
with them (`chocolate` to `dark_chocolate`, `sushi_sashimi` to `sushi`,
`fish` to `white_fish`, `red_meat`/`dark_meat` to `beef`, `game_birds` to
`game`). Guarded by a test; `pasticada` and `smoked_fish` are the allowed
rarities, because one is on the kitchen's menu and the other is why we pour an
Islay.

**The dish data must match the plate.** Checked against the ingredient lists at
theatrium.hr/jelovnik: the oyster mushrooms were tagged on the veal, which has
none, instead of on the sirloin, which has them; the pasticada asked for `game`
when it is beef cheeks; the fish fillet did not mention its grilled asparagus;
the fritto misto asked for `grilled_fish` when it is deep-fried. Re-read the
menu page when the kitchen changes it - the pairings are only as good as the
ingredient list they were written from.

"""

REGIONS = """## Regions: eleven cards, localized to the last map label (2026-08-02)

Six cards covered 157 of 308 wines. Bordeaux had a card for 8 wines while
**Istria (21) and the German Riesling shelf (22) had none.** Five were added -
Istria, Germany, Veneto, Friuli, Northern Croatia - taking coverage to ~240.
The next two by size are the rest of Italy (14) and California (11).

**Everything on the screen is localized, including inside the maps.** The
appellation chips were printed raw, so the Chinese view read "Barolo,
Barbaresco, La Morra, Alba, Langhe"; they now go through `localizeRegion()`,
the same function as the region line on a wine card. The labels drawn inside
the map SVGs go through `localizeMap()`, which rewrites the text of
`.t-town`/`.t-dot`/`.t-zone` on the way out - the maps are hand-drawn with
their labels baked in, and a coordinate table per language would be a lot of
machinery for eleven pictures. Consequences to know:

- **Write place names in full in maps.js.** "Saint-Emilion", not "St-Emilion";
  the abbreviation is in no dictionary. Two names in one label are joined by
  " - " (a middle dot), which the localiser splits on.
- **Chinese gets the bare Chinese name inside a map**, not the
  bracketed-Latin form the chips and cards use. That form is right where there
  is room; at a hand-picked x/y it tripled the label width, ran one label
  through another and pushed Le Mesnil off the picture.
- **`MAP_FEATURES` holds the rivers, lakes and seas.** They are places on a map
  but not places wine comes from, so they have no business in `ZH_REGION`.
- **`appellations` holds appellations.** Grapes were in two of the new lists
  doing the work of a subtitle; they have no entry in `ZH_REGION` and came out
  as bare Latin.

Drawing one: viewBox `0 0 320 240`, classes `zone`/`river`/`coast`/`road`/
`town`/`dot`/`t-town`/`t-dot`/`t-zone`. Four things the first draft of all five
got wrong, found by rendering them and looking: a river must not run *through*
a zone it runs past (the Adige sliced the Valpolicella Classica in half, which
is precisely the boundary it forms); every zone label needs a zone under it
(Nahe and Friuli Isonzo were floating captions); a zone must sit inside the
coastline that contains it; and a label must not land on another zone.

**Kras is a rung, not a region** (owner, 2026-08-02). Vodopivec read
`region: "Kras"` - one rung where every other Italian wine has three, as if the
karst plateau were a region of Italy. It is the (bilingual, "Carso - Kras") DOC
above Trieste, inside Friuli: now `Sgonico, Kras, Friuli`, terroir
`Colludrozza`, the hamlet on the Origine label. Stored under the Slovene form
because the plateau runs across the border and `REGION_I18N` renders it per
language - English trade says Carso for the Italian side, which is the only
side we pour.

"""

p = 'CLAUDE.md'
s = open(p, 'rb').read().decode('utf-8')
nl = '\r\n' if '\r\n' in s else '\n'

for anchor, block in [("## Descriptor capitalisation (settled 2026-07-30)", SEARCH),
                      ("## Swipes are bound to the app, not the column (2026-07-30)", HELPER + REGIONS)]:
    assert anchor in s, anchor
    s = s.replace(anchor, block.replace('\n', nl) + anchor, 1)

open(p, 'wb').write(s.encode('utf-8'))
print("ok")

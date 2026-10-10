---
name: add-wine
description: Add a wine (or spirit) to the Theatrium list the house way — label-first identification, producer research, Parker check on the owner's subscription, region/terroir ladder, alcohol and serving temperature verified, glass and aromas matched to similar wines already on the list, food pairings, a Filho-voice note and winery story in all 8 languages, placement and price, then the knock-on checks on "Pomozi mi odabrati" and the daily offer. Also covers removing a wine and changing a price. Triggers on "add this wine", "dodaj vino", "new wine", "novo vino", "we got these bottles", a label photo with a price, "replace X with Y", "remove/zamijeni/makni vino", "price is now", "cijena je sada".
---

# Adding a wine to the Theatrium list

The list is live on the restaurant's tablets within a minute of a push, and
the owner reads every card. A new wine is finished when its card would pass
a sommelier standing at the table: right facts, right glass, right foods,
and a line worth saying out loud. CLAUDE.md is the authority on every rule
below — this is the order to apply them in, plus the tools.

Two helpers live beside this file:

    node   .claude/skills/add-wine/neighbours.mjs <ref | draft.json>
    python .claude/skills/add-wine/add.py draft.json [--dry-run]

## 0. Intake — what the owner gives, what to ask for

Usually a label photo and a price. Before any research, establish:

- **The exact bottle**: producer, name, vintage, size, as the **label** says
  (the label beats the owner's shorthand and the supplier's list —
  "Blanc de Blancs" was "Blanc de Chardonnay" on the bottle). If the house
  makes two bottlings under one name, the name must carry the distinguishing
  word (Grimalda *crna*/*plava*). Read the small print: alcohol, size and the
  producer's address are often on the front.
- **Price, and how it is sold**: bottle, glass, or both (one ref listed
  twice). A size other than 0,75 l is `vol` on the listing, never in the name.
- **Signed or not**: "recommended by Filho" → `note` renders as his quote
  (and `recommended: true` on the listing if it is one of his picks);
  otherwise `notePlain: true`. Ask if unclear.
- **What it replaces**, if anything — that wine goes to `data/unavailable.json`
  (an 86) unless the owner says it is gone for good.

Ask only for what research cannot settle (alcohol not legible, which
vintage is in the cellar). Do the rest without asking.

## 1. Research — sources in this order

1. The **producer's own technical sheet** for this wine: grapes and shares,
   vineyard, ageing, alcohol, sugar, serving temperature, their pairings.
2. A sheet or EU listing for **this exact vintage**. A neighbouring vintage
   is not a source for alcohol or sugar.
3. The estate's story (interviews, the producer's "about"), for the blurb.
4. Critics — **only those in `scripts/lib/critics.json`**. A score from
   anyone else is left off and mentioned to the owner, never added; adding a
   critic is a ranking decision.

### Parker — always check, the owner has a subscription

Use the owner's logged-in Chrome (load the `claude-in-chrome` tools in one
ToolSearch call; follow the chrome-browser skill). Search by URL:

    https://www.robertparker.com/search/wine?rating_computed=50+TO+100&sort=relevancy&keyword=<Producer>+<Wine>+<Vintage>

A vintage in the keyword sets the vintage filter. If neighbours flood the
results, tick the producer in the left rail and reuse the `producer=` URL
parameter. The list shows the **latest** review (a barrel range may since
have become one number). Then:

    python scripts/parker-add.py <ref> <score>     # found — records `checked` = today
    python scripts/parker-add.py <ref> none        # looked, none — never looked up again
    python scripts/rank-ratings.py                 # ratings are ordered by critic, never by hand

Non-vintage wines: a Parker score belongs to a release; take the latest
release with a printable score and record it in `release`. A score you could
not see on the site does not go on the card.

## 2. The card — field by field

Run `neighbours.mjs` on the draft **before** settling glass, temperature,
body, aromas and pairings. It lists the closest wines already poured (same
producer, then same style and leading grape, then same region) with the glass
the app actually draws for each, and flags every departure. A departure needs
a reason you could tell the owner.

- **name / producer** — label spelling, diacritics kept. Producer key
  matching is by longest substring (`producerInfo()`): a new producer whose
  name contains an existing key will show *that* winery's story — check.
- **region** — the appellation ladder, most specific first, **no country**:
  France `Pommard, Côte de Beaune, Bourgogne` (Champagne: bare `Champagne`);
  Italy `Negrar, Valpolicella Classica, Veneto`; Spain, Germany, USA,
  Slovenia, Croatia (`vinogorje, podregija`), China: see CLAUDE.md
  "Wine-data conventions". A spirit's region is where it is **distilled**.
- **terroir** — the named vineyard **only**, evidenced as a vineyard; `""`
  when the label names none. Never the estate's address. Cru rank stays in
  the name.
- **grape** — `Variety NN%, Variety NN%`, descending, name first. An unnamed
  remainder is `ostale sorte NN%` (translated in all 8 languages). Never a
  bare Malvasia/Muscat. One grape, one stored name (LANG_GRAPE renders it).
- **style / body / sweetness** — the shelf's vocabulary (18 styles). Body
  matches the neighbours unless the wine genuinely differs.
- **alcohol** — a string, `"13.5"`. Only from the label in the owner's hand
  (best), the producer's sheet for this vintage, or an EU listing for this
  vintage. Conflict or nothing → `""` and ask the owner to read the bottle.
  `rs` follows the same rule (string, en-dash ranges).
- **temp** — en dash, `"16–18"`. Default to what the neighbours use; the
  house standardises (Amarone 16–18 even where the producer says 18–20).
- **glass** — let `glassFor()` decide unless a sommelier reason says
  otherwise; then set `insight.glass` (an override beats widening the rule).
  Compare with the neighbours' glasses in the helper output.
- **aromas** — 4–6 keys, from the producer's tasting note, in the existing
  vocabulary (`js/i18n.js`, all 8 languages). Prefer keys the neighbours
  already use; a new key needs 8 translations.
- **pairings** — up to **5**, best first, through the **sommelier skill**
  (`pair.mjs --vocab`, the clash rules, `scripts/lib/pairing-rank.mjs` order;
  `validate.mjs` fails a wrong order). Foods, not recipes.
- **tags** — `drinking_now`, `rare` (tiny production), vintage tags only
  with a source.
- **ratings** — see Parker above; ranked by `rank-ratings.py`.
- **Chinese** — every new region rung and terroir needs a name in
  `js/zh-terms.js` (`ZH_REGION`), transliterated by Xinhua conventions if no
  established one exists. Grapes and producers stay Latin.

## 3. The words — note and winery story, 8 languages

Languages: hr, en, it, fr, de, zh, sl, es. Write Croatian first and best.

**The note** (per bottle) says what distinguishes *this* bottle. Two or
three sentences. **The blurb** (per estate, in `data/producers.json`) is
written once per house, about the house, never about one flagship — a guest
must not read about a wine we do not pour.

The voice (CLAUDE.md, "Producer blurbs" onward — read it before writing):

- **Open with the most appealing line.** Never a founding date, an address,
  a hectare count or a roll-call.
- **One story, one date.** A person, a decision that cost them something, a
  line that lands. A second date only as the payoff of the first. ~350–550
  Croatian characters; past ~600 means two stories.
- **Would a guest say it across the table?** Erudition only as setup for a
  payoff. Awards are badges, not stories.
- **Never repeat the grid** (grape, region, alcohol are already on the card)
  and never let the note and the blurb tell the same fact twice — or
  contradict each other on one screen.
- **Figures, not words**: `8 godina`, `2.000 boca`, `50%` (no space before %).
- Croatian spellings settled: Cabernet, sherry, Schwarzwald, Friuli (sl:
  Furlanija), prva preša, Tokaj never Tocai.
- **Cross-references** to other houses on the list are valuable, but write
  them as facts about the other house, not as claims about tonight's shelf
  ("Budinski makes his own wine, OMO", not "OMO is on this list") — the
  other wine may be 86'd tomorrow.
- A note signed by Filho is the owner's voice; when one exists, change the
  blurb to avoid overlap, not his line.

## 4. Write it

Put everything in one `draft.json` (format in `add.py`'s header), run
`add.py --dry-run`, then `add.py`. It derives the ref, places each listing
beside an existing ref (same section/category/group), sets `new: true`, and
never writes an `anchor`. Add the 86 rule for a replaced wine to
`data/unavailable.json` (`since` = today, `reason` optional). Edit
`js/zh-terms.js` / `js/i18n.js` by hand for new terms.

## 5. Check the knock-on — every time

    node scripts/validate.mjs                                   # must be OK
    node .claude/skills/add-wine/neighbours.mjs <ref>           # departures explained
    node .claude/skills/sommelier/pair.mjs --wine "<name>"      # which dishes it suits
    node scripts/after-86.mjs                                   # coverage + stale text

- **Pomozi mi odabrati**: for the dishes the wine suits, run
  `pair.mjs --dish "<dish>" --bands` and say whether it is a fixed
  suggestion or rotates in, in which band, and whether it displaced or
  replaced anything (compare with the wine it replaces, if any). If it
  appears nowhere it should, the tags are wrong, not the scoring.
- **Daily offer**: `curl -s https://theatrium.devinos.hr/api/dnevna-ponuda`.
  If today's offer is published, check each dish with
  `pair.mjs --foods <its pairings> --styles <its styles> --bands` and tell
  the owner if the new wine now belongs among the chef's picks — the chef
  chooses on `/kuhinja/`; never write the offer yourself.
- **Glass**: if it is poured by the glass, check the "Radije na čašu?" list
  for its dishes too.
- Optionally look at the card: `node scripts/shot.mjs` (Read the PNG).

## 6. Commit, push, report

One commit per addition, subject `<Producer>: <wine> joins NOVO` (or what it
replaces), body: sources for each fact, what was left blank and why, critics
found but not added, test status. Push to `main` (the owner wants it live).
Tests: add one only if a bug was fixed; do not run the suite unasked.

Report to the owner in plain words: what is on the card, where it sits on
the list, how it lands in "Pomozi mi odabrati" and the daily offer, and the
short list of what needs them (a label to read, a score behind a paywall, a
vintage to confirm).

## Removing a wine, or changing a price

- **Out for now** (most common): a rule in `data/unavailable.json`
  (`producer`, `name`, `since`; `where: "glass"|"bottle"` for one shelf
  only). Staff do this from `/admin` too. Never delete the library entry.
- **Gone for good**: remove its listing(s) from `lists/theatrium.json`; the
  library entry stays (an orphan is a note, not an error).
- **Price**: change `price` only. `anchor` is never edited.
- After either: `node scripts/after-86.mjs`, and fix any text that now
  points at a wine that is not there.

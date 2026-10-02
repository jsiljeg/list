# The house model

What the wine list actually computes, where it lives, and what the owner has
already decided. Source of truth is the code; this is the map. If the two
disagree, the code wins and this file is out of date — fix it.

## Where it lives

| Piece | File |
|---|---|
| Scoring, food-first, the sommelier helper | `js/app.js` — `dishScore()`, `renderHelperResults()` |
| Same model for the website & daily offer | `web/src/lib/pairing.mjs` (port — keep in step) |
| Build-time dish pages | `web/scripts/build-pairings.mjs` |
| Clash rules (fail the deploy) | `scripts/validate.mjs` — `PAIRING_RULES` |
| Best-food-first order | `scripts/lib/pairing-rank.mjs` — `STYLE_ORDER`, `GRAPE_FIRST` |
| Grape → classic foods reference | `scripts/lib/grape-foods.mjs` |
| The kitchen's dishes | `data/menu.json` — `name` ×8, `pairings`, `styles`, `off` |
| Food words, 8 languages | `js/i18n.js` → `pairings`; Croatian for the site: `web/src/lib/food.mjs` |
| The research behind it all | `scratch/pairing-research.md` (read before re-arguing a pairing) |

## Vocabulary

**A wine** carries `insight.style` (one of 18), `insight.pairings` (≤5 food
tags, best first), `insight.sweetness`, `insight.grape`.

**A dish** carries `pairings` (food tags) and `styles` (the wine styles the
kitchen would pour).

Styles: `sparkling`, `sparkling_rose`, `champagne`, `champagne_bdb`,
`champagne_bdn`, `champagne_rose`, `champagne_prestige`, `white_fresh`,
`white_aromatic`, `white_mineral`, `white_rich`, `orange`, `rose`,
`red_light`, `red_medium`, `red_full`, `red_mature`, `sweet`.

Food tags in use — run `pair.mjs --vocab` for the live list with counts. The
common ones: white_fish, cheese_hard, poultry, beef, veal, game, seafood,
mushrooms, charcuterie, oysters, truffles, risotto, white_meat, shellfish,
steak, aperitif, salads, vegetables, pasta, lamb, stews, light_starters,
foie_gras, asian, desserts, cheese_blue, caviar, solo, cheese_fresh,
fruit_desserts, bbq, pasticada, grilled_fish, prosciutto, sushi, asparagus,
spicy, pork, pizza, dark_chocolate.

## Scoring — `dishScore(dish, wine)`

    for each of the wine's pairings, in its stored order:
        if the dish has it:  + 4, 3, 2, then 1   (first food 4, second 3, third 2, rest 1)
    if the dish's styles include the wine's style:  + 3
    if the wine is one of Filho's picks (recommended):  + 1

The pairings are stored **best food first**, so the same array drives both
directions: the card prints it as stored (the first food a guest reads is the
wine's best), and a Dingač that exists for lamb outranks a Bordeaux that lists
lamb third.

## Food first

If any wine shares a food with the dish, **only those are offered** — never
padded to three with style-only wines. "I don't want a wine recommended for a
food that isn't in the wine's description" (owner). Style-only is a fallback
for when *nothing* shares a food, and it should be flagged.

## On the tablet (for context — the daily offer is chosen, not rolled)

- Budget bands: ≤60 €, 60–120 €, >120 €, and "Bez ograničenja" = the Ikone
  (500 €+). The wording and behaviour are the owner's; do not rename.
- Three bottles; the glass is offered on the row ("i na čašu 8 €") and via a
  "Radije na čašu?" flip. Frozen per dish × budget.
- Tie-break jitter of 4 points so comparable wines take turns. **Not** used for
  the daily offer: the chef chooses from a stable list.

## The five clash rules (a floor, not a house style)

1. A dry wine with a sweet dish — sugar in the food must never outrun the
   sugar in the glass. *Exception*: a Brut rosé sparkling with
   `fruit_desserts` (acid matches the fruit, red berries echo it).
2. A sweet wine with a savoury main — a clash of purpose.
3. A big red (`red_full`, `red_mature`) with oysters, caviar, raw/delicate
   fish — tannin plus iodine reads metallic.
4. A white or sparkling with red meat or game — no weight.
5. Dark chocolate on a dry sparkling — it strips the wine bare.

They are enforced on every wine's own tags at deploy. In the daily offer they
also remove style-only fallbacks that clash with the dish. They are **not**
applied dish-wide to a wine that shares a food: tartare is `beef` and
`light_starters`, and Champagne with tartare is a classic.

## Settled — do not re-litigate

- **Don't split a style because one source dislikes one wine in it.**
  `white_mineral` holds Chablis, Riesling and Grüner; the food tags do the
  finer work (Riesling carries `pork`/`asian`, Chablis `oysters`).
- **A fried dish must not ask for a rich white.** Breaded/fried wants acid:
  Wiener Schnitzel asks `white_fresh, white_mineral, red_light, sparkling`.
- **Whites with risotto are correct** — acidity balances the mantecatura.
- **Orange wine** goes to cured meat and hard cheese before anything delicate;
  it takes the wide Chardonnay glass.
- **A missing tag reads as a missing wine.** `veal` on 9 of 308 bottles meant
  Schnitzel under 60 € offered one. Fix tags, not weights.
- **Style weight stays 3.** Raising it was measured and bought nothing.
- **Pairings are foods, not recipes.**
- **Croatia leads**, in the list and in regional ordering.
- **A spirit is not paired by this model** (`insight.kind === "spirit"`).

## Thin shelves known (Aug 2026)

The Ikone band has almost nothing tagged for light dishes (correct — it is a
trophy shelf). The dessert shelf between 60 and 120 € is two wines.
`foie_gras` has one bottle under 60 €. `veal`, after the fix, fills.
`node scratch/underfilled.mjs` reports the current state with reasons.

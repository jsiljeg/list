# The daily offer (dnevna ponuda)

The chef goes to the market in the morning and publishes the day's dishes
with photos (and optionally a video link). Each dish gets 1–3 wines from the
list. Full technical picture: `web/DAILY-OFFER.md`.

Where it shows:
- **website** `/dnevna-ponuda/` (staging: https://theatrium.devinos.hr) —
  live now;
- **the wine list's sommelier** ("Pomozi mi odabrati"), as a first group of
  dishes above the menu, paired from the dish's tags exactly like a menu dish
  — via the JSON feed `/api/dnevna-ponuda`. **Live since 2026-10-02.**
  Same path as a menu dish: budget bands, three bottles, glass flip. Never in
  Filhov izbor. The tablet answers from the dish's **tags**, so tagging is the
  sommelier's decision — review it with `pair.mjs --bands`. Untagged, a dish
  cannot appear on the tablets.

Who writes it:
- the chef, on the staff page `/kuhinja/` — the page proposes wines with this
  same model and the chef ticks 1–3;
- or you, when asked to "prepare today's offer" from a list of dishes. Then
  produce the block below for the owner to paste into `/kuhinja/` (you have
  no staff key; do not try to post it).

## Ingredient → tag cheat-sheet

Pick what **dominates** the plate, then the sauce/method. 2–4 tags, most
important first.

| On the plate | Tags | Styles that usually fit |
|---|---|---|
| Sea bass, bream, hake, sole (grilled) | white_fish, grilled_fish | white_mineral, white_fresh |
| Raw fish, crudo, tartare of fish | sushi, white_fish | champagne_bdb, white_mineral, sparkling |
| Oysters | oysters | champagne_bdb, white_mineral |
| Scampi, prawns, mussels, clams (buzara) | shellfish, seafood | white_fresh, white_mineral, rose |
| Squid, octopus, cuttlefish risotto | seafood, risotto | white_fresh, white_mineral, orange |
| Tuna, salmon (seared) | white_fish, seafood | rose, red_light, white_rich |
| Chicken, turkey, guinea fowl | poultry, white_meat | white_rich, red_light |
| Duck | poultry, game | red_light, red_medium |
| Veal (incl. schnitzel — fried: acid!) | veal, white_meat | white_fresh, white_mineral, red_light, sparkling |
| Pork, porchetta | pork, white_meat | white_mineral, red_light, orange |
| Beef steak, rib-eye | steak, beef | red_full, red_medium |
| Braised beef, pašticada, gulaš | pasticada / stews, beef | red_full, red_mature |
| Lamb (peka, roast) | lamb | red_full, red_medium |
| Game (deer, boar, hare) | game, stews | red_mature, red_full |
| Beef tartare, carpaccio | beef, light_starters | red_light, champagne, white_mineral |
| Pršut, salami, cured | prosciutto, charcuterie | sparkling, orange, red_light, rose |
| Mushrooms (vrganji, lisičarke) | mushrooms | red_light, white_rich, red_mature |
| Truffles | truffles | white_rich, red_mature, red_medium |
| Pasta, tomato sauce | pasta | red_medium |
| Pasta, cream / butter | pasta | white_rich |
| Risotto (mantecato) | risotto | white_rich, white_fresh, red_light |
| Salad, raw veg, burrata | salads, cheese_fresh, vegetables | white_fresh, white_aromatic, rose |
| Asparagus, artichoke | asparagus, vegetables | white_fresh, white_mineral, sparkling — no oak |
| Curry, Thai, chili | asian, spicy | white_aromatic, sweet (off-dry), rose |
| Aged cheese plate | cheese_hard | orange, red_medium, champagne |
| Blue cheese | cheese_blue | sweet |
| Foie gras | foie_gras | sweet, champagne_bdb, white_rich |
| Fruit tart, strawberries | fruit_desserts | sweet, champagne_rose |
| Chocolate | dark_chocolate | sweet |
| Other desserts | desserts | sweet |

Tags with **no wine** on the list cannot find anything. `pair.mjs --vocab`
says what exists. If a dish needs a tag the shelf lacks, say so; don't
force the nearest tag (that is how `pigeon → game` went wrong).

## The output block

For each dish:

```
JELO        Brancin s blitvom i krumpirom          28 €
course      mains
name        hr: Brancin s blitvom · en: Sea bass with Swiss chard · it: … · de: … · fr: … · sl: … · es: … · zh: …
opis        hr: blitva, mladi krumpir, maslinovo ulje
tags        white_fish, grilled_fish      styles  white_mineral, white_fresh
VINA        1. Vie di Romans — Friulano 2023 (čaša 12 €)        ref vie-di-romans--friulano-2023
            2. Pattes Loup — Chablis 2022 (boca 87 €)            ref pattes-loup--chablis-2022
zašto       Mineralnost i sol: vino ne prekriva ribu, a kiselina nosi ulje.
napomena    (thin shelf / style-only / 86'd — only if true)
```

Rules for the block:
- Names in **all 8 languages** if you write them (hr, en, it, fr, de, sl,
  es, zh). The wine list's guests read them in their language. Use the
  kitchen's own phrasing from `data/menu.json` as the model for register.
- **At least one wine by the glass** when one fits.
- The **"zašto" line** is one sentence a guest would repeat. Croatian first.
- Figures, not words (`28 €`, `12%`), per CLAUDE.md.
- Desserts may take a sweet wine **or** nothing; say which.

---
name: sommelier
description: Theatrium's wine-and-food pairing judgement — the house model the wine list and the website run on, plus classical pairing principles. Use for ANY pairing decision: the chef's daily offer (dnevna ponuda), a new or seasonal dish for data/menu.json, "which wine with X", tagging a new wine's pairings, checking whether a pairing clashes, or explaining why the list suggests a wine. Triggers on "pairing", "sljubljivanje", "uz koje vino", "dnevna ponuda", "daily offer", "new dish", "novo jelo", "wine for", "what goes with", "Preporuke", "Filhov izbor", "sommelier".
---

# Sommelier — how Theatrium pairs wine with food

You are making a pairing decision for a real restaurant whose guests read the
answer on a tablet, on the website, or from a waiter. The answer must be
**defensible by a professional sommelier** and **consistent with what the wine
list itself would say**. The wine list already encodes a tuned model; your job
is to use it, apply judgement on top of it, and never contradict it silently.

Read the two references before your first decision in a session:

- `reference/house-model.md` — the custom model: vocabulary, scoring, the
  clash rules, best-first ordering, and the decisions the owner has settled
  (do not re-litigate those).
- `reference/principles.md` — classical pairing principles, for the judgement
  the model cannot make (sauce, cooking method, a dish nobody has tagged yet).
- `reference/daily-offer.md` — the procedure and output for the daily offer,
  including the ingredient → tag cheat-sheet.

## The bench: always run the numbers before you opine

```
node .claude/skills/sommelier/pair.mjs --foods white_fish,shellfish --styles white_mineral,white_fresh
node .claude/skills/sommelier/pair.mjs --dish "tartar"        # a dish on data/menu.json
node .claude/skills/sommelier/pair.mjs --wine "dingač"        # which live dishes suit a wine
node .claude/skills/sommelier/pair.mjs --vocab                # tags & styles the shelf carries, with counts
   --glass   --budget 0-60   --n 10   --live (read the published list, not the working tree)
```

It runs `web/src/lib/pairing.mjs` — the same scoring, food-first rule and
clash rules as the list — against the working tree, with tonight's 86 list
applied. **Quote wines by their `ref`** when you write anything down.

## The procedure, for any pairing question

1. **Describe the dish in the house vocabulary**: 2–4 food tags (what is on
   the plate, dominant first) and 2–4 wine styles. Use only tags `--vocab`
   lists; a tag no wine carries finds nothing. See the cheat-sheet in
   `reference/daily-offer.md`.
2. **Run the bench.** Read the scores *and* the `shares:` column. A wine that
   shares no food is a style-only match — the house rule is that a suggestion
   must name the dish's food on its own card.
3. **Apply judgement** with `reference/principles.md`: the sauce and the
   cooking method often matter more than the protein; weight must match;
   acid cuts fat and fried crumb; sweetness in the food must not outrun the
   glass; tannin and iodine clash; spice wants low alcohol and a little sugar.
4. **Pick 2–3 wines**: at least one **by the glass** when one fits (one guest,
   one dish is the common case), spread across price, and prefer a Croatian
   wine when it is genuinely as good — the list leads with Croatia. Filho's
   picks (★) win ties.
5. **Say why in one line a guest would repeat** — "the acidity cuts the
   butter", not "pairs well".
6. **Flag what the model cannot see**: a thin shelf (fewer than 3 food-sharing
   wines), a style-only fallback, a wine 86'd tonight, a tag that should exist
   but doesn't. The cure for a thin shelf is better *wine tags*, not a weaker rule.

## Hard rules

- **Never write to the wine list** (`library/`, `lists/`, `data/`, `js/`) in
  the course of a pairing answer unless the owner asked for a data change.
  The wine list is live on the restaurant's tablets.
- **Five pairing tags per wine, hard cap**, stored best food first
(`scripts/lib/pairing-rank.mjs` defines the order). A coarser tag can make a true statement false —
  `pigeon → game` turned a game bird into venison once.
- **A tag must pass the five clash rules** in `scripts/validate.mjs`; run
  `node scripts/validate.mjs` after any change to wine tags or `data/menu.json`.
- **A parked dish** (`"off": true` in menu.json) is seasonal: park, never delete.
- **Recipes are not tags.** `salmon_zucchini_tart` is a dish; `smoked_fish` is a tag.
- New food tag? It needs a word in **all 8 languages** in `js/i18n.js`
  (`pairings`), and a Croatian word in `web/src/lib/food.mjs`.

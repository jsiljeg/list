# Parked: the descriptor line in NOVO, Ikone, Filhov izbor, Najbolje ocijenjeni

Status: **parked by the owner on 2026-10-04** ("I want to take some time to
decide"). Nothing below is built. Pick it up only when the owner says so.

## Where things stand

- **Search is done and live** (2026-10-03, commit e667c27, merged 47ec4bf).
  `searchContext(item, sec, cat, g, t)` in `js/app.js` builds the line under a
  search hit:
  - still: `[Vina na čašu] · style · region, country`
  - sparkling: `[Vina na čašu] · type · body · dosage · region, country`
  - type = Blanc de Blancs / Blanc de Noirs (Champagne bdb/bdn), "Pjenušavi
    rosé" for any rosé (style or name — Selosse's Rosé is filed as prestige),
    else "Pjenušavo vino"; Champagne only ever the *place* (owner); body and
    dosage always (Brut included — owner asked why Deutz lacked it).
  - region = broadest rung, `Hrvatska Istra` shortened to Istra
    (`SEARCH_REGION_SHORT`); spirits = heading + country ("Gin · Škotska").
  - guarded by `tests/search-context.spec.mjs` (all listings × 8 languages).
- The owner's question that started this: the old search line read
  "Bijela vina · Bijela vina · Francuska" (tab and heading share a name).

## What the four other views print today (unchanged)

| View | Code (js/app.js) | Line today |
|---|---|---|
| NOVO (`__new`) | `ctx = [t.sections[sec.id], g.country…]` | "Bijela vina · Francuska", "Pjenušci i šampanjci" (sparkling: no country) |
| Ikone (`prideOnly`) | `itemHtml(r.item, r.ref, [t.sections[r.sec.id], r.country…])` | "Crna vina · Italija" |
| Najbolje ocijenjeni (`ratedOnly`) | same shape as Ikone | "Vina na čašu" (glass: no country) |
| Filhov izbor (`picksOnly`) | rows under `<h3 class="picks-group">` section headings; `ctx = g.country…` | country only; nothing at all for glass/sparkling |

No echo in these, but thin, and glass/sparkling rows carry no country.

## The proposal on the table (not yet agreed)

One rule: **wherever a wine appears outside its own tab, the line describes
the wine in the same words as search**; a heading that already says
something is not repeated.

- NOVO, Ikone, Najbolje ocijenjeni → exactly `searchContext(...)`.
- Filhov izbor → `searchContext(...)` minus the leading "Vina na čašu"
  (its group heading says it).
- Normal tabs → no line, unchanged.

Examples (hr): NOVO Chavost Paradoxe "Pjenušci i šampanjci" → "Pjenušavo
vino · srednje puno · Brut Nature · Champagne, Francuska"; Ikone Soldera
"Crna vina · Italija" → "Crno · puno · Toskana, Italija"; Najbolje Piuze
glass "Vina na čašu" → "Vina na čašu · Bijelo · mineralno · Burgundija,
Francuska"; Filhov izbor Bregh Rosé (glass) nothing → "Pjenušavi rosé ·
lagano · Brut · Zagorje-Međimurje, Hrvatska".

## Measured (2026-10-04, real fonts, every row)

The line *replaces* the current one, it is not added. Wrapping to a second
line:

| View | rows | tablet 1024 | phone 390 |
|---|---|---|---|
| NOVO | 10 | 0 | 2 |
| Ikone | 36 | 0 | 2 |
| Najbolje ocijenjeni | 157 | 0 | 16 |
| Filhov izbor | 35 | 0 | 6 |

Only sparkling lines wrap, only on a phone. (Measure against a one-word line's
height — `line-height` computes to "normal" and made the first measurement
report zero wraps.) Optional trim if the owner minds: drop the body word on
sparkling lines; recommended against, since body on sparkling was the owner's
own ask.

## Open questions for the owner

1. Apply the one rule to all four views, some, or none?
2. Filhov izbor: drop "Vina na čašu" under its heading (proposed), or keep
   the line identical everywhere?
3. Phone wrap on ~10% of sparkling rows: acceptable, or trim body there?

## If built

Four call sites in `renderContent()`; extend `search-context.spec.mjs` to the
views; screenshots tablet + phone, hr/en/zh. App change → tablets self-update
when idle (see CLAUDE.md, "Tablets update themselves").

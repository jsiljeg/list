# Wine data audit — grape / aromas / dosage / ABV

Bottle-by-bottle pass over all **308 wines** to verify grape varieties, adjust
aromas, add sparkling **dosage** (Brut / Extra Brut / Brut Nature / Sec /
Demi-Sec / Doux), and add **alcohol %**. Sits alongside the critic-scores work
in [wine-ratings-research.md](wine-ratings-research.md).

## Method (verify-first — same discipline as the ratings)

- **Never invent** an ABV, grape blend, or dosage. If it isn't on a reliable
  source (producer tech sheet, wine-searcher, established retailer) it stays
  blank and is marked **📷 needs bottle** for the owner to read off the label.
- Web-research fills the internationally-documented wines with a source; small
  Croatian/Dalmatian producers + by-the-glass pours are best read off the
  bottle by the owner.
- Data fields: `insight.grape` (free text, `Name NN%` blends OK — Chinese
  localizer strips the %), `insight.aromas` (descriptor keys, must resolve in
  `i18n`), `insight.dosage` (sparkling only, international term shown on the
  style line as "Pjenušavo vino · Brut"), `insight.alcohol` (number string,
  rendered as "NN % vol.").

## Legend

- ✅ filled & confident (multi-source or unambiguous)
- 🔎 filled from research — **owner verify** (single source / house-style / conflict)
- 📷 blank — **needs the bottle** (no reliable public data)

## Section progress

| Section | Wines | Status |
|---|---|---|
| bottle-sparkling | 43 | **first pass done** — dosage 38/43, ABV 20/43 (owner doing full manual check) |
| glass | 32 | not started |
| bottle-white | 104 | not started |
| bottle-rose | 2 | not started |
| bottle-red | 112 | not started |
| bottle-dessert | 15 | not started |

## Sparkling (43) — first research pass

| # | Producer — wine | Grape | Dosage | ABV | Notes |
|---|---|---|---|---|---|
| 1 | Jakopić — Terbotz | Furmint | Brut | 📷 | grape+brut from owner |
| 2 | Petrač — Bregh Rose | Cabernet Sauvignon | Brut 🔎 | 13% 🔎 | ⚠ sources say **Cab Sauvignon + Merlot** (you said Cab Sauv only) — verify; aromas per source strawberry/raspberry |
| 3 | Šember — Pavel | Chardonnay 90%, Plavec žuti 10% 🔎 | Brut | 12.5% | refined to 90/10 per source |
| 4 | Tomac — Diplomat | Chardonnay 80%, Plavec žuti 20% | Extra Brut 🔎 | 12.5% | ⚠ both Extra Brut & Brut Nature versions exist — verify bottle |
| 5 | Tomac — Blanc de Noirs | Pinot Noir | 📷 | 📷 | needs bottle |
| 6 | Tomac — Rose | Pinot Noir | 📷 | 📷 | needs bottle |
| 7 | Contarini — Prosecco Millesimato 2023 | Glera | 📷 | 11% 🔎 | ⚠ comes as Brut **or** Extra Dry (both 11%) — which do you carry? |
| 8 | Corte Aura — Franciacorta Brut | Chardonnay, Pinot Nero | Brut | 📷 | ABV needs bottle (~12.5–13) |
| 9 | Corte Aura — Franciacorta Satèn | Chardonnay | Brut | 📷 | ABV needs bottle |
| 10 | Movia — Puro Rose | Pinot Nero | Brut Nature | 📷 | zero-dosage |
| 11 | Movia — Puro Brut | Ribolla Gialla, Chardonnay | Brut Nature | 12.5% 🔎 | ⚠ sources vary on blend (Ribolla+Chard vs +Pinot Noir) — verify |
| 12 | De Sousa — Chemins des Terroirs | Chardonnay, Pinot Noir, Pinot Meunier | Brut | 📷 | blend 50/30/20 confirmed |
| 13 | De Sousa — Cuvée 3A Grand Cru | Chardonnay, Pinot Noir | Extra Brut 🔎 | 12.5% | |
| 14 | De Sousa — Mycorhize Grand Cru | Chardonnay | Extra Brut | 12.5% | |
| 15 | Pertois-Moriset — L'Assemblage Brut | Chardonnay, Pinot Noir | Brut | 📷 | |
| 16 | Pertois-Moriset — L'Année Millésime GC BdB 2017 | Chardonnay | Extra Brut 🔎 | 📷 | house style Extra Brut |
| 17 | Pertois-Moriset — La Collection Rosé & Blanc GC | Chardonnay, Pinot Noir | 📷 | 📷 | needs bottle |
| 18 | L'Hoste — L'Hoste Rosé | Pinot Noir, Chardonnay | 📷 | 📷 | needs bottle |
| 19 | Delamotte — Blanc de Blancs 2018 | Chardonnay | Brut | 12.5% | |
| 20 | Deutz — Brut Classic | Chardonnay, Pinot Noir, Pinot Meunier | Brut | 12% | |
| 21 | Egly-Ouriet — Grand Cru Brut Tradition | Pinot Noir, Chardonnay | Brut 🔎 | 12.5% | ⚠ recent releases relabelled "Extra Brut Grand Cru" — verify |
| 22 | Louis Roederer — Cristal 2015 | Pinot Noir, Chardonnay | Brut | 12.5% | 60/40 |
| 23 | Vouette & Sorbée — Textures Brut Nature | Pinot Blanc | Brut Nature | 12% | |
| 24 | Ruppert-Leroy — Martin Fontaine 2019 | Chardonnay | Brut Nature | 📷 | ABV ~12 |
| 25 | Ruppert-Leroy — Papillon | Pinot Noir | Brut Nature | 12% | |
| 26 | Billecart-Salmon — Le Réserve | Chardonnay, Pinot Noir, Pinot Meunier | Brut | 12.5% | 40 Meunier/30/30 |
| 27 | Billecart-Salmon — Blanc de Blancs Grand Cru | Chardonnay | Brut | 12% | |
| 28 | Billecart-Salmon — Le Rosé | Chardonnay, Pinot Noir, Pinot Meunier | Brut | 📷 | ABV needs bottle |
| 29 | Henri Giraud — Esprit Nature | Pinot Noir, Chardonnay | Brut Nature | 📷 | |
| 30 | Henri Giraud — Hommage au Pinot Noir | Pinot Noir | Brut | 📷 | |
| 31 | Jacques Selosse — Initial Brut | Chardonnay | Brut 🔎 | 📷 | dosage ~2.7 g/l; ABV not published |
| 32 | Jacques Selosse — Version Originale | Chardonnay | Extra Brut | 📷 | ~1.2 g/l |
| 33 | Jacques Selosse — Les Carelles | Chardonnay | Extra Brut | 📷 | 0–1.5 g/l |
| 34 | Jacques Selosse — Rosé Brut | Chardonnay, Pinot Noir | Brut 🔎 | 12.5% | |
| 35 | Moët & Chandon — Dom Pérignon 2015 | Chardonnay, Pinot Noir | Brut | 12.5% | 51/49 |
| 36 | Moët & Chandon — Dom Pérignon P2 2004 | Chardonnay, Pinot Noir | Brut | 12.5% | |
| 37 | Moët & Chandon — Dom Pérignon P3 1993 | Chardonnay, Pinot Noir | Brut | 📷 | ABV needs bottle |
| 38 | Salon — Blanc de Blancs 2013 | Chardonnay | Brut | 12.5% | |
| 39 | Krug — Krug 1996 | Pinot Noir, Chardonnay, Pinot Meunier | Brut | 📷 | |
| 40 | Krug — Grande Cuvée | Pinot Noir, Chardonnay, Pinot Meunier | Brut | 12.5% | ~44/34/22 |
| 41 | Krug — Krug 2004 | Pinot Noir, Chardonnay, Pinot Meunier | Brut | 📷 | 39/37/24 |
| 42 | Krug — Clos du Mesnil 2008 | Chardonnay | Brut | 📷 | |
| 43 | Krug — Clos d'Ambonnay 1996 | Pinot Noir | Brut | 📷 | |

### ⚠ Owner decisions for the manual sparkling pass

1. **Petrač Bregh Rosé** — you told me *Cabernet Sauvignon*; three retailers (Wine&More, Vivat) say *Cabernet Sauvignon + Merlot*, 13 %, 24 months on lees. Kept your value; confirm.
2. **Contarini Prosecco Millesimato** — the DOC Millesimato exists as **Brut** and **Extra Dry** (both 11 %). Tell me which one is on the list.
3. **Tomac Diplomat** dosage — both **Extra Brut** and **Brut Nature** bottlings exist; I set Extra Brut.
4. **Movia Puro Brut** blend — sources disagree (Ribolla+Chardonnay vs Ribolla+Pinot Noir). Left as-is.
5. **Egly-Ouriet** — recent releases are relabelled *Extra Brut Grand Cru* (formerly *Brut Tradition*); confirm which your bottle says.

### Still 📷 needs bottle (dosage and/or ABV)

Tomac Blanc de Noirs · Tomac Rose · Pertois La Collection Rosé · L'Hoste Rosé
(dosage+ABV); plus ABV only for the Champagnes marked 📷 above (mostly 12–12.5%,
easy to read off the label).

## Next sections

After the owner's sparkling manual pass: whites (104) then reds (112) — I'll
research the internationally-documented bottles for grape/ABV with sources,
owner supplies the small-producer numbers. Dessert (15) and by-the-glass (32)
last.

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

| # | Producer — wine | Grape | Dosage | ABV | Source | Notes |
|---|---|---|---|---|---|---|
| 1 | Jakopić — Terbotz | Furmint | Brut | 📷 | — | grape + Brut from owner |
| 2 | Petrač — Bregh Rose | Cabernet Sauvignon | Brut | 13% | [wineandmore](https://www.wineandmore.com/wines/petrac-bregh-rose/) | ⚠ source says Cab Sauv **+ Merlot**, 13%, brut, aromas strawberry/raspberry — verify |
| 3 | Šember — Pavel | Chardonnay 90%, Plavec žuti 10% | Brut | 12.5% | [vivino](https://www.vivino.com/US/en/sember-pavel-pjenusac-brut-plesivica/w/8009619) | refined to 90/10 per source |
| 4 | Tomac — Diplomat | Chardonnay 80%, Plavec žuti 20% | Extra Brut | 12.5% | [wineandmore](https://wineandmore.com/wines/tomac-diplomat/) | ⚠ Extra Brut **and** Brut Nature versions exist — verify bottle |
| 5 | Tomac — Blanc de Noirs | Pinot Noir | Brut Nature | 12.5% | owner | grape + Brut Nature + ABV from owner |
| 6 | Tomac — Rose | Pinot Noir | Brut | 12.5% | owner | from owner |
| 7 | Contarini — Prosecco Millesimato 2023 | Glera | Extra Dry | 11% | owner | Extra Dry per owner |
| 8 | Corte Aura — Franciacorta Brut | Chardonnay 90%, Pinot Noir 10% | Brut | 12.5% | owner | from owner |
| 9 | Corte Aura — Franciacorta Satèn | Chardonnay | Brut | 12.5% | owner | from owner |
| 10 | Movia — Puro Rose | Pinot Noir | Brut Nature | 12% | owner | zero-dosage; ABV from owner |
| 11 | Movia — Puro Brut | Chardonnay | Brut Nature | 12.5% | owner | grape corrected to Chardonnay (owner); zero-dosage |
| 12 | De Sousa — Chemins des Terroirs | Chardonnay 50%, Pinot Noir 30%, Pinot Meunier 20% | Brut | 12.5% | owner | region→Vallée de la Marne/Coteaux du Vitryat; JS 93 (owner) |
| 13 | De Sousa — Cuvée 3A Grand Cru | Chardonnay, Pinot Noir | Extra Brut | 12.5% | [premiumgrandscrus](https://www.premiumgrandscrus.com/en/extra-brut/229-de-sousa-cuvee-3a-champagne-grand-cru.html) | ratings JS 95 / WA 92 / Jancis 16+/20 (owner) |
| 14 | De Sousa — Mycorhize Grand Cru | Chardonnay | Extra Brut | 12.5% | [wine.com](https://www.wine.com/product/de-sousa-mycorhize-blanc-de-blancs-extra-brut-grand-cru/251495) |  |
| 15 | Pertois-Moriset — L'Assemblage Brut | Chardonnay, Pinot Noir | Brut | 12.5% | owner | Falstaff 89 (owner) |
| 16 | Pertois-Moriset — L'Année Millésime Grand Cru Blanc de Blancs 2017 | Chardonnay | Extra Brut | 12.5% | owner | house style Extra Brut; ABV + Côte des Blancs region from owner |
| 17 | Pertois-Moriset — La Collection Rosé & Blanc Grand Cru | Chardonnay 92%, Pinot Noir 8% | Brut Nature | 12% | owner | blend + dosage + ABV + Côte des Blancs/Bouzy region from owner |
| 18 | L'Hoste Père & Fils — L'Hoste Rosé | Chardonnay 90%, Pinot Noir 10% | Brut | 12% | owner | from owner |
| 19 | Delamotte — Blanc de Blancs 2018 | Chardonnay | Extra Brut | 12.5% | owner | Côte des Blancs villages; 10–12°C; WS 95 / JD 94 / RP 92 / JS 92 / Vinous 91 (owner) |
| 20 | Deutz — Brut Classic | Chardonnay, Pinot Noir, Pinot Meunier | Brut | 12% | owner | region 3 Champagne sub-zones; JS 93 / WE 92 / RP 90 (owner) |
| 21 | Egly-Ouriet — Grand Cru Brut Tradition | Pinot Noir 70%, Chardonnay 30% | Brut | 12.5% | owner | terroir Ambonnay/Verzenay/Bouzy; JD 94 / RP 93 / JS 93 (owner) — Brut confirmed |
| 22 | Louis Roederer — Cristal 2015 | Pinot Noir 60%, Chardonnay 40% | Brut | 12.5% | owner | terroir 7 GC villages; WE 98 / JS 97 / WS 96 / RP 95+ / Jancis 17.5+/20 (owner) |
| 23 | Vouette & Sorbée — Textures Brut Nature | Pinot Blanc | Brut Nature | 12% | owner | terroir Buxières-sur-Arce/Côte des Bar; 10–12°C; Robert Parker 93 (owner) |
| 24 | Ruppert-Leroy — Martin Fontaine 2019 | Chardonnay | Brut Nature | 📷 | — |  |
| 25 | Ruppert-Leroy — Papillon | Pinot Noir | Brut Nature | 12% | [glugulp](https://www.glugulp.com/ruppert-leroy-champagne-brut-nature-papillon-en) |  |
| 26 | Billecart-Salmon — Le Réserve | Chardonnay, Pinot Noir, Pinot Meunier | Brut | 12.5% | [whwc](https://whwc.com/billecart-salmon-brut-champagne-reserve-nv/) | 40 Meunier/30/30 |
| 27 | Billecart-Salmon — Blanc de Blancs Grand Cru | Chardonnay | Brut | 12% | [wine.com](https://www.wine.com/product/billecart-salmon-le-blanc-de-blancs-grand-cru/25061) |  |
| 28 | Billecart-Salmon — Le Rosé | Chardonnay, Pinot Noir, Pinot Meunier | Brut | 📷 | — | ABV needs bottle |
| 29 | Henri Giraud — Esprit Nature | Pinot Noir, Chardonnay | Brut Nature | 📷 | — | ABV needs bottle |
| 30 | Henri Giraud — Hommage au Pinot Noir | Pinot Noir | Brut | 📷 | — | ABV needs bottle |
| 31 | Jacques Selosse — Initial Brut | Chardonnay | Brut | 📷 | [wine.com](https://www.wine.com/product/jacques-selosse-initial-blanc-de-blancs-grand-cru-brut/657501) | ~2.7 g/l; ABV not published |
| 32 | Jacques Selosse — Version Originale | Chardonnay | Extra Brut | 📷 | [bordeauxindex](https://bordeauxindex.com/fine-wine/france/champagne/selo-1000) | ~1.2 g/l |
| 33 | Jacques Selosse — Les Carelles | Chardonnay | Extra Brut | 📷 | [cellartracker](https://www.cellartracker.com/wine.asp?iWine=2781223) | 0–1.5 g/l |
| 34 | Jacques Selosse — Rosé Brut | Chardonnay, Pinot Noir | Brut | 12.5% | [whwc](https://whwc.com/selosse-brut-rose-champagne-nv/) |  |
| 35 | Moët & Chandon — Dom Pérignon 2015 | Chardonnay, Pinot Noir | Brut | 12.5% | [wine.com](https://www.wine.com/product/dom-perignon-vintage-2015/2368723) | 51/49 |
| 36 | Moët & Chandon — Dom Pérignon P2 2004 | Chardonnay, Pinot Noir | Brut | 12.5% | [thefinestbubble](https://thefinestbubble.com/champagne-dom-perignon-vintage-2004-plenitude-2-p2-75cl) |  |
| 37 | Moët & Chandon — Dom Pérignon P3 1993 | Chardonnay, Pinot Noir | Brut | 📷 | — | ABV needs bottle |
| 38 | Salon — Salon Blanc de Blancs 2013 | Chardonnay | Brut | 12.5% | [whwc](https://whwc.com/salon-brut-blanc-de-blancs-champagne-le-mesnil-2013/) |  |
| 39 | Krug — Krug 1996 | Pinot Noir, Chardonnay, Pinot Meunier | Brut | 📷 | [wine-searcher](https://www.wine-searcher.com/find/krug+vintage+brut+champagne+france/1996) |  |
| 40 | Krug — Krug Grande Cuvée | Pinot Noir, Chardonnay, Pinot Meunier | Brut | 12.5% | [theliquorbarn](https://theliquorbarn.com/products/krug-grand-cuvee) | ~44/34/22 |
| 41 | Krug — Krug 2004 | Pinot Noir, Chardonnay, Pinot Meunier | Brut | 📷 | [krug.com](https://www.krug.com/en-us/champagne/krug-2004) | 39/37/24 |
| 42 | Krug — Clos du Mesnil 2008 | Chardonnay | Brut | 📷 | — |  |
| 43 | Krug — Clos d'Ambonnay 1996 | Pinot Noir | Brut | 📷 | [wine-searcher](https://www.wine-searcher.com/find/krug+clos+d+ambonnay+blanc+de+noir+brut+champagne+france/1996) |  |

### ⚠ Owner decisions for the manual sparkling pass

1. **Petrač Bregh Rosé** — you told me *Cabernet Sauvignon*; three retailers (Wine&More, Vivat) say *Cabernet Sauvignon + Merlot*, 13 %, 24 months on lees. Kept your value; confirm.
2. **Contarini Prosecco Millesimato** — the DOC Millesimato exists as **Brut** and **Extra Dry** (both 11 %). Tell me which one is on the list.
3. **Tomac Diplomat** dosage — both **Extra Brut** and **Brut Nature** bottlings exist; I set Extra Brut.
4. **Movia Puro Brut** blend — sources disagree (Ribolla+Chardonnay vs Ribolla+Pinot Noir). Left as-is.
5. **Egly-Ouriet** — recent releases are relabelled *Extra Brut Grand Cru* (formerly *Brut Tradition*); confirm which your bottle says.

### Still 📷 needs bottle (dosage and/or ABV)

Tomac Blanc de Noirs · Tomac Rose · L'Hoste Rosé
(dosage+ABV); plus ABV only for the Champagnes marked 📷 above (mostly 12–12.5%,
easy to read off the label).

## Next sections

After the owner's sparkling manual pass: whites (104) then reds (112) — I'll
research the internationally-documented bottles for grape/ABV with sources,
owner supplies the small-producer numbers. Dessert (15) and by-the-glass (32)
last.

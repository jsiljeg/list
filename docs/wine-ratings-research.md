# Wine critic ratings — research method & progress

Goal: give every wine on the list its genuine critic score(s) (James Suckling,
Vinous, Wine Advocate/Robert Parker, Wine Spectator, Decanter, Wine Enthusiast,
Falstaff, Jancis Robinson, etc.), each **backed by a verifiable source URL** so
the owner can confirm before it goes in front of guests.

## Method (agreed approach: verify-first)

1. Work through wines in batches (~15–20), most prestigious first (the wines that
   actually carry published scores: Bordeaux, Burgundy, Champagne, Barolo/
   Barbaresco, Super-Tuscans, cult Napa, top German sweet Rieslings).
2. For each wine, web-search for the **exact vintage + cuvée** score and record
   the candidate score(s) + the single best source URL (prefer the critic's own
   tasting-note page, e.g. jamessuckling.com/tasting-notes/…, vinous.com/wines/…,
   or the wine-searcher per-vintage page that aggregates critic scores).
3. **Do NOT** write scores into `data/wines.json` from web-search summaries alone.
   The search tool returns a *synthesized* summary that demonstrably conflates
   cuvées/vintages. Owner verifies each on the source, then only confirmed scores
   are added. **Confirmed by owner (2026-07): doc-first workflow — I gather
   candidates here, owner eyeballs sources, then I promote confirmed ones.**
4. Ratings live on the item as: `"ratings": [{ "critic": "...", "score": "97" }]`
   (already used for 14 wines). A trophy marker + score chips render from it.
   Critic labels in data are already consistent full names (James Suckling, Wine
   Advocate, Vinous, Wine Spectator, Decanter, Wine Enthusiast, Falstaff) — keep
   that spelling exactly when promoting.
5. For by-the-glass pours and small Croatian/Dalmatian producers with no published
   critic score: record "none found" — never invent a score.

## Confidence key

- **HIGH** — multiple independent sources agree on the exact cuvée+vintage, or the
  critic's own note page confirms it. Safe to promote after a quick owner glance.
- **MED** — one solid source; others fuzzy or a score *range* (barrel/en-primeur).
  Owner should confirm the in-bottle number.
- **FLAG** — cuvée/vintage conflation risk, or no clean published score. Do NOT
  promote without direct confirmation on the critic's site.

## Scope

- 297 distinct wines; 14 already rated (2026-07 snapshot) → **283 to research**.

## ⚠ Conflation traps found (must respect when promoting)

- **Rousseau "Lavaux" vs "Clos" Saint-Jacques** — our bottle is *Gevrey-Chambertin
  1er Cru **Lavaut** (Lavaux) Saint-Jacques* 2018. Web search kept returning the
  far more famous ***Clos** Saint-Jacques* (Neal Martin/Vinous 96–98). **Different
  vineyard, different score.** The Clos score must NOT be attached to our Lavaut
  wine — still need the Lavaut Saint-Jacques 2018 number.
- **Roagna "Vecchie Viti" vs regular** — Roagna bottles a standard *Pajé / Asili /
  Pira* AND a *Vecchie Viti* (old-vines) version, at different price/score. Our
  data: "Barbaresco Pajé 2019", "Barbaresco Asili 'Vecchie Viti' 2019", "Barolo
  Pira 2018". Match the exact cuvée before attaching a score.
- **Krug 1996 "Vintage" vs "Collection"** — robertparker.com result was for *Krug
  Brut **Collection** 1996* (a late-disgorged re-release), not the original
  *Vintage Brut 1996*. Keep them separate.
- **Quintarelli "Classico" vs "Riserva"** — several retailers tag the 2015 Amarone
  as "Classico Riserva"; the reviewed wine (Vinous/WA) is the *Classico*. Our
  bottle is the Classico. OK, but note it.

## Already rated (baseline, in data — 14)

Cristal 2015 (WE 98, JS 97); Dom Pérignon 2015 (JS 97); Erdoro Sauvignon Classy
2022 (Falstaff 92); Ch. Troplong Mondot 2020 (Decanter 100); Ch. Canon 2020
(Decanter 99); Léoville Barton 2021 (WA 95, JS 94); Tignanello 2019 (WS 96, JS 95,
Vinous 95); Dal Forno Amarone 2015 (JS 100, Vinous 98, WA 97); Sassicaia 2020
(JS 97, WA 96, Vinous 97); Ornellaia 2020 (JS 98, WA 97); Sassicaia 2021 (WA 100);
Solaia 2020 (JS 98, WS 97, WA 96); Ch. d'Yquem 2020 (JS 96); Ch. d'Yquem 2015
(JS 100, WA 100, WS 98).

## Batch 1 — researched (candidates to confirm)

| Wine (our exact bottle) | Candidate score(s) | Conf. | Best source |
|---|---|---|---|
| Salon "Le Mesnil" Blanc de Blancs 2013 | James Suckling 97 · Vinous 99 (Galloni) | HIGH | jamessuckling.com/tasting-notes/227752/salon-champagne-brut-blanc-de-blancs-2013 |
| Quintarelli Amarone Classico 2015 | Vinous 94 (Guido) · Wine Advocate 96 (Larner) | HIGH | vinous.com/wines/quintarelli-amarone-della-valpolicella-classico/2015 |
| Montevertine Le Pergole Torte 2020 | Vinous 97 (Galloni) · James Suckling 95 | MED (doc's earlier "Vinous 98" not confirmed — 97 seen) | wine-searcher.com/find/monte+vertine+le+pergole+torte+tuscany+igp+italy/2020 |
| Gaja Barbaresco 2020 | JS 95 · Wine Spectator 95 · Wine Advocate 94 (Larner) · Vinous 94 (Galloni) · Wine Enthusiast 94 · Falstaff 95 | HIGH | wine.com/product/gaja-barbaresco-2020/1083501 · falstaff.com/en/wines/gaja-2020-barbaresco-docg |
| Soldera Case Basse Sangiovese Toscana 2020 | No clean published number; Jeb Dunnuck 96–99 (range) · CellarTracker 95 avg | FLAG | cellartracker.com/wine.asp?iWine=5012138 |
| Krug Vintage Brut 1996 | Wine Spectator 97; WA mid-90s — mixed | FLAG (Vintage vs Collection) | wine-searcher.com/find/krug+vintage+brut+champagne+france/1996 |
| Krug Clos d'Ambonnay 1996 | not yet cleanly sourced | FLAG | wine-searcher.com/find/krug+clos+d+ambonnay+blanc+de+noir+brut+champagne+france/1996 |

## Batch 2 — researched (candidates to confirm)

| Wine (our exact bottle) | Candidate score(s) | Conf. | Best source |
|---|---|---|---|
| Marqués de Murrieta Castillo Ygay Gran Reserva Especial 2012 | James Suckling 100 · Wine Advocate 97 (Gutiérrez) | HIGH | jamessuckling.com/wine-tasting-reports/marques-de-murrieta-castillo-ygay-tasting-the-heyday-of-rioja |
| Ao Yun 2018 (Shangri-La) | James Suckling 98 · Wine Advocate 95 | HIGH | jamessuckling.com/wine-tasting-reports/chinas-best-wine-ever-ao-yun-shangri-la-2018-put-to-test |
| Poggio di Sotto Brunello di Montalcino 2019 | Wine Advocate 98+ (Larner) · Vinous 96 | HIGH | cellartracker.com/wine.asp?iWine=4583927 (see Winebow/Vinfolio round-up) |
| Isole e Olena Cepparello 2019 | James Suckling 97 · Wine Advocate 97 · (Decanter 94 · Vinous 91 · WS 91 — wide spread) | HIGH for JS/WA | jamessuckling.com/tasting-notes/189464/isole-e-olena-toscana-cepparello-2019 |
| Roagna Barbaresco Pajé 2019 | Vinous 96 | MED (regular vs Vecchie Viti) | vinous.com/wines/roagna-2019-barbaresco-paje |
| Roagna Barbaresco Asili "Vecchie Viti" 2019 | Vinous 96 · Wine Spectator (see detail) | MED | winespectator.com/wine/wine-detail/id/1317261 |
| Roagna Barolo Pira 2018 | Vinous 94+ (Galloni) | MED (Pira vs Pira Vecchie Viti) | winespectator.com/wine/wine-detail/id/1305223 |
| Conti Costanti Brunello di Montalcino 2018 | Vinous 94 (Guido) · Decanter (see review) | MED | decanter.com/wine-reviews/italy/tuscany/conti-costanti-brunello-di-montalcino-tuscany-italy-2018-65830 |
| Ridge Geyserville 2021 | Vinous 94+ · Wine & Spirits 95 · Jeb Dunnuck 93+ | MED (no clean JS/WA yet) | wine.com/product/ridge-geyserville-2021/1232813 |
| Dauvissat Chablis 1er Cru Vaillons 2018 | Wine Advocate 92 (Kelley) · JS 92–93 · Vinous 90–92 (ranges) | MED | cellartracker.com/wine.asp?iWine=3437458 |
| Rousseau Gevrey-Chambertin 1er Cru **Lavaut** Saint-Jacques 2018 | **NOT FOUND for Lavaut** (search returned Clos St-Jacques by mistake) | FLAG | needs Lavaut-specific note |
| Dr. Bürklin-Wolf Gaisböhl GG Riesling 2017 | no clean number surfaced (recent GGs 92–96 WA range) | FLAG | wine-searcher.com/find/dr+burklin+wolf+gaisbohl+g+c+riesling+ruppertsberg+pfalz+germany |

## Suggested next-to-promote (owner glance, then I add to data)

The HIGH-confidence rows above are ready once you've eyeballed a source:
Salon 2013 · Quintarelli Amarone 2015 · Gaja Barbaresco 2020 · Castillo Ygay 2012
· Ao Yun 2018 · Poggio di Sotto Brunello 2019 · Isole e Olena Cepparello 2019
(show JS 97 / WA 97 as the headline pair).

## Next batches to research

Champagne NV grower cuvées (Egly-Ouriet Tradition, Billecart Blanc de Blancs GC,
Pertois-Moriset, Delamotte) — harder, NV so scores are per-base; Prüm & Zilliken
Auslese (top German sweet — usually well scored); Bürklin Gaisböhl direct on WA;
Lignier Charmes-Chambertin 2021; Hubert Lamy Saint-Aubin 1ers 2023; Bernard-Bonin
Meursaults 2023; Benanti Etna Bianco; Radikon/orange (rarely point-scored — expect
"none"); López de Heredia Bosconia/Gravonia; Ridge Monte Bello/Estate Cab 2018.
Same format, same verify-first discipline.

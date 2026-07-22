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
   cuvées/vintages (e.g. Krug 1996 Vintage vs Collection vs Clos du Mesnil). Owner
   verifies each on the source, then only confirmed scores are added.
4. Ratings live on the item as: `"ratings": [{ "critic": "...", "score": "97" }]`
   (already used for ~14 wines). A trophy marker + score chips render from it.
5. For by-the-glass pours and small Croatian/Dalmatian producers with no published
   critic score: record "none found" — never invent a score.

## Scope

- 297 distinct wines; 14 already rated (2026-07 snapshot) → **283 to research**.

## Already rated (baseline, in data)

Cristal 2015 (WE 98, JS 97); Dom Pérignon 2015 (JS 97); Erdoro Sauvignon Classy
2022 (Falstaff 92); Ch. Troplong Mondot 2020 (Decanter 100); Ch. Canon 2020
(Decanter 99); Léoville Barton 2021 (WA 95, JS 94); Tignanello 2019 (WS 96, JS 95,
Vinous 95); Dal Forno Amarone 2015 (JS 100, Vinous 98, WA 97); Sassicaia 2020
(JS 97, WA 96, Vinous 97); Ornellaia 2020 (JS 98, WA 97); Sassicaia 2021 (WA 100);
Solaia 2020 (JS 98, WS 97, WA 96); Ch. d'Yquem 2020 (JS 96); Ch. d'Yquem 2015
(JS 100, WA 100, WS 98).

## Batch 1 — candidates to VERIFY (not yet added)

| Wine | Vintage | Candidate score(s) — verify | Source |
|---|---|---|---|
| Salon Cuvée S "Le Mesnil" BdB | 2013 | James Suckling 97; Vinous 99 | jamessuckling.com/tasting-notes/227752/salon-champagne-brut-blanc-de-blancs-2013 |
| Quintarelli Amarone Classico | 2015 | Vinous 94; Wine Advocate 96 | vinous.com/wines/quintarelli-amarone-della-valpolicella-classico/2015 |
| Montevertine Le Pergole Torte | 2020 | Vinous 98; James Suckling 97; Wine Advocate 96 | wine-searcher.com/find/monte+vertine+le+pergole+torte+tuscany+igp+italy/2020 |
| Gaja Barbaresco | 2020 | James Suckling 95; Vinous 94; Wine Advocate 94 (one source 96 — check) | wine.com/product/gaja-barbaresco-2020/1083501 |
| Soldera (Case Basse) Sangiovese Toscana | 2020 | Ian D'Agata 97; Jeb Dunnuck 96–99 (barrel) | wine-searcher.com/find/basse+di+gianfranco+soldera+brunello+montalcino+docg+tuscany+igp+italy/2020 |
| Krug Vintage Brut | 1996 | mixed (WA ~96, WS 97, JS high) — needs care | wine-searcher.com/find/krug+vintage+brut+champagne+france/1996 |
| Krug Clos d'Ambonnay BdN | 1996 | Vinous ~95; Wine Advocate 95+ | wine-searcher.com/find/krug+clos+d+ambonnay+blanc+de+noir+brut+champagne+france/1996 |

## Next

Continue batch-by-batch through the remaining premium wines (Raveneau, Rousseau,
Bernard-Bonin Meursaults, Roagna Barbarescos/Barolo, Dauvissat, Lignier, Ao Yun,
Poggio di Sotto, Castillo Ygay, Zilliken Auslese, etc.), same format. Owner to
confirm each batch, then confirmed scores get written to `data/wines.json`.

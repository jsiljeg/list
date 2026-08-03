# Pairing research, 2026-08-02

What the sources actually say, dish by dish and grape by grape, and what changed
in the data because of it. Kept so the next person can check the reasoning
rather than re-derive it.

## Dishes

**Wiener Schnitzel** — worldoffinewine.com/wine-food/wiener-schnitzel-best-wines-to-pair-with
Grüner Veltliner first ("the crisp, lively Grüner flattering the crunch and
richness of the fried coating"), then **dry** Alsace Pinot Gris (it names Albert
Mann Furstentum), Timorasso, Gavi, Soave Classico, Etna Bianco, young low-oak
Chardonnay and Chablis 1er Cru. Reds: Pinot Noir (not fruit-forward), Beaujolais
cru, Zweigelt, old-vine Cinsault.
**Avoid:** tannic reds, heavily fruity wines, and — explicitly — dry Riesling
("too assertively acidic").
→ Dish styles were `white_rich, red_light, sparkling`; `white_rich` is exactly
how our *off-dry* Albert Mann Hengst was scoring for a fried cutlet. Now
`white_fresh, white_mineral, red_light, sparkling`.

I first read the article's dislike of dry Riesling as evidence that
`white_mineral` was too coarse a bucket, since Chablis, Grüner and Riesling all
sit in it. **Withdrawn 2026-08-03**, the owner was right: all three genuinely
*are* mineral, the classification is correct, and the discrimination happens one
level down in the food tags — Riesling carries `pork` and `asian`, Chablis
`oysters` and `risotto`. Austria drinks Riesling with Schnitzel too. One
author's "too assertively acidic" is a preference, not a clash.

**Beef tartare** — tartare.org, winedeals, texasrealfood
"When in doubt with any tartare, quality Champagne rarely fails." Then Pinot
Noir, Beaujolais, dry Riesling, Sauvignon Blanc. Enough acidity to cut the fat.
→ added `white_mineral` to the dish.

**Artichokes** — thekitchn, bibendum-wine, Food & Wine (Giglio), matchingfoodandwine
Cynarin makes everything taste sweeter; wines "collapse into flabby,
one-dimensional blobs". The rule is bone dry, high acid, **no oak at all** —
Fino, Txakoli, dry Riesling, Pinot Grigio, Grüner, and zero-dosage/brut
sparkling. Frying and fat mitigate it.
→ dropped `orange` (skin tannin, often oxidative) and added `sparkling`.

**Foie gras** — fauchon, jjbuckley, altcellars, matchingfoodandwine
Sauternes classic; then Jurançon, Coteaux du Layon, late-harvest Alsace Pinot
Gris and Gewürztraminer, Tokaji. Also **mature rich Chardonnay**, dry Chenin,
dry Riesling, and Champagne — blanc de blancs specifically, whose "bubbles
refresh the palate between mouthfuls". Pinot Noir/Gamay for seared.
→ added `champagne_bdb`. Confirms Albert Mann Hengst's own `foie_gras` tag.

**Fritto misto** — decanter, carpineto, w3wineschool
Brut sparkling with **low dosage** first (Prosecco, Franciacorta, Trento);
otherwise Carricante/Etna, Albariño, Muscadet, Picpoul, Assyrtiko.
→ dish already correct, unchanged.

**Jamón ibérico / prosciutto** — cellartours, 7bellotas, ibericoclub
Fino and manzanilla are the classic (we pour none). Then Cava brut nature or dry
Champagne — with the caveat that very high acid **can clash** with top Spanish
ham — plus Albariño, Pinot Grigio, dry rosé, Lambrusco.
→ added `sparkling` and `rose`; kept `orange`, which the salt-and-skin-tannin
logic supports.

**Risotto mantecato** — vivino, grapeguru, wine-searcher
"An unoaked Chardonnay and a creamy Parmesan risotto just understand each
other." Sauvignon Blanc for the Parmesan sharpness; aged whites (white Rioja,
aged Chardonnay) for Parmesan-heavy versions; light high-acid reds for
mushroom/truffle. **Acidity is what balances the mantecatura** — the owner's
point, confirmed.
→ Beef risotto was `red_medium, red_full`; now `red_medium, white_rich,
white_fresh, red_light`.

**Tom Kha Gai** — kamalabeachestate, tastingtable, prbottleshop
Off-dry Riesling is the gold standard; Gewürztraminer for the galangal and
kaffir lime; Pinot Grigio for the coconut richness; **unoaked** Chardonnay only.
→ `white_aromatic, sweet, white_fresh, sparkling`.

**Chicken tikka masala** — thekitchencommunity, ladywine, winedeals
Off-dry Riesling and Gewürztraminer. High acid plus a touch of sweetness;
**low alcohol preferred**, since alcohol intensifies heat.
→ already fixed to `white_aromatic, sweet, rose`.

**Goat cheese and beetroot** — matchingfoodandwine, vinepair, winefolly
Sancerre is "the gold standard of Sauvignon Blanc cheese pairings"; Provence
rosé, Albariño, Verdejo. Vinaigrette is the hazard.
→ dropped `orange`, added `white_mineral`.

**Asparagus and burrata** — decanter, happymuncher, iwfs
Grüner Veltliner and Sauvignon Blanc are the two that survive asparagus;
Albariño and Pinot Grigio beside them; slightly sweeter rosé picks up
strawberry. Sharp dressing flattens wine on contact.
→ reordered, aromatics first.

**Seared / grilled tuna** — drinkandpair, texasrealfood, avenuedesvins
Pinot Noir is the top choice — "the wine needs to handle both the cooked
meatiness of the outside and the delicate nature of the inside". Dry rosé,
Sauvignon Blanc, Grüner. **Avoid heavy tannin — metallic with fish.**
→ swapped `white_rich` for `white_aromatic`.

**Beef Wellington** — matchingfoodandwine, avenuedesvins, thereddoorsd
Bordeaux is the classic, right bank especially (Merlot "plush and earthy" with
the mushrooms); **Burgundy Pinot Noir is a chef's favourite when the Wellington
is medium-rare**, because of the duxelles.
→ added `red_medium`.

## Grapes

Compiled into `scripts/lib/grape-foods.mjs`. The ones that changed the data:

**Plavac mali** — total-croatia-news, wineandmore
Peka lamb is "the dish Plavac Mali was born alongside"; then grilled meat and
steak, **pašticada** ("pairs perfectly"), game, mature cheese, tomato stews.
→ `pasticada` added to nine Dalmatian Plavac; lamb promoted to first in the
ranking for the grape.

**Malvazija istarska** — croatia.hr, thetasteofcroatia, wineloverscroatia
Grilled sea bass, scampi, asparagus risotto, **white truffles** ("particularly
recommended"), pork tenderloin, chicken salads, pasta.
→ `truffles` is on the Malvazija ranking; the one candidate was already at the
five-tag cap.

**Teran** — croatia.hr: "an ideal match for richer sauces and meat specialities",
often served with truffle dishes.

**Burgundy, red and white** — the veal gap. `veal` was on 9 of 308 wines, which
is why Wiener Schnitzel under 60 € could offer exactly one bottle. Burgundy in
both colours and Grüner Veltliner are textbook veal wines.
→ `veal` added to 47 wines: Pinot Noir reds, Grüner, and white_rich Chardonnay.

## What it moved

    suggestions sharing no food with the dish   3.6%  ->  2.6%
    combinations that cannot fill three         20    ->  17   (12 of them the
                                                               500 EUR+ shelf)
    Wiener Schnitzel under 60 EUR               1     ->  3    wines
    Teletina at every band                      1-3   ->  3
    `veal` on the list                          9     ->  56 wines
    `pasticada`                                 2     ->  11
    by the glass: veal 0 -> 3, pasticada 0 -> 2, risotto 3 -> 4

## Residual sugar, 2026-08-03 — what was findable and what was not

The owner asked for RS on all 23 non-dry still wines. Researched under the same
rule as alcohol: producer sheet, or a listing quoting the analysis for that exact
wine *and vintage*. Result — **3 of 23**.

Found and stored:

    Château d'Yquem 2015          144 g/l    (source also gives 13.9% and pH 3.65,
                                              and the 13.9% matches what we already
                                              had — good corroboration)
    Château d'Yquem 2020          135 g/l    (pH 3.79, 75% Sémillon / 25% Sauvignon)
    Donnafugata Ben Ryé 2019      194 g/l    (donnafugata.it, the producer's own
                                              2019 product page)

Found but **not usable**, because the figure was for a different vintage of the
same wine — and the spread proves why that matters:

    Zilliken Rausch Kabinett      48.6 g/l in 2023 (zilliken-vdp.de, exact page)
                                  ~50 in 2024, 50 in 2020, 56.5 in 2012,
                                  59 in 2021, 60 in 2019.
                                  Ours is the 2025; no page published yet.
    Quintarelli Recioto           "2015 has 70 g/l, much lower than the 2011" —
                                  ours *is* the 2011, so this says only "more
                                  than 70".
    Ca' La Bionda Recioto         120–140 g/l quoted for the wine in general,
                                  not for 2015.

Searched and genuinely not published anywhere reachable: Joh. Jos. Prüm
(Kabinett and Auslese — Prüm famously publishes no analytics), Wittmann Aulerde
Auslese 2015, Heymann-Löwenstein Beerenauslese 2017, Zilliken Auslese Goldkapsel
2009, Zilliken Butterfly 2024, A. Clüsserath Trittenheimer Apotheke Kabinett
2024, Egon Müller Scharzhof 2023, Albert Mann Pinot Gris GC Hengst 2020, and all
five Croatian sweet wines (Clai Tasel, Jakopić izborna berba, Mrgudić Prošek,
both Niko Bura Prošek, Geržinić Muškat).

**The thing the research actually established**, which is worth more than the
three numbers: the reason a guest is surprised by an 8% Kabinett labelled
*slatko* is not a missing figure. At ~50 g/l it **is** sweet — over the EU's
45 g/l line — and it tastes off-dry only because it carries 8–9 g/l of acid.
Sweetness alone can never explain that; sweetness *against acidity* would, and
acidity is no better published than sugar. If this comes up again, the honest
instrument is a sentence in that wine's own `note`, not another number field.

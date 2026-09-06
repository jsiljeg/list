# Wines with no Parker score — swept, 2026-09-06

The mirror of docs/parker-verification.md, and it is **finished**. Every wine
on the list has been looked up: 108 carry a Parker score, 169 were searched and
have no Parker review at all, and 2 are open questions for the owner (below).

`scripts/lib/parker-none.json` holds the 169 zeros — a zero costs the same
lookup as a hit, so it is written down and never repeated.
`scripts/parker-queue.py` prints whatever is left; today it prints two.

## What the sweep found

**32 wines gained a Parker score they never had.** The full list is in the
commits of 2026-09-06; the ones that changed a card most:

        99   Ridge — Monte Bello 2018   (unresolved, see below)
        98   Roagna — Barbaresco Asili «Vecchie Viti» 2019
        97   Heymann-Löwenstein — Beerenauslese Schieferterrassen 2017
        96   Joh. Jos. Prüm — Wehlener Sonnenuhr Auslese 2023
       95+   Vodopivec — Solo 2018
       95+   Occidental — Occidental 2018
        95   Zilliken — Riesling Auslese Goldkapsel 2009  (owner supplied)
        94   Angelo Gaja — Barbaresco 2020
       93+   Château Gazin — Pomerol 2020

## Open — needs the owner

**Ridge Cabernet Sauvignon 2018.** Our record carries terroir Monte Bello.
Parker's 2018 **Monte Bello is 99**; his separate "Cabernet Sauvignon Estate"
line has no 2018 at all. Two different bottles, seven points apart, and the
name on our listing does not decide it. Which is in the cellar?

**Marjan Simčič Sauvignon Vert.** Our listing has no vintage. Parker reviews
the same wine as *Sauvignonasse* — the old name for Friulano — across 2011 to
2016, the last at 88. Nothing to match a bare name against. Same shape as the
Walter Scott problem: the fix is a vintage on the listing.

## What the 169 zeros are actually made of

Worth writing down, because it is the thing that makes the next sweep quick.

**Vintage, not obscurity, is the usual reason.** A producer with hundreds of
reviews still stops somewhere, and our shelf is newer than the stop: Jules
Desjourneys has 92 reviews and ends at 2020, which cleared all seven of ours in
one lookup; Rémi Jobard 145 and ends 2018, four cleared; Mikulski 132 and ends
2019. Bernhard Ott stops at 2022, Sepp Muster 2016, Pascal Cotat 2014, Dipoli
2014, Pattes Loup 2018, Chartron 2020, Bernard-Bonin 2018. **Read the vintage
facet first — it answers several wines for the price of one.**

**Thirteen producers are not in Parker at any vintage:** Philippe Chavy, Casa
Rojo, Ruppert-Leroy, Jean Bourdy, Théo Dancer, François Crochet, Corte Aura,
Moret-Nominé, Contarini, Movia, Meneghetti, Clai and Boškinac.

**Croatia is covered, but barely.** Parker has no Plavac Mali and no Malvazija
Istarska at all, and of our 34 Croatian and Slovenian producers exactly two are
indexed — Saints Hills (four wines, none of the vintages we pour) and the two
Simčičes, both of which stop before our bottles. Slovenia is reviewed by Mark
Squires, Croatia only glancingly. Do not assume it is empty, though: the Saints
Hills Dingač is there at 90.

## Traps, all of which cost a mistake before being written down

  - **A single confident result is not a match.** "Krug 2004" returns one wine
    and it is Charles Krug of Napa. Check the producer facet.
  - **A producer facet matches its exact stored name** — `producer=Wittmann`
    returns nothing where the facet says "Weingut Wittmann", and it returns
    nothing *silently*, which looks identical to a wine that was never reviewed.
  - **Parker's name for a wine is often not the label's.** Isole e Olena's
    Cabernet is "Collezione Privata"; Duemani's Cifra is "Cabernet Franc CiFRA";
    Billecart's current NV Blanc de Blancs is "Le Blanc de Blancs" and the older
    "Brut Blanc de Blancs" at 89 is a superseded cuvée.
  - **A truncated facet list is not evidence of absence.** Hubert Lamy's 2023
    name list showed no Santenay; the Santenay Clos des Gravières Rouge 2023 is
    there at 89. Search the distinctive word instead.
  - **Match on the fields, not the name, when the name is generic.** Our
    "Occidental 2018" is Parker's "Freestone-Occidental" — found through our own
    region field. Vie di Romans make exactly one Pinot Grigio, Dessimis.


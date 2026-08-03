/* Theatrium — the spirits vocabulary and the glasses they are poured into.

   Why this is its own file rather than more keys in js/i18n.js: a spirit card
   answers different questions from a wine card. Nobody asks a rum what grape it
   is; they ask what it was made from, what still it came off, what wood it sat
   in and how long. Those four fields have no wine equivalent, and the eighty-odd
   keys behind them would have doubled i18n.js for a section that is a tenth of
   the list. Everything a spirit shares with a wine — the aroma and pairing
   vocabularies, the country names, the note — still comes from i18n.js; only
   what is genuinely spirit-only lives here, and `SPIRIT_I18N[lang].aromas` is
   read *before* `t.aromas`, so a key can be added here without touching the
   wine dictionaries.

   Adding a spirit: every key you put in library/wines.json — class, base,
   still, cask, serve, and any aroma or pairing not already in i18n.js — must
   exist here in all eight languages. scripts/validate.mjs fails the deploy
   otherwise, the same guard the wine vocabulary has had since the start. */
"use strict";

/* ---------- the glasses ----------
   Two of these are now measured from the restaurant's own glassware, and the
   rest are not. Know which is which before you touch them.

   MEASURED (2026-08-01, from the owner's photos): `nosing` is the Glencairn,
   `snifter` the 41 cl Napoleon balloon, `tulip` the grappa/rakija glass and
   `copa` the gin balloon. Both were drawn to the landmarks and
   then verified by overlaying the candidate path back on the photo — see the
   comments on each.

   NOT MEASURED: only the highball is still a standard vessel
   geometries drawn to plausible millimetres, because no photograph of the house
   versions exists. That is defensible where eyeballing a wine glass is not — a
   rocks glass is a cylinder and there is nothing in it to get wrong — but if
   photos arrive, run scripts/trace-outline.py over them and replace the paths.

   The measuring found the eyeballed pair wrong in the way the house rule
   predicts. Both drew the rim at roughly half the widest; the Glencairn's real
   rim is .69 of its belly (46 mm over 67 mm, published, and 455 px over 654 px
   off the photo — agreeing to 1%) and the snifter's is .68. A rim drawn at .50
   is not a nosing glass, it is a decanter.

   The one rule that is NOT eyeballed, because the first attempt got it wrong
   in every icon: **the viewBox aspect is the vessel's real aspect.** Every
   icon is normalised to one 60px height, so proportion is the only thing left
   to carry the shape, and it lives entirely in the viewBox width. That is
   already how the wine glasses work — a Riedel Veloce is 247mm tall and 92mm
   across, and its viewBox is 42x100. Drawn without that rule the highball came
   out 4:1 and read as a test tube, the rocks glass came out 2:1 and read as a
   short vase. The numbers used here, height x width in millimetres:

     copa de balón  (measured)  → viewBox 48
     Glencairn      115 x 67   → viewBox 56   (measured; published mm)
     snifter        (see below) → viewBox 68   (measured off the photo)
     grappa tulip   (measured)  → viewBox 36    (the narrowest thing on the list)

   Each glass is then drawn across the full 6-to-93 band of the box, so the
   width actually reaches the edges and the ratio survives to the screen. */
const SPIRIT_VESSELS = {
  /* The Glencairn, measured. Published dimensions carry the box — 115 mm tall,
     67 mm across the bulb, 46 mm at the rim and 46 mm across the foot — and the
     owner's photo supplies the vertical landmarks the maker does not publish:
     the belly sits 66.5% of the way down and the bowl meets the base at 78.5%.
     Photo and spec agree on the one ratio that matters (rim/widest .696 measured
     against .687 published), which is why both are trusted here.

     Two things the eyeballed version had wrong. The rim was drawn at half the
     belly rather than .69, which turned a nosing glass into a decanter. And it
     was given a stem and a foot: a Glencairn has neither. It stands on a solid
     squat pedestal, and that pedestal is most of what identifies it across a
     room. The photo is a lifestyle shot taken from slightly above, so the glass
     reads 1.89 tall for 1 wide against the published 1.72 — the box takes the
     published proportion and the photo is used only for the landmarks and the
     curve, which is the only thing it can honestly settle. */
  nosing: '<svg viewBox="0 0 56 100" aria-hidden="true"><path d="M10.1,6 C9.4,19 5.1,47 2.66,63.9 C3.5,70.2 9.4,73.3 16.57,74.3 L39.43,74.3 C46.6,73.3 52.5,70.2 53.34,63.9 C50.9,47 46.6,19 45.9,6"/><path d="M10.1,6 C10.1,3.9 45.9,3.9 45.9,6 C45.9,8.1 10.1,8.1 10.1,6 Z"/><path d="M16.57,74.3 C16,80 12.2,87 10.95,93 L45.05,93 C43.8,87 40,80 39.43,74.3"/></svg>',
  /* The 41 cl Napoleon balloon, traced off the owner's photo. Its aspect is its
     signature: 855 px across the belly for 1190 px of height, so the bowl is
     .72 as wide as the whole glass is tall, and the viewBox carries that
     exactly — the overlay check came out at the same scale on both axes, which
     is the sign the proportion is right rather than merely close. The belly
     sits high (40% down), the bowl folds into the stem at 71%, and the foot is
     a wide shallow cone, .82 of the belly. The eyeballed version had the rim at
     .48 of the widest; measured it is .68, and that difference is most of why
     the old drawing read as a brandy cartoon. */
  snifter: '<svg viewBox="0 0 68 100" aria-hidden="true"><path d="M12.7,6 C10.2,13 4.2,27 2.75,41.1 C3.4,55 13.5,64.5 29.83,67.8 L38.17,67.8 C54.5,64.5 64.6,55 65.25,41.1 C63.8,27 57.8,13 55.3,6"/><path d="M12.7,6 C12.7,3.9 55.3,3.9 55.3,6 C55.3,8.1 12.7,8.1 12.7,6 Z"/><path d="M34,67.8 V85.3"/><path d="M8.3,93 C14,88.5 54,88.5 59.7,93"/></svg>',
  /* The grappa and rakija glass, measured off the owner's photo. Its rim is the
     thing every eyeballed version gets wrong: it *flares*, and it flares wide —
     202 px against a 250 px belly, so .81, where the drawn one had .54. That
     outward lip is functional, not decoration; it throws the alcohol vapour
     clear of the nose, which is the whole reason a 45% spirit is served in this
     shape and not a shrunken wine glass. Two more measured facts the old
     drawing missed: there is a slight waist just under the rim before the belly
     swells, and the foot is *wider than the bowl* (310 px against 250), which
     is what makes it look planted rather than tippy at 60 px. The narrowest
     vessel on the shelf — a quarter as wide as it is tall. */
  tulip: '<svg viewBox="0 0 36 100" aria-hidden="true"><path d="M7.66,6 C8.4,9.5 8.48,11.8 8.48,13.7 C8,18.5 7.25,21.5 7.25,23.9 C6.3,28.5 5.31,31.5 5.31,34.1 C5.22,36.2 5.21,38 5.21,39.3 C5.4,43 8,46.5 15.2,47.4 L20.8,47.4 C28,46.5 30.6,43 30.79,39.3 C30.79,38 30.78,36.2 30.69,34.1 C30.7,31.5 29.7,28.5 28.75,23.9 C28.75,21.5 28,18.5 27.52,13.7 C27.52,11.8 27.6,9.5 28.34,6"/><path d="M7.66,6 C7.66,4.2 28.34,4.2 28.34,6 C28.34,7.8 7.66,7.8 7.66,6 Z"/><path d="M18,47.4 V86.3"/><path d="M2.14,93 C7,88 29,88 33.86,93"/></svg>',
  /* The copa de balón, measured off the owner's photo — the balloon a gin and
     tonic is actually served in here. Half as wide as it is tall, belly high
     (28% down) and a rim that stays wide, .80 of the widest: the bowl holds the
     ice and the volume, and the open top lets the botanicals off a long drink
     instead of trapping them the way a nosing glass would. It replaces the
     highball for both gins — a G&T in this house comes in a balloon, and the
     icon should say so. */
  copa: '<svg viewBox="0 0 48 100" aria-hidden="true"><path d="M6.6,6 C4.6,12 2.25,21 2.25,30 C2.3,40 9.5,48.5 20,50.8 L28,50.8 C38.5,48.5 45.7,40 45.75,30 C45.75,21 43.4,12 41.4,6"/><path d="M6.6,6 C6.6,4.2 41.4,4.2 41.4,6 C41.4,7.8 6.6,7.8 6.6,6 Z"/><path d="M24,50.8 V85.2"/><path d="M7.77,93 C13,88.5 35,88.5 40.23,93"/></svg>',
  /* The house beer glass, fitted through *every* measured row rather than four
     landmarks. Two hand-drawn cubics could not hold it — the upper wall bulged
     and the lower bowl cut inside the real glass — because one segment between
     two landmarks averages away everything in between. The outline is now a
     Catmull-Rom spline through seventeen sampled rows, which passes through
     each one instead of near it, and the shoulder the owner asked about
     survives: the half-width grows only 1 px over the first step below the rim
     before the wall bows out. Rim .75 of the belly, belly 37% down, foot narrow
     for its bowl. One uniform scale, 87 units over 425 px. */
  beer: '<svg viewBox="0 0 62 100" aria-hidden="true"><path d="M10.43,8.44 C10.36,9.04 10.19,10.86 10.02,12.09 C9.85,13.32 9.71,14.40 9.40,15.83 C9.10,17.27 8.62,19.06 8.18,20.70 C7.73,22.34 7.24,24.02 6.74,25.66 C6.25,27.30 5.67,28.90 5.21,30.53 C4.75,32.17 4.23,34.26 3.98,35.49 C3.72,36.73 3.65,36.90 3.67,37.93 C3.69,38.96 3.89,40.44 4.08,41.67 C4.27,42.90 4.42,43.90 4.80,45.32 C5.17,46.74 5.60,48.56 6.33,50.20 C7.07,51.83 8.21,53.72 9.20,55.15 C10.19,56.59 11.30,57.79 12.27,58.81 C13.24,59.82 13.87,60.43 15.03,61.24 C16.19,62.06 17.57,62.88 19.23,63.68 C20.88,64.48 23.80,65.35 24.96,66.03 C26.12,66.71 25.98,67.48 26.19,67.77 L35.81,67.77 C36.02,67.48 35.88,66.71 37.04,66.03 C38.20,65.35 41.12,64.48 42.77,63.68 C44.43,62.88 45.81,62.06 46.97,61.24 C48.13,60.43 48.76,59.82 49.73,58.81 C50.70,57.79 51.81,56.59 52.80,55.15 C53.79,53.72 54.93,51.83 55.67,50.20 C56.40,48.56 56.83,46.74 57.20,45.32 C57.58,43.90 57.73,42.90 57.92,41.67 C58.11,40.44 58.31,38.96 58.33,37.93 C58.35,36.90 58.28,36.73 58.02,35.49 C57.77,34.26 57.25,32.17 56.79,30.53 C56.33,28.90 55.75,27.30 55.26,25.66 C54.76,24.02 54.27,22.34 53.82,20.70 C53.38,19.06 52.90,17.27 52.60,15.83 C52.29,14.40 52.15,13.32 51.98,12.09 C51.81,10.86 51.64,9.04 51.57,8.44"/><path d="M10.43,8.44 C10.43,6.34 51.57,6.34 51.57,8.44 C51.57,10.54 10.43,10.54 10.43,8.44 Z"/><path d="M31.00,67.77 V84.73"/><path d="M16.47,93 C21.47,88.4 40.53,88.4 45.53,93"/></svg>',
};

/* Which vessel a bottle gets. `insight.vessel` in library/wines.json wins, the
   same way `insight.glass` overrides glassFor() for wines — the sommelier's
   call beats the rule, and there is always a bottle that wants a different
   glass from the rest of its category. */
const VESSEL_BY_CLASS = {
  vodka: "tulip",
  gin_london_dry: "copa", gin_contemporary: "copa",
  /* Owner, 2026-08-01: the vermouths go in the rakija glass, not a goblet. */
  vermouth_bianco: "tulip", vermouth_rosso: "tulip", vermouth_dry: "tulip",
  bitter_aperitivo: "tulip",   /* owner: the aperitivo bitter goes where the vermouths go */
  tequila_blanco: "tulip", mezcal_joven: "tulip",
  malt_islay: "nosing", malt_speyside: "nosing", malt_lowland: "nosing",
  malt_highland: "nosing", malt_island: "nosing", malt_taiwan: "nosing",
  malt_japan: "nosing", blended_malt_japan: "nosing", malt_american: "nosing",
  rye_american: "nosing",     /* the rye sits with the whiskies, not on the rocks */
  /* Owner, 2026-08-01: every rum goes in the cognac glass. That includes the
     clairin, which is Haitian rum however unaged it is, and the white blend,
     which the balloon flatters less than a highball would but which is poured
     from the same shelf by the same hand. One shelf, one glass. */
  rum_jamaican: "snifter", rum_barbados: "snifter", rum_white_blend: "snifter",
  clairin: "snifter", rum_cane_juice: "snifter", rum_japanese: "snifter",
  rum_australian: "snifter",
  cognac_grande_champagne: "snifter", cognac_fins_bois: "snifter",
  shochu_rice: "nosing",   /* owner, 2026-08-01: the shochu is nosed, not rocked */
  rakija_fruit: "tulip", rakija_grape: "tulip", rakija_herbal: "tulip",
  rakija_honey: "tulip",
  grappa_young: "tulip", grappa_aged: "tulip",
  liqueur_fruit: "tulip", liqueur_bitter: "tulip", liqueur_wormwood: "tulip",
  grappa: "tulip", liqueur_walnut: "tulip", liqueur_cherry: "tulip",
  liqueur_teranino: "tulip",
  pils: "beer"
};
function vesselFor(cls, override) {
  if (override && SPIRIT_VESSELS[override]) return override;
  return VESSEL_BY_CLASS[cls] || null;
}

const SPIRIT_I18N = {

hr: {
  ui: {
    base: "Sirovina", still: "Destilacija", cask: "Odležavanje", age: "Starost",
    serve: "Kako se pije", distillery: "O destileriji", brewery: "O pivovari", bottler: "Punjenje",
    years: "godina", noAge: "bez odležavanja"
  },
  classes: {
    vodka: "Votka · žitna, hladno filtrirana",
    gin_london_dry: "Gin · London Dry",
    gin_contemporary: "Gin · suvremeni stil",
    vermouth_bianco: "Vermut di Torino · bianco",
    vermouth_rosso: "Vermut di Torino · rosso",
    vermouth_dry: "Vermut di Torino · extra dry",
    bitter_aperitivo: "Bitter · aperitiv",
    tequila_blanco: "Tequila · blanco, neodležana",
    mezcal_joven: "Mezcal · joven, iz zemljane peći",
    malt_islay: "Single malt · Islay, dimljeni",
    malt_speyside: "Single malt · Speyside",
    malt_lowland: "Single malt · Lowland",
    malt_highland: "Single malt · Highland",
    malt_island: "Single malt · otoci",
    malt_taiwan: "Single malt · Tajvan",
    malt_japan: "Single malt · Japan",
    blended_malt_japan: "Blended malt · Japan",
    malt_american: "American single malt",
    rye_american: "Američki raženi viski",
    rum_jamaican: "Pure single rum · Jamajka, visoki esteri",
    rum_barbados: "Pure single rum · Barbados",
    rum_white_blend: "Bijeli rum · kupaža",
    clairin: "Clairin · haićanski rum od svježeg soka",
    rum_cane_juice: "Rum od svježeg soka trske",
    rum_japanese: "Japanski rum",
    rum_australian: "Australski rum",
    cognac_grande_champagne: "Cognac · Grande Champagne",
    cognac_fins_bois: "Cognac · Fins Bois",
    shochu_rice: "Shochu · od riže (kome-jochu)",
    rakija_fruit: "Voćna rakija",
    rakija_grape: "Rakija od grožđa",
    rakija_herbal: "Travarica",
    rakija_honey: "Medica",
    grappa_young: "Grappa · mlada, nedozrijevana",
    grappa_aged: "Grappa · odležana u drvu",
    liqueur_fruit: "Voćni liker",
    liqueur_bitter: "Biljni bitter liker",
    liqueur_wormwood: "Pelinkovac",
    grappa: "Grappa · od komine grožđa",
    liqueur_walnut: "Orahovac · liker od zelenih oraha",
    liqueur_cherry: "Višnjevac · liker od višanja",
    liqueur_teranino: "Teranino · liker od terana",
    pils: "Pilsner · svijetlo lager pivo"
  },
  bases: {
    grain_wheat_rye: "ozima pšenica i raž", grain_neutral: "žitni destilat",
    barley_malt: "ječmeni slad", barley_malt_peated: "ječmeni slad sušen tresetom",
    rye_grain: "raž", corn_grain: "kukuruz",
    agave_espadin: "agava espadín", agave_blue: "plava agava",
    molasses: "melasa šećerne trske", cane_juice: "svježi sok šećerne trske",
    cane_syrup: "sirup šećerne trske",
    grapes_wine: "vino", grape_pomace: "komina grožđa", grape_spirit: "rakija od grožđa",
    rice: "riža", ume: "japanske šljive ume",
    plums: "šljive", pears: "kruške williams", walnuts: "zeleni orasi",
    sour_cherries: "višnje", honey: "med",
    juniper_botanicals: "žitni destilat i borovica",
    barley_hops: "ječmeni slad i hmelj",
    teran_wine: "vino teran"
  },
  stills: {
    column: "kolona, kontinuirano", pot: "bakreni kotao (pot still)",
    double_retort_pot: "dvostruki kotao s retortama", pot_and_column: "kotao i kolona",
    alembic_charentais: "charentski alambik, dvokratno", atmospheric_pot: "kotao, na atmosferskom tlaku",
    vacuum_pot: "destilacija u vakuumu", maceration: "maceracija, bez ponovne destilacije"
  },
  casks: {
    unaged: "bez drva", ex_bourbon: "bačve od bourbona",
    ex_sherry_oloroso: "bačve od oloroso sherryja", ex_sherry_px: "bačve od PX sherryja",
    virgin_american_oak: "novi američki hrast", mizunara: "japanski hrast mizunara",
    french_oak: "francuski hrast", ex_port: "bačve od porta",
    slavonian_oak: "slavonski hrast", ex_wine: "bačve od vina",
    stainless_steel: "inox, bez drva", refill: "rabljene bačve",
    chestnut: "kesten", sakura: "japanska trešnja"
  },
  serves: {
    neat: "čisto, na sobnoj temperaturi", rocks: "s ledom",
    drop_of_water: "s kapi vode", chilled: "dobro ohlađeno",
    freezer: "iz zamrzivača", with_tonic: "s tonikom",
    in_cocktails: "u koktelima", after_dinner: "poslije jela",
    before_dinner: "prije jela", with_ice_and_orange: "s ledom i kriškom naranče"
  },
  aromas: {
    banana: "banana", overripe_banana: "prezrela banana", varnish: "lak",
    acetone: "aceton", brine: "salamura", olive: "maslina",
    burnt_sugar: "pregoreni šećer", toffee: "toffee", peat: "treset",
    campfire_smoke: "dim logorske vatre", malt: "slad", juniper: "borovica",
    coriander_seed: "sjeme korijandera", angelica: "anđelika", orris: "korijen perunike",
    lingonberry: "brusnica sjeverna", cubeb_pepper: "kubeba papar",
    roasted_agave: "pečena agava", green_chilli: "zelena čili paprika",
    wormwood: "pelin", gentian: "srčanik", rhubarb: "rabarbara",
    umeboshi: "umeboshi", koji: "koji", steamed_rice: "kuhana riža",
    sandalwood: "sandalovina", green_walnut: "zeleni orah",
    bitter_almond: "gorki badem", pine_needles: "borove iglice", hops: "hmelj"
  },
  pairings: { cigars: "cigare", smoked_fish: "dimljena riba" }
},

en: {
  ui: {
    base: "Made from", still: "Distillation", cask: "Maturation", age: "Age",
    serve: "How to drink it", distillery: "The distillery", brewery: "The brewery", bottler: "Bottling",
    years: "years", noAge: "no cask time"
  },
  classes: {
    vodka: "Vodka · grain, freeze-filtered",
    gin_london_dry: "Gin · London Dry",
    gin_contemporary: "Gin · contemporary style",
    vermouth_bianco: "Vermouth di Torino · bianco",
    vermouth_rosso: "Vermouth di Torino · rosso",
    vermouth_dry: "Vermouth di Torino · extra dry",
    bitter_aperitivo: "Bitter · aperitivo",
    tequila_blanco: "Tequila · blanco, unaged",
    mezcal_joven: "Mezcal · joven, earthen-pit roasted",
    malt_islay: "Single malt · Islay, peated",
    malt_speyside: "Single malt · Speyside",
    malt_lowland: "Single malt · Lowland",
    malt_highland: "Single malt · Highland",
    malt_island: "Single malt · the islands",
    malt_taiwan: "Single malt · Taiwan",
    malt_japan: "Single malt · Japan",
    blended_malt_japan: "Blended malt · Japan",
    malt_american: "American single malt",
    rye_american: "American rye whiskey",
    rum_jamaican: "Pure single rum · Jamaica, high ester",
    rum_barbados: "Pure single rum · Barbados",
    rum_white_blend: "White rum · a blend",
    clairin: "Clairin · Haitian cane-juice rum",
    rum_cane_juice: "Rum from fresh cane juice",
    rum_japanese: "Japanese rum",
    rum_australian: "Australian rum",
    cognac_grande_champagne: "Cognac · Grande Champagne",
    cognac_fins_bois: "Cognac · Fins Bois",
    shochu_rice: "Shochu · rice (kome-jochu)",
    rakija_fruit: "Fruit rakija",
    rakija_grape: "Grape rakija",
    rakija_herbal: "Travarica · herb-infused",
    rakija_honey: "Medica · honey rakija",
    grappa_young: "Grappa · young, unaged",
    grappa_aged: "Grappa · wood-aged",
    liqueur_fruit: "Fruit liqueur",
    liqueur_bitter: "Herbal bitter liqueur",
    liqueur_wormwood: "Pelinkovac · wormwood liqueur",
    grappa: "Grappa · from grape pomace",
    liqueur_walnut: "Walnut liqueur · green walnuts",
    liqueur_cherry: "Sour cherry liqueur",
    liqueur_teranino: "Teranino · Teran wine liqueur",
    pils: "Pilsner · pale lager"
  },
  bases: {
    grain_wheat_rye: "winter wheat and rye", grain_neutral: "neutral grain spirit",
    barley_malt: "malted barley", barley_malt_peated: "peat-dried malted barley",
    rye_grain: "rye", corn_grain: "corn",
    agave_espadin: "espadín agave", agave_blue: "blue agave",
    molasses: "sugar-cane molasses", cane_juice: "fresh sugar-cane juice",
    cane_syrup: "sugar-cane syrup",
    grapes_wine: "wine", grape_pomace: "grape pomace", grape_spirit: "grape spirit",
    rice: "rice", ume: "ume plums",
    plums: "plums", pears: "Williams pears", walnuts: "green walnuts",
    sour_cherries: "sour cherries", honey: "honey",
    juniper_botanicals: "grain spirit and juniper",
    barley_hops: "malted barley and hops",
    teran_wine: "Teran wine"
  },
  stills: {
    column: "column, continuous", pot: "copper pot still",
    double_retort_pot: "double-retort pot still", pot_and_column: "pot and column",
    alembic_charentais: "Charentais alembic, twice", atmospheric_pot: "pot still, atmospheric",
    vacuum_pot: "vacuum distillation", maceration: "maceration, not redistilled"
  },
  casks: {
    unaged: "no wood", ex_bourbon: "ex-bourbon barrels",
    ex_sherry_oloroso: "ex-oloroso sherry butts", ex_sherry_px: "ex-Pedro Ximénez butts",
    virgin_american_oak: "virgin American oak", mizunara: "Japanese mizunara oak",
    french_oak: "French oak", ex_port: "ex-port pipes",
    slavonian_oak: "Slavonian oak", ex_wine: "ex-wine casks",
    stainless_steel: "steel, no wood", refill: "refill casks",
    chestnut: "chestnut", sakura: "Japanese cherry wood"
  },
  serves: {
    neat: "neat, at room temperature", rocks: "over ice",
    drop_of_water: "with a drop of water", chilled: "well chilled",
    freezer: "from the freezer", with_tonic: "with tonic",
    in_cocktails: "in cocktails", after_dinner: "after dinner",
    before_dinner: "before dinner", with_ice_and_orange: "over ice with orange"
  },
  aromas: {
    banana: "banana", overripe_banana: "overripe banana", varnish: "varnish",
    acetone: "acetone", brine: "brine", olive: "olive",
    burnt_sugar: "burnt sugar", toffee: "toffee", peat: "peat",
    campfire_smoke: "campfire smoke", malt: "malt", juniper: "juniper",
    coriander_seed: "coriander seed", angelica: "angelica", orris: "orris root",
    lingonberry: "lingonberry", cubeb_pepper: "cubeb pepper",
    roasted_agave: "roasted agave", green_chilli: "green chilli",
    wormwood: "wormwood", gentian: "gentian", rhubarb: "rhubarb",
    umeboshi: "umeboshi", koji: "koji", steamed_rice: "steamed rice",
    sandalwood: "sandalwood", green_walnut: "green walnut",
    bitter_almond: "bitter almond", pine_needles: "pine needles", hops: "hops"
  },
  pairings: { cigars: "cigars", smoked_fish: "smoked fish" }
},

it: {
  ui: {
    base: "Materia prima", still: "Distillazione", cask: "Affinamento", age: "Età",
    serve: "Come si beve", distillery: "La distilleria", brewery: "Il birrificio", bottler: "Imbottigliamento",
    years: "anni", noAge: "senza legno"
  },
  classes: {
    vodka: "Vodka · di cereali, filtrata a freddo",
    gin_london_dry: "Gin · London Dry",
    gin_contemporary: "Gin · stile contemporaneo",
    vermouth_bianco: "Vermouth di Torino · bianco",
    vermouth_rosso: "Vermouth di Torino · rosso",
    vermouth_dry: "Vermouth di Torino · extra dry",
    bitter_aperitivo: "Bitter · aperitivo",
    tequila_blanco: "Tequila · blanco, non invecchiata",
    mezcal_joven: "Mezcal · joven, cotto in forno interrato",
    malt_islay: "Single malt · Islay, torbato",
    malt_speyside: "Single malt · Speyside",
    malt_lowland: "Single malt · Lowland",
    malt_highland: "Single malt · Highland",
    malt_island: "Single malt · le isole",
    malt_taiwan: "Single malt · Taiwan",
    malt_japan: "Single malt · Giappone",
    blended_malt_japan: "Blended malt · Giappone",
    malt_american: "American single malt",
    rye_american: "Whiskey americano di segale",
    rum_jamaican: "Pure single rum · Giamaica, alti esteri",
    rum_barbados: "Pure single rum · Barbados",
    rum_white_blend: "Rum bianco · blend",
    clairin: "Clairin · rum haitiano da succo fresco",
    rum_cane_juice: "Rum da succo fresco di canna",
    rum_japanese: "Rum giapponese",
    rum_australian: "Rum australiano",
    cognac_grande_champagne: "Cognac · Grande Champagne",
    cognac_fins_bois: "Cognac · Fins Bois",
    shochu_rice: "Shochu · di riso (kome-jochu)",
    rakija_fruit: "Acquavite di frutta",
    rakija_grape: "Acquavite d'uva",
    rakija_herbal: "Travarica · alle erbe",
    rakija_honey: "Medica · acquavite al miele",
    grappa_young: "Grappa · giovane",
    grappa_aged: "Grappa · invecchiata in legno",
    liqueur_fruit: "Liquore di frutta",
    liqueur_bitter: "Amaro alle erbe",
    liqueur_wormwood: "Pelinkovac · liquore all'assenzio",
    grappa: "Grappa · da vinacce",
    liqueur_walnut: "Liquore di noci verdi",
    liqueur_cherry: "Liquore di amarene",
    liqueur_teranino: "Teranino · liquore di vino Teran",
    pils: "Pilsner · lager chiara"
  },
  bases: {
    grain_wheat_rye: "grano invernale e segale", grain_neutral: "alcol di cereali",
    barley_malt: "orzo maltato", barley_malt_peated: "orzo maltato affumicato alla torba",
    rye_grain: "segale", corn_grain: "mais",
    agave_espadin: "agave espadín", agave_blue: "agave blu",
    molasses: "melassa di canna", cane_juice: "succo fresco di canna",
    cane_syrup: "sciroppo di canna",
    grapes_wine: "vino", grape_pomace: "vinacce", grape_spirit: "acquavite d'uva",
    rice: "riso", ume: "prugne ume",
    plums: "prugne", pears: "pere Williams", walnuts: "noci verdi",
    sour_cherries: "amarene", honey: "miele",
    juniper_botanicals: "alcol di cereali e ginepro",
    barley_hops: "orzo maltato e luppolo",
    teran_wine: "vino Teran"
  },
  stills: {
    column: "colonna, in continuo", pot: "alambicco discontinuo in rame",
    double_retort_pot: "alambicco a doppia retorta", pot_and_column: "alambicco e colonna",
    alembic_charentais: "alambicco charentais, doppia distillazione", atmospheric_pot: "alambicco a pressione atmosferica",
    vacuum_pot: "distillazione sottovuoto", maceration: "macerazione, senza ridistillazione"
  },
  casks: {
    unaged: "senza legno", ex_bourbon: "botti ex bourbon",
    ex_sherry_oloroso: "botti ex sherry oloroso", ex_sherry_px: "botti ex Pedro Ximénez",
    virgin_american_oak: "rovere americano nuovo", mizunara: "rovere giapponese mizunara",
    french_oak: "rovere francese", ex_port: "botti ex porto",
    slavonian_oak: "rovere di Slavonia", ex_wine: "botti ex vino",
    stainless_steel: "acciaio, senza legno", refill: "botti di secondo passaggio",
    chestnut: "castagno", sakura: "ciliegio giapponese"
  },
  serves: {
    neat: "liscio, a temperatura ambiente", rocks: "con ghiaccio",
    drop_of_water: "con una goccia d'acqua", chilled: "ben freddo",
    freezer: "dal congelatore", with_tonic: "con tonica",
    in_cocktails: "nei cocktail", after_dinner: "a fine pasto",
    before_dinner: "prima di cena", with_ice_and_orange: "con ghiaccio e arancia"
  },
  aromas: {
    banana: "banana", overripe_banana: "banana matura", varnish: "vernice",
    acetone: "acetone", brine: "salamoia", olive: "oliva",
    burnt_sugar: "zucchero bruciato", toffee: "toffee", peat: "torba",
    campfire_smoke: "fumo di legna", malt: "malto", juniper: "ginepro",
    coriander_seed: "semi di coriandolo", angelica: "angelica", orris: "radice di giaggiolo",
    lingonberry: "mirtillo rosso", cubeb_pepper: "pepe cubebe",
    roasted_agave: "agave arrostita", green_chilli: "peperoncino verde",
    wormwood: "assenzio", gentian: "genziana", rhubarb: "rabarbaro",
    umeboshi: "umeboshi", koji: "koji", steamed_rice: "riso cotto a vapore",
    sandalwood: "sandalo", green_walnut: "noce verde",
    bitter_almond: "mandorla amara", pine_needles: "aghi di pino", hops: "luppolo"
  },
  pairings: { cigars: "sigari", smoked_fish: "pesce affumicato" }
},

fr: {
  ui: {
    base: "Matière première", still: "Distillation", cask: "Vieillissement", age: "Âge",
    serve: "Comment le boire", distillery: "La distillerie", brewery: "La brasserie", bottler: "Embouteillage",
    years: "ans", noAge: "sans bois"
  },
  classes: {
    vodka: "Vodka · de céréales, filtrée à froid",
    gin_london_dry: "Gin · London Dry",
    gin_contemporary: "Gin · style contemporain",
    vermouth_bianco: "Vermouth di Torino · bianco",
    vermouth_rosso: "Vermouth di Torino · rosso",
    vermouth_dry: "Vermouth di Torino · extra dry",
    bitter_aperitivo: "Bitter · apéritif",
    tequila_blanco: "Tequila · blanco, sans élevage",
    mezcal_joven: "Mezcal · joven, cuit en four enterré",
    malt_islay: "Single malt · Islay, tourbé",
    malt_speyside: "Single malt · Speyside",
    malt_lowland: "Single malt · Lowland",
    malt_highland: "Single malt · Highland",
    malt_island: "Single malt · les îles",
    malt_taiwan: "Single malt · Taïwan",
    malt_japan: "Single malt · Japon",
    blended_malt_japan: "Blended malt · Japon",
    malt_american: "American single malt",
    rye_american: "Whiskey de seigle américain",
    rum_jamaican: "Pure single rum · Jamaïque, hauts esters",
    rum_barbados: "Pure single rum · Barbade",
    rum_white_blend: "Rhum blanc · assemblage",
    clairin: "Clairin · rhum haïtien de jus frais",
    rum_cane_juice: "Rhum de jus de canne frais",
    rum_japanese: "Rhum japonais",
    rum_australian: "Rhum australien",
    cognac_grande_champagne: "Cognac · Grande Champagne",
    cognac_fins_bois: "Cognac · Fins Bois",
    shochu_rice: "Shochu · de riz (kome-jochu)",
    rakija_fruit: "Eau-de-vie de fruits",
    rakija_grape: "Eau-de-vie de raisin",
    rakija_herbal: "Travarica · aux herbes",
    rakija_honey: "Medica · eau-de-vie au miel",
    grappa_young: "Grappa · jeune, sans bois",
    grappa_aged: "Grappa · élevée en fût",
    liqueur_fruit: "Liqueur de fruits",
    liqueur_bitter: "Amer aux plantes",
    liqueur_wormwood: "Pelinkovac · liqueur d'absinthe",
    grappa: "Grappa · de marc de raisin",
    liqueur_walnut: "Liqueur de noix vertes",
    liqueur_cherry: "Liqueur de griottes",
    liqueur_teranino: "Teranino · liqueur de vin Teran",
    pils: "Pilsner · lager blonde"
  },
  bases: {
    grain_wheat_rye: "blé d'hiver et seigle", grain_neutral: "alcool de céréales",
    barley_malt: "orge maltée", barley_malt_peated: "orge maltée séchée à la tourbe",
    rye_grain: "seigle", corn_grain: "maïs",
    agave_espadin: "agave espadín", agave_blue: "agave bleue",
    molasses: "mélasse de canne", cane_juice: "jus de canne frais",
    cane_syrup: "sirop de canne",
    grapes_wine: "vin", grape_pomace: "marc de raisin", grape_spirit: "eau-de-vie de raisin",
    rice: "riz", ume: "prunes ume",
    plums: "prunes", pears: "poires Williams", walnuts: "noix vertes",
    sour_cherries: "griottes", honey: "miel",
    juniper_botanicals: "alcool de grain et genièvre",
    barley_hops: "orge maltée et houblon",
    teran_wine: "vin Teran"
  },
  stills: {
    column: "colonne, en continu", pot: "alambic à repasse en cuivre",
    double_retort_pot: "alambic à double retorte", pot_and_column: "alambic et colonne",
    alembic_charentais: "alambic charentais, double chauffe", atmospheric_pot: "alambic à pression atmosphérique",
    vacuum_pot: "distillation sous vide", maceration: "macération, sans redistillation"
  },
  casks: {
    unaged: "sans bois", ex_bourbon: "fûts ex-bourbon",
    ex_sherry_oloroso: "fûts ex-oloroso", ex_sherry_px: "fûts ex-Pedro Ximénez",
    virgin_american_oak: "chêne américain neuf", mizunara: "chêne japonais mizunara",
    french_oak: "chêne français", ex_port: "fûts ex-porto",
    slavonian_oak: "chêne de Slavonie", ex_wine: "fûts ayant contenu du vin",
    stainless_steel: "inox, sans bois", refill: "fûts de deuxième remplissage",
    chestnut: "châtaignier", sakura: "cerisier japonais"
  },
  serves: {
    neat: "sec, à température ambiante", rocks: "sur glace",
    drop_of_water: "avec une goutte d'eau", chilled: "bien frais",
    freezer: "sorti du congélateur", with_tonic: "avec du tonic",
    in_cocktails: "en cocktail", after_dinner: "en digestif",
    before_dinner: "en apéritif", with_ice_and_orange: "sur glace avec une orange"
  },
  aromas: {
    banana: "banane", overripe_banana: "banane très mûre", varnish: "vernis",
    acetone: "acétone", brine: "saumure", olive: "olive",
    burnt_sugar: "sucre brûlé", toffee: "caramel au beurre", peat: "tourbe",
    campfire_smoke: "fumée de feu de bois", malt: "malt", juniper: "genièvre",
    coriander_seed: "graine de coriandre", angelica: "angélique", orris: "racine d'iris",
    lingonberry: "airelle rouge", cubeb_pepper: "poivre cubèbe",
    roasted_agave: "agave rôtie", green_chilli: "piment vert",
    wormwood: "absinthe", gentian: "gentiane", rhubarb: "rhubarbe",
    umeboshi: "umeboshi", koji: "koji", steamed_rice: "riz vapeur",
    sandalwood: "santal", green_walnut: "noix verte",
    bitter_almond: "amande amère", pine_needles: "aiguilles de pin", hops: "houblon"
  },
  pairings: { cigars: "cigares", smoked_fish: "poisson fumé" }
},

de: {
  ui: {
    base: "Ausgangsstoff", still: "Destillation", cask: "Reifung", age: "Alter",
    serve: "Wie man ihn trinkt", distillery: "Die Brennerei", brewery: "Die Brauerei", bottler: "Abfüllung",
    years: "Jahre", noAge: "ohne Holz"
  },
  classes: {
    vodka: "Wodka · aus Getreide, kaltfiltriert",
    gin_london_dry: "Gin · London Dry",
    gin_contemporary: "Gin · zeitgenössischer Stil",
    vermouth_bianco: "Wermut di Torino · bianco",
    vermouth_rosso: "Wermut di Torino · rosso",
    vermouth_dry: "Wermut di Torino · extra dry",
    bitter_aperitivo: "Bitter · Aperitivo",
    tequila_blanco: "Tequila · Blanco, ohne Fassreife",
    mezcal_joven: "Mezcal · Joven, in der Erdgrube geröstet",
    malt_islay: "Single Malt · Islay, getorft",
    malt_speyside: "Single Malt · Speyside",
    malt_lowland: "Single Malt · Lowland",
    malt_highland: "Single Malt · Highland",
    malt_island: "Single Malt · die Inseln",
    malt_taiwan: "Single Malt · Taiwan",
    malt_japan: "Single Malt · Japan",
    blended_malt_japan: "Blended Malt · Japan",
    malt_american: "American Single Malt",
    rye_american: "Amerikanischer Roggenwhiskey",
    rum_jamaican: "Pure Single Rum · Jamaika, hohe Ester",
    rum_barbados: "Pure Single Rum · Barbados",
    rum_white_blend: "Weisser Rum · Verschnitt",
    clairin: "Clairin · haitianischer Rum aus frischem Saft",
    rum_cane_juice: "Rum aus frischem Zuckerrohrsaft",
    rum_japanese: "Japanischer Rum",
    rum_australian: "Australischer Rum",
    cognac_grande_champagne: "Cognac · Grande Champagne",
    cognac_fins_bois: "Cognac · Fins Bois",
    shochu_rice: "Shochu · aus Reis (Kome-Jochu)",
    rakija_fruit: "Obstbrand",
    rakija_grape: "Traubenbrand",
    rakija_herbal: "Travarica · Kräuterbrand",
    rakija_honey: "Medica · Honigbrand",
    grappa_young: "Grappa · jung, ohne Holz",
    grappa_aged: "Grappa · im Holz gereift",
    liqueur_fruit: "Fruchtlikör",
    liqueur_bitter: "Kräuterbitter",
    liqueur_wormwood: "Pelinkovac · Wermutlikör",
    grappa: "Grappa · aus Traubentrester",
    liqueur_walnut: "Grüner-Walnuss-Likör",
    liqueur_cherry: "Sauerkirschlikör",
    liqueur_teranino: "Teranino · Likör aus Teran-Wein",
    pils: "Pilsner · helles Lagerbier"
  },
  bases: {
    grain_wheat_rye: "Winterweizen und Roggen", grain_neutral: "Getreidedestillat",
    barley_malt: "Gerstenmalz", barley_malt_peated: "über Torf gedarrtes Gerstenmalz",
    rye_grain: "Roggen", corn_grain: "Mais",
    agave_espadin: "Espadín-Agave", agave_blue: "blaue Agave",
    molasses: "Zuckerrohrmelasse", cane_juice: "frischer Zuckerrohrsaft",
    cane_syrup: "Zuckerrohrsirup",
    grapes_wine: "Wein", grape_pomace: "Traubentrester", grape_spirit: "Traubenbrand",
    rice: "Reis", ume: "Ume-Pflaumen",
    plums: "Zwetschgen", pears: "Williams-Birnen", walnuts: "grüne Walnüsse",
    sour_cherries: "Sauerkirschen", honey: "Honig",
    juniper_botanicals: "Getreidedestillat und Wacholder",
    barley_hops: "Gerstenmalz und Hopfen",
    teran_wine: "Teran-Wein"
  },
  stills: {
    column: "Kolonne, kontinuierlich", pot: "kupferne Pot Still",
    double_retort_pot: "Pot Still mit zwei Retorten", pot_and_column: "Pot Still und Kolonne",
    alembic_charentais: "Charentais-Alambic, zweifach", atmospheric_pot: "Pot Still, atmosphärisch",
    vacuum_pot: "Vakuumdestillation", maceration: "Mazeration, nicht nachdestilliert"
  },
  casks: {
    unaged: "ohne Holz", ex_bourbon: "Ex-Bourbon-Fässer",
    ex_sherry_oloroso: "Ex-Oloroso-Sherryfässer", ex_sherry_px: "Ex-Pedro-Ximénez-Fässer",
    virgin_american_oak: "neue amerikanische Eiche", mizunara: "japanische Mizunara-Eiche",
    french_oak: "französische Eiche", ex_port: "Ex-Portweinfässer",
    slavonian_oak: "slawonische Eiche", ex_wine: "Ex-Weinfässer",
    stainless_steel: "Stahl, ohne Holz", refill: "Zweitbelegungsfässer",
    chestnut: "Kastanie", sakura: "japanisches Kirschholz"
  },
  serves: {
    neat: "pur, bei Zimmertemperatur", rocks: "auf Eis",
    drop_of_water: "mit einem Tropfen Wasser", chilled: "gut gekühlt",
    freezer: "aus dem Gefrierfach", with_tonic: "mit Tonic",
    in_cocktails: "im Cocktail", after_dinner: "als Digestif",
    before_dinner: "als Aperitif", with_ice_and_orange: "auf Eis mit Orange"
  },
  aromas: {
    banana: "Banane", overripe_banana: "überreife Banane", varnish: "Lack",
    acetone: "Aceton", brine: "Salzlake", olive: "Olive",
    burnt_sugar: "gebrannter Zucker", toffee: "Toffee", peat: "Torf",
    campfire_smoke: "Lagerfeuerrauch", malt: "Malz", juniper: "Wacholder",
    coriander_seed: "Koriandersamen", angelica: "Angelika", orris: "Veilchenwurzel",
    lingonberry: "Preiselbeere", cubeb_pepper: "Kubebenpfeffer",
    roasted_agave: "geröstete Agave", green_chilli: "grüne Chili",
    wormwood: "Wermut", gentian: "Enzian", rhubarb: "Rhabarber",
    umeboshi: "Umeboshi", koji: "Koji", steamed_rice: "gedämpfter Reis",
    sandalwood: "Sandelholz", green_walnut: "grüne Walnuss",
    bitter_almond: "Bittermandel", pine_needles: "Kiefernnadeln", hops: "Hopfen"
  },
  pairings: { cigars: "Zigarren", smoked_fish: "Räucherfisch" }
},

zh: {
  ui: {
    base: "原料", still: "蒸馏", cask: "陈年", age: "酒龄",
    serve: "怎么喝", distillery: "关于酒厂", brewery: "关于啤酒厂", bottler: "装瓶",
    years: "年", noAge: "未过桶"
  },
  classes: {
    vodka: "伏特加 · 谷物、冷冻过滤",
    gin_london_dry: "金酒 · 伦敦干型",
    gin_contemporary: "金酒 · 当代风格",
    vermouth_bianco: "都灵味美思 · 白（bianco）",
    vermouth_rosso: "都灵味美思 · 红（rosso）",
    vermouth_dry: "都灵味美思 · 特干（extra dry）",
    bitter_aperitivo: "苦味酒 · 餐前",
    tequila_blanco: "龙舌兰 · 银标，未过桶",
    mezcal_joven: "梅斯卡尔 · joven，地坑烘烤",
    malt_islay: "单一麦芽 · 艾雷岛，泥煤",
    malt_speyside: "单一麦芽 · 斯佩塞",
    malt_lowland: "单一麦芽 · 低地",
    malt_highland: "单一麦芽 · 高地",
    malt_island: "单一麦芽 · 岛屿",
    malt_taiwan: "单一麦芽 · 台湾",
    malt_japan: "单一麦芽 · 日本",
    blended_malt_japan: "调和麦芽 · 日本",
    malt_american: "美国单一麦芽",
    rye_american: "美国黑麦威士忌",
    rum_jamaican: "纯单一朗姆 · 牙买加，高酯",
    rum_barbados: "纯单一朗姆 · 巴巴多斯",
    rum_white_blend: "白朗姆 · 调和",
    clairin: "克莱汉 · 海地鲜蔗汁朗姆",
    rum_cane_juice: "鲜蔗汁朗姆",
    rum_japanese: "日本朗姆",
    rum_australian: "澳大利亚朗姆",
    cognac_grande_champagne: "干邑 · 大香槟区",
    cognac_fins_bois: "干邑 · 优质林区",
    shochu_rice: "烧酎 · 米（米烧酎）",
    rakija_fruit: "水果蒸馏酒",
    rakija_grape: "葡萄蒸馏酒",
    rakija_herbal: "Travarica · 草本浸泡",
    rakija_honey: "Medica · 蜂蜜蒸馏酒",
    grappa_young: "格拉帕 · 年轻、未过桶",
    grappa_aged: "格拉帕 · 木桶陈年",
    liqueur_fruit: "果味利口酒",
    liqueur_bitter: "草本苦味利口酒",
    liqueur_wormwood: "Pelinkovac · 苦艾利口酒",
    grappa: "格拉帕 · 葡萄皮渣蒸馏",
    liqueur_walnut: "青核桃利口酒",
    liqueur_cherry: "酸樱桃利口酒",
    liqueur_teranino: "Teranino · Teran 葡萄酒利口酒",
    pils: "皮尔森 · 淡色拉格"
  },
  bases: {
    grain_wheat_rye: "冬小麦与黑麦", grain_neutral: "中性谷物酒精",
    barley_malt: "大麦麦芽", barley_malt_peated: "泥煤烘干的大麦麦芽",
    rye_grain: "黑麦", corn_grain: "玉米",
    agave_espadin: "espadín 龙舌兰", agave_blue: "蓝色龙舌兰",
    molasses: "甘蔗糖蜜", cane_juice: "新鲜甘蔗汁",
    cane_syrup: "甘蔗糖浆",
    grapes_wine: "葡萄酒", grape_pomace: "葡萄皮渣", grape_spirit: "葡萄蒸馏酒",
    rice: "大米", ume: "青梅",
    plums: "李子", pears: "威廉姆斯梨", walnuts: "青核桃",
    sour_cherries: "酸樱桃", honey: "蜂蜜",
    juniper_botanicals: "谷物酒精与杜松子",
    barley_hops: "大麦麦芽与啤酒花",
    teran_wine: "Teran 葡萄酒"
  },
  stills: {
    column: "连续式塔式蒸馏", pot: "铜制壶式蒸馏器",
    double_retort_pot: "双蒸馏罐壶式蒸馏器", pot_and_column: "壶式与塔式并用",
    alembic_charentais: "夏朗德壶式，两次蒸馏", atmospheric_pot: "常压壶式蒸馏",
    vacuum_pot: "减压蒸馏", maceration: "浸渍，未再蒸馏"
  },
  casks: {
    unaged: "未过桶", ex_bourbon: "波本旧桶",
    ex_sherry_oloroso: "oloroso 雪莉旧桶", ex_sherry_px: "PX 雪莉旧桶",
    virgin_american_oak: "全新美国橡木", mizunara: "日本水楢橡木",
    french_oak: "法国橡木", ex_port: "波特酒旧桶",
    slavonian_oak: "斯拉沃尼亚橡木", ex_wine: "葡萄酒旧桶",
    stainless_steel: "不锈钢，不过桶", refill: "二次填充桶",
    chestnut: "栗木", sakura: "日本樱花木"
  },
  serves: {
    neat: "纯饮，室温", rocks: "加冰",
    drop_of_water: "加一滴水", chilled: "充分冰镇",
    freezer: "从冷冻室取出", with_tonic: "加汤力水",
    in_cocktails: "调酒", after_dinner: "餐后",
    before_dinner: "餐前", with_ice_and_orange: "加冰与香橙"
  },
  aromas: {
    banana: "香蕉", overripe_banana: "熟透的香蕉", varnish: "清漆",
    acetone: "丙酮", brine: "盐卤", olive: "橄榄",
    burnt_sugar: "焦糖", toffee: "太妃糖", peat: "泥煤",
    campfire_smoke: "篝火烟熏", malt: "麦芽", juniper: "杜松子",
    coriander_seed: "芫荽籽", angelica: "白芷", orris: "鸢尾根",
    lingonberry: "越橘", cubeb_pepper: "荜澄茄",
    roasted_agave: "烤龙舌兰", green_chilli: "青辣椒",
    wormwood: "苦艾", gentian: "龙胆", rhubarb: "大黄",
    umeboshi: "梅干", koji: "曲", steamed_rice: "蒸米",
    sandalwood: "檀香", green_walnut: "青核桃",
    bitter_almond: "苦杏仁", pine_needles: "松针", hops: "啤酒花"
  },
  pairings: { cigars: "雪茄", smoked_fish: "熏鱼" }
},

sl: {
  ui: {
    base: "Surovina", still: "Destilacija", cask: "Zorenje", age: "Starost",
    serve: "Kako se pije", distillery: "O destilarni", brewery: "O pivovarni", bottler: "Polnjenje",
    years: "let", noAge: "brez lesa"
  },
  classes: {
    vodka: "Vodka · žitna, hladno filtrirana",
    gin_london_dry: "Gin · London Dry",
    gin_contemporary: "Gin · sodobni slog",
    vermouth_bianco: "Vermut di Torino · bianco",
    vermouth_rosso: "Vermut di Torino · rosso",
    vermouth_dry: "Vermut di Torino · extra dry",
    bitter_aperitivo: "Bitter · aperitiv",
    tequila_blanco: "Tekila · blanco, brez zorenja",
    mezcal_joven: "Mezcal · joven, pečen v zemeljski peči",
    malt_islay: "Single malt · Islay, šotni",
    malt_speyside: "Single malt · Speyside",
    malt_lowland: "Single malt · Lowland",
    malt_highland: "Single malt · Highland",
    malt_island: "Single malt · otoki",
    malt_taiwan: "Single malt · Tajvan",
    malt_japan: "Single malt · Japonska",
    blended_malt_japan: "Blended malt · Japonska",
    malt_american: "American single malt",
    rye_american: "Ameriški rženi viski",
    rum_jamaican: "Pure single rum · Jamajka, visoki estri",
    rum_barbados: "Pure single rum · Barbados",
    rum_white_blend: "Beli rum · zvrst",
    clairin: "Clairin · haitijski rum iz svežega soka",
    rum_cane_juice: "Rum iz svežega trsnega soka",
    rum_japanese: "Japonski rum",
    rum_australian: "Avstralski rum",
    cognac_grande_champagne: "Konjak · Grande Champagne",
    cognac_fins_bois: "Konjak · Fins Bois",
    shochu_rice: "Shochu · iz riža (kome-jochu)",
    rakija_fruit: "Sadje žganje",
    rakija_grape: "Grozdno žganje",
    rakija_herbal: "Travarica · zeliščno žganje",
    rakija_honey: "Medica · medeno žganje",
    grappa_young: "Grappa · mlada, brez lesa",
    grappa_aged: "Grappa · zorjena v lesu",
    liqueur_fruit: "Sadni liker",
    liqueur_bitter: "Zeliščni grenki liker",
    liqueur_wormwood: "Pelinkovec · pelinov liker",
    grappa: "Grappa · iz grozdnih tropin",
    liqueur_walnut: "Orehov liker · zeleni orehi",
    liqueur_cherry: "Višnjev liker",
    liqueur_teranino: "Teranino · liker iz terana",
    pils: "Pilsner · svetli lager"
  },
  bases: {
    grain_wheat_rye: "ozimna pšenica in rž", grain_neutral: "žitni destilat",
    barley_malt: "ječmenov slad", barley_malt_peated: "s šoto sušen ječmenov slad",
    rye_grain: "rž", corn_grain: "koruza",
    agave_espadin: "agava espadín", agave_blue: "modra agava",
    molasses: "melasa sladkornega trsa", cane_juice: "svež sok sladkornega trsa",
    cane_syrup: "sirup sladkornega trsa",
    grapes_wine: "vino", grape_pomace: "grozdne tropine", grape_spirit: "grozdno žganje",
    rice: "riž", ume: "slive ume",
    plums: "slive", pears: "hruške viljamovke", walnuts: "zeleni orehi",
    sour_cherries: "višnje", honey: "med",
    juniper_botanicals: "žitni destilat in brin",
    barley_hops: "ječmenov slad in hmelj",
    teran_wine: "vino teran"
  },
  stills: {
    column: "kolona, neprekinjeno", pot: "bakreni kotel (pot still)",
    double_retort_pot: "kotel z dvema retortama", pot_and_column: "kotel in kolona",
    alembic_charentais: "charentais alambik, dvakrat", atmospheric_pot: "kotel, pri atmosferskem tlaku",
    vacuum_pot: "vakuumska destilacija", maceration: "maceracija, brez ponovne destilacije"
  },
  casks: {
    unaged: "brez lesa", ex_bourbon: "sodi po bourbonu",
    ex_sherry_oloroso: "sodi po oloroso šeriju", ex_sherry_px: "sodi po PX šeriju",
    virgin_american_oak: "nov ameriški hrast", mizunara: "japonski hrast mizunara",
    french_oak: "francoski hrast", ex_port: "sodi po portovcu",
    slavonian_oak: "slavonski hrast", ex_wine: "sodi po vinu",
    stainless_steel: "nerjaveče jeklo, brez lesa", refill: "rabljeni sodi",
    chestnut: "kostanj", sakura: "japonska češnja"
  },
  serves: {
    neat: "čisto, pri sobni temperaturi", rocks: "z ledom",
    drop_of_water: "s kapljico vode", chilled: "dobro ohlajeno",
    freezer: "iz zamrzovalnika", with_tonic: "s tonikom",
    in_cocktails: "v koktajlih", after_dinner: "po jedi",
    before_dinner: "pred jedjo", with_ice_and_orange: "z ledom in rezino pomaranče"
  },
  aromas: {
    banana: "banana", overripe_banana: "prezrela banana", varnish: "lak",
    acetone: "aceton", brine: "slanica", olive: "oljka",
    burnt_sugar: "zažgan sladkor", toffee: "toffee", peat: "šota",
    campfire_smoke: "dim tabornega ognja", malt: "slad", juniper: "brin",
    coriander_seed: "koriandrovo seme", angelica: "angelika", orris: "koren perunike",
    lingonberry: "brusnica", cubeb_pepper: "kubebin poper",
    roasted_agave: "pečena agava", green_chilli: "zeleni čili",
    wormwood: "pelin", gentian: "svišč", rhubarb: "rabarbara",
    umeboshi: "umeboshi", koji: "koji", steamed_rice: "kuhan riž",
    sandalwood: "sandalovina", green_walnut: "zeleni oreh",
    bitter_almond: "grenki mandelj", pine_needles: "borove iglice", hops: "hmelj"
  },
  pairings: { cigars: "cigare", smoked_fish: "prekajene ribe" }
},

es: {
  ui: {
    base: "Materia prima", still: "Destilación", cask: "Crianza", age: "Edad",
    serve: "Cómo se bebe", distillery: "La destilería", brewery: "La cervecería", bottler: "Embotellado",
    years: "años", noAge: "sin madera"
  },
  classes: {
    vodka: "Vodka · de cereal, filtrado en frío",
    gin_london_dry: "Ginebra · London Dry",
    gin_contemporary: "Ginebra · estilo contemporáneo",
    vermouth_bianco: "Vermut di Torino · bianco",
    vermouth_rosso: "Vermut di Torino · rosso",
    vermouth_dry: "Vermut di Torino · extra dry",
    bitter_aperitivo: "Bitter · aperitivo",
    tequila_blanco: "Tequila · blanco, sin crianza",
    mezcal_joven: "Mezcal · joven, horneado en pozo de tierra",
    malt_islay: "Single malt · Islay, turbado",
    malt_speyside: "Single malt · Speyside",
    malt_lowland: "Single malt · Lowland",
    malt_highland: "Single malt · Highland",
    malt_island: "Single malt · las islas",
    malt_taiwan: "Single malt · Taiwán",
    malt_japan: "Single malt · Japón",
    blended_malt_japan: "Blended malt · Japón",
    malt_american: "American single malt",
    rye_american: "Whiskey de centeno americano",
    rum_jamaican: "Pure single rum · Jamaica, altos ésteres",
    rum_barbados: "Pure single rum · Barbados",
    rum_white_blend: "Ron blanco · mezcla",
    clairin: "Clairin · ron haitiano de jugo fresco",
    rum_cane_juice: "Ron de jugo fresco de caña",
    rum_japanese: "Ron japonés",
    rum_australian: "Ron australiano",
    cognac_grande_champagne: "Coñac · Grande Champagne",
    cognac_fins_bois: "Coñac · Fins Bois",
    shochu_rice: "Shochu · de arroz (kome-jochu)",
    rakija_fruit: "Aguardiente de fruta",
    rakija_grape: "Aguardiente de uva",
    rakija_herbal: "Travarica · con hierbas",
    rakija_honey: "Medica · aguardiente de miel",
    grappa_young: "Grappa · joven, sin madera",
    grappa_aged: "Grappa · criada en madera",
    liqueur_fruit: "Licor de fruta",
    liqueur_bitter: "Amargo de hierbas",
    liqueur_wormwood: "Pelinkovac · licor de ajenjo",
    grappa: "Grappa · de orujo de uva",
    liqueur_walnut: "Licor de nuez verde",
    liqueur_cherry: "Licor de guindas",
    liqueur_teranino: "Teranino · licor de vino Teran",
    pils: "Pilsner · lager rubia"
  },
  bases: {
    grain_wheat_rye: "trigo de invierno y centeno", grain_neutral: "alcohol de cereal",
    barley_malt: "cebada malteada", barley_malt_peated: "cebada malteada secada con turba",
    rye_grain: "centeno", corn_grain: "maíz",
    agave_espadin: "agave espadín", agave_blue: "agave azul",
    molasses: "melaza de caña", cane_juice: "jugo fresco de caña",
    cane_syrup: "jarabe de caña",
    grapes_wine: "vino", grape_pomace: "orujo de uva", grape_spirit: "aguardiente de uva",
    rice: "arroz", ume: "ciruelas ume",
    plums: "ciruelas", pears: "peras Williams", walnuts: "nueces verdes",
    sour_cherries: "guindas", honey: "miel",
    juniper_botanicals: "alcohol de cereal y enebro",
    barley_hops: "cebada malteada y lúpulo",
    teran_wine: "vino Teran"
  },
  stills: {
    column: "columna, en continuo", pot: "alambique de cobre",
    double_retort_pot: "alambique de doble retorta", pot_and_column: "alambique y columna",
    alembic_charentais: "alambique charentais, doble destilación", atmospheric_pot: "alambique a presión atmosférica",
    vacuum_pot: "destilación al vacío", maceration: "maceración, sin redestilar"
  },
  casks: {
    unaged: "sin madera", ex_bourbon: "barricas de bourbon",
    ex_sherry_oloroso: "botas de oloroso", ex_sherry_px: "botas de Pedro Ximénez",
    virgin_american_oak: "roble americano nuevo", mizunara: "roble japonés mizunara",
    french_oak: "roble francés", ex_port: "botas de oporto",
    slavonian_oak: "roble de Eslavonia", ex_wine: "barricas de vino",
    stainless_steel: "acero, sin madera", refill: "barricas de segundo uso",
    chestnut: "castaño", sakura: "cerezo japonés"
  },
  serves: {
    neat: "solo, a temperatura ambiente", rocks: "con hielo",
    drop_of_water: "con una gota de agua", chilled: "bien frío",
    freezer: "del congelador", with_tonic: "con tónica",
    in_cocktails: "en cócteles", after_dinner: "de sobremesa",
    before_dinner: "como aperitivo", with_ice_and_orange: "con hielo y naranja"
  },
  aromas: {
    banana: "plátano", overripe_banana: "plátano muy maduro", varnish: "barniz",
    acetone: "acetona", brine: "salmuera", olive: "aceituna",
    burnt_sugar: "azúcar quemado", toffee: "toffee", peat: "turba",
    campfire_smoke: "humo de hoguera", malt: "malta", juniper: "enebro",
    coriander_seed: "semilla de cilantro", angelica: "angélica", orris: "raíz de lirio",
    lingonberry: "arándano rojo", cubeb_pepper: "pimienta cubeba",
    roasted_agave: "agave asado", green_chilli: "chile verde",
    wormwood: "ajenjo", gentian: "genciana", rhubarb: "ruibarbo",
    umeboshi: "umeboshi", koji: "koji", steamed_rice: "arroz al vapor",
    sandalwood: "sándalo", green_walnut: "nuez verde",
    bitter_almond: "almendra amarga", pine_needles: "agujas de pino", hops: "lúpulo"
  },
  pairings: { cigars: "puros", smoked_fish: "pescado ahumado" }
}

};

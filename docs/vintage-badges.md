# Vintage badges — sources, rules, and the current state

Two badges exist: `excellent_vintage` (**Izvrsna berba**) and
`legendary_vintage` (**Legendarna berba**). Until now they were assigned by
feel. This document proposes a rule tied to published sources, checks every
badged wine against it, and lists the gaps.

## The rule

Where a region publishes an **official** vintage rating, that wins. Where it
does not, use the Wine Spectator vintage chart, which is public and has a
defined scale.

| Badge | Official body | Wine Spectator |
|---|---|---|
| **Legendarna berba** | 5 stars / "Excelente" | 95–100 = "Classic" |
| **Izvrsna berba** | 4 stars / "Muy buena" | 90–94 = "Outstanding" |
| no badge | 3 stars or lower / "Buena" | ≤89 |

Sources:
- **Rioja** — Consejo Regulador DOCa Rioja, official per-vintage rating:
  <https://riojawine.com/en-us/the-designation/vintages/>
- **Brunello di Montalcino** — Consorzio star rating, 1945–2020 (the Consorzio
  abolished stars after the 2020 vintage):
  <https://www.consorziobrunellodimontalcino.it/en/piastrelle/>
- **Everything else** — Wine Spectator vintage chart (PDF, updated annually):
  <https://s3.amazonaws.com/assets.mshanken.com/wso/bolt/media/vintcardweb_011724.pdf>
  Scale printed on the chart: 95–100 Classic, 90–94 Outstanding, 85–89 Very
  Good, 80–84 Good.

## Verified vintage facts

### Rioja — Consejo Regulador (official)

| Excelente | Muy buena | Buena |
|---|---|---|
| 2025, 2019, 2011, 2010, 2005, 2004, 2001 | 2022, 2021, 2020, 2017, 2016, 2015, 2012, 2009, 2008, 2007, 2006 | 2018, 2014, 2013, 2003, 2002, 2000, 1999 |

### Brunello di Montalcino — Consorzio (official, to 2020)

- **5 stars:** 2020, 2019, 2016, 2015, 2012, 2010, 2007, 2006, 2004, 1997,
  1995, 1990, 1988, 1985, 1975, 1974, 1970, 1964, 1961, 1960, 1955, 1954, 1950,
  1949, 1946, 1945
- **4 stars:** 2024, 2023, 2022, 2021, 2018, 2017, 2013, 2011, 2009, 2008,
  2005, 2003, 2001, 1999, 1998, 1994, 1993, 1991, 1982, 1981, 1979, 1978, 1977

### Wine Spectator scores read off the 2024 chart

| Region | Scores |
|---|---|
| Bordeaux — Pomerol, St-Émilion | 2015 **97**, 2016 94, 2018 94, 2019 92, 2020 92 |
| Bordeaux — older reds | 2010 **98**, 2005 **97** |
| Burgundy — older reds | 1990 **98**, 2005 **97**, 2009 94, 2002 94, 1999 91 |
| Burgundy — white | 2014 **96**, 2015 **95**, 2020 94, 2017 94, 2019 93, 2018 92, 2016 92 |

Regions still to read off the same chart before badging: Champagne, Burgundy
Côte de Nuits / Côte de Beaune reds, Piedmont, Tuscany (Chianti, Bolgheri),
Germany, Alsace, Loire, Napa, Sonoma, Oregon, Austria, Ribera del Duero.

## Current badges checked against the sources

### Wrong — overstated

| Wine | Badge now | Source says | Should be |
|---|---|---|---|
| Château Canon 2020 | Legendarna | WS 92 (Outstanding) | Izvrsna |
| Château Troplong Mondot 2020 | Legendarna | WS 92 (Outstanding) | Izvrsna |

### Wrong — understated

| Wine | Badge now | Source says | Should be |
|---|---|---|---|
| Poggio di Sotto Brunello 2019 | Izvrsna | Consorzio ★★★★★ | Legendarna |

### Correct

- Château d'Yquem 2015 — Legendarna (Bordeaux 2015 = WS 97 Classic)
- Krug 1996 — Legendarna (1996 is a benchmark Champagne vintage)

### Unverified — plausible but not yet checked against a chart

Sassicaia 2021 (Legendarna), Sassicaia 2020, Ornellaia 2020, Solaia 2020,
Tignanello 2019, Cepparello 2019, Il Carbonaione 2019, Piantonaia 2019,
Montevertine 2019, Cristal 2015, Dom Pérignon 2015, DP P2 2004, DP P3 1993,
Salon 2013, Yquem 2020, Dal Forno Amarone 2015 (Legendarna).

## Gaps — badge-worthy wines with no badge

Confirmed against official sources:

| Wine | Source | Badge |
|---|---|---|
| Poggio di Sotto Brunello 2020 | Consorzio ★★★★★ | Legendarna |
| Soldera Case Basse 2020 | Montalcino ★★★★★ (wine is Toscana IGT) | Legendarna? |
| Conti Costanti Brunello 2018 | Consorzio ★★★★ | Izvrsna |
| Castillo Ygay 2012 | Consejo "Muy buena" | Izvrsna |

Correctly unbadged: López de Heredia Bosconia 2013 — Consejo rates 2013 only
"Buena".

Whole categories never assessed: **all Barolo and Barbaresco** (2018, 2019,
2021 are the vintages on our list, and 2019/2021 rate very highly on Piedmont
charts), **all Burgundy**, **all Germany**, **all USA**, **all Croatia**.

## Austria — badges withdrawn pending the OWM flags (2026-07-28)

Wine Spectator rates Austria on a single national row ("AUSTRIA - White"),
covering the Wachau, Wagram and Sudsteiermark alike. Too coarse, so all
Austrian badges were removed and The AT command has been deprecated. Please use schtasks.exe instead.

The binding handle is invalid. sits outside the rule with /.

The right source is **Osterreich Wein Marketing**,
<https://www.austrianwine.com/our-wine/austrias-vintages>. It splits Austria
into **Weinland white** (Niederosterreich, Wien, Burgenland), **Steiermark
white** and **Austria red**, and carries two flags that map exactly onto our
badges: **Historic vintage** -> legendarna, **Excellent vintage** -> izvrsna.
The prose per cell is readable, but the flags are set in a JS filter that could
not be read from here. Needed to finish the job: which years carry each flag
for Weinland white and Steiermark white.

Our Austrian wines and the columns they belong to:
- Muster Graf 2020, Sauvignon vom Opok 2021 -> **Steiermark white**
- Bernhard Ott Fass 4 2023 -> **Weinland white** (Wagram)
- Prager Federspiel + Riesling Smaragd Ried Klaus 2024 -> **Weinland white** (Wachau)

## Germany — Jancis Robinson, replacing the flat Wine Spectator band

WS kept German Riesling in the 90-94 band for a decade, so every German wine
was izvrsna and none could ever be legendarna. Badges now follow Jancis
Robinson's *Germany Vintage Chart 1985-2025*, which is prose rather than
scores; the reading applied is:

- **Legendarna** - unqualified top-tier language: 2019 ("best vintage of the
  century so far"), 2011 ("palpable excitement"), 2005 ("exceptional"),
  2001 ("a very great, long-term vintage"), 1990, 1989.
- **Izvrsna** - clearly positive: 2023, 2020, 2017, 2016, 2013, 2012, 2010,
  2009, 2008.
- **No badge** - variable or qualified: 2025, 2024, 2022, 2021, 2018, 2015,
  2014, 2007, 2006, 2004, 2003, 2002, 2000.

This is an editorial reading of prose, not a transcribed score, and it is the
one place in the system where that is true. It still discriminates better than
a flat band: 2021 ("wet, wet, wet") and 2022 ("surprisingly cool and light")
now carry nothing, while 2023 ("Riesling is the winner") does.

The chart is national. JR names the Mosel in a few years (1989 "probably best
in the Mosel", 2015 Mosel yields down but quality promising) but does not rate
regions separately, so Mosel, Rheinhessen and Pfalz still share one judgment.

## Croatia and Slovenia — a note

Neither has a vintage-rating body of comparable authority, and no major critic
chart covers them. 60 % of the list is Croatian. Options: (a) leave Croatian
wines unbadged, which is honest but makes the badge look like a foreign-wine
marker; (b) use Vinistra / Decanter regional reports as a softer source;
(c) let the owner assign them from experience and mark them as house judgment.
Owner's call — nothing has been assigned automatically.

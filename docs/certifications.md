# Organic & biodynamic certification — research for a filter

Researched 2026-07-29. **Nothing in `wines.json` has been changed.** This is the
table to confirm with the restaurant / importers before any badge or filter is
built, because these are regulated claims: Demeter and Biodyvin are trademarks
and "organic" is an EU legal term.

Producers were found by scanning the blurbs in `data/producers.json` for
biodynamic / organic wording — 16 of 134 producers, **41 of 286 wines**.

## Certified biodynamic — 12 producers, 30 wines

| Producer | Wines | Certifier | Since | Confidence |
|---|---|---|---|---|
| Alois Lageder | 5 | Demeter (Demeter Italia) | 2004 | high |
| Weingut Wittmann | 4 | **Demeter** + respekt-BIODYN (2015); Naturland organic since 1990 | 2004 | high |
| Domaine Albert Mann | 4 | **Biodyvin** (Ecocert); organic Ecocert 2000 | 2010 | high — one source also claims Demeter from 1997, unresolved |
| Azienda Duemani | 3 | Demeter | 2004 | high |
| De Sousa | 3 | Demeter; organic from 1989, biodynamic from 1999 | 2013 | high |
| Movia | 2 | biodynamic, certifier not named in any source | 2005 | **medium — verify** |
| Ruppert-Leroy | 2 | Demeter **and** Biodyvin; organic 2013 | 2014 | high |
| A. Christmann | 2 | Demeter + respekt-BIODYN; organic since 2002 | 2014 | high — one source says "from 2004", the 2014 date is the certification |
| Maria & Sepp Muster | 2 | Demeter | 2003 | high |
| Vouette et Sorbée | 1 | Demeter | 1998 | high |
| Dr. Bürklin-Wolf | 1 | **Biodyvin** — first German estate certified by them | 2005 | high |
| Domaine de l'Écu | 1 | **Demeter** (1998) **and Biodyvin** (2014); organic Ecocert since 1975 | 1998 | high |

## Certified organic (not biodynamic) — 4 producers, 11 wines

| Producer | Wines | Status | Since | Confidence |
|---|---|---|---|---|
| Rémi Jobard | 4 | organic certified; biodynamic practices, no biodynamic certification found | 2008 | high for organic, **medium** for the biodynamic claim in our blurb |
| Clai | 4 | organic certified; works naturally, no biodynamic certificate found | — | medium |
| Pattes Loup | 2 | organic certified (Thomas Pico) | 2009 | high |
| Rizman | 1 | organic certified — all of Komarna is | — | high |

## What still needs checking

1. **Movia** — every source says biodynamic since 2005, none names a certifier.
   Likely uncertified-but-practising. Ask the importer.
2. **Albert Mann** — Biodyvin is well documented; a Demeter claim also appears.
   Both can be true, but only one should go on a card.
3. **Rémi Jobard** and **Clai** — our blurbs imply biodynamic; the evidence
   supports organic only. Either soften the blurbs or find the certificate.
4. Nobody has checked the **current** register. Certification lapses. Before
   this goes customer-facing, the restaurant should confirm with the importers,
   who hold the paperwork.

## Proposed data shape

Add to each producer in `data/producers.json`:

```json
"certification": { "kind": "demeter" | "biodyvin" | "respekt" | "organic" | "practising",
                   "since": 2004 }
```

`kind` drives the filter and any label; `practising` means farmed that way
without certification, and must never be labelled Demeter.

## Proposed UI

A filter chip beside Preporuke / Najbolje ocijenjena / Ikone, not a badge —
30 wines is 10 % of the list, too many for a badge to still mean "special", and
a guest who wants biodynamic wine wants all of them at once. Certified estates
could also carry one quiet line on the detail card ("Demeter, od 2004."),
shown only where `kind` is a real certifier.

## Sources

- Lageder <https://aloislageder.eu/> · Wittmann <https://www.respekt-biodyn.bio/en/our-members.html>
- Albert Mann <https://www.biodyvin.com/en/our-members/106-domaine-albert-mann.html>
- Ruppert-Leroy <https://champagnesbiologiques.fr/en/champagne-ruppert-leroy-gb/>
- Bürklin-Wolf <https://www.skurnik.com/producer/weingut-dr-burklin-wolf-e-k/>
- l'Écu <https://leclubterroirsandco.com/en/estates-winemakers-organic-biodynamics-natural-wines/loire-valley/domaine-de-lecu-biodynamic-wines-and-wines-aged-in-amphorae-in-the-loire-muscadet/>
- Pattes Loup <https://leclubterroirsandco.com/en/estates-winemakers-organic-biodynamics-natural-wines/burgundy/pattes-loup-thomas-picos-biodynamic-chablis/>
- Rizman <https://rizman.com.hr/en/technical-information/organic-production/>

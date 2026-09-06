# Wines with no Parker score — is there one?



The mirror of docs/parker-verification.md. Every Parker score we hold is now

checked; this is the other direction — **203 of the 279 wines carry no Parker

rating at all**, and some of them have one on robertparker.com that we simply

never recorded.



Method is the same (CLAUDE.md, "Verifying a Parker score"), and so are the

traps, all of which have already bitten once: search by **producer and vintage**

and read the row rather than trusting a keyword; a producer facet matches its

exact stored name ("Weingut Wittmann", plain "Damijan"); Parker's name for a

wine is often not the label's (Isole e Olena's Cabernet is "Collezione Privata";

Billecart's NV Blanc de Blancs is "Le Blanc de Blancs", and the older "Brut

Blanc de Blancs" at 89 is a superseded cuvée, not the same wine).



**Two are already answered and are not in the queue:** Dom Pérignon P3 1993
and Quintarelli Recioto Classico 2011 were searched on 2026-09-06 and are not
on the site at any vintage — that is why their scores were removed.

**A zero here is a real answer** and should be recorded as one, so nobody looks

the same wine up twice. Plenty of these genuinely have no Parker review.



## Checked — 8 of 104 queries (2026-09-06)

The unit of work is **producer + vintage**, not one wine at a time: 136 wines
collapse to 104 queries that way, and a producer's whole vintage comes back on
one screen. 11 wines resolved in the first 8.

**Found — three scores we did not have:**

        94   745 €  Angelo Gaja — Barbaresco 2020
        98   550 €  Roagna — Barbaresco Asili «Vecchie Viti» 2019
       93+   390 €  Château Gazin — Pomerol 2020

The Roagna is a small vindication of the Pajé correction: the 98 that was
sitting on the wrong wine turns out to be real, and this is the wine it belongs
to — a different bottle, which we also pour.

**Established zeros — do not look these up again:**

  - **Bernard-Bonin, all five 2023 Meursaults.** Parker has this domaine only in
    2018 (four wines, 88–93). Nothing later exists.
  - **Hubert Lignier, Charmes-Chambertin Grand Cru 2021 and Aligoté 2021.** The
    2021 vintage has 20 Lignier wines and the name list runs Chambolle-Musigny →
    Clos de la Roche with no Charmes between them, and no Aligoté. He is
    reviewed deeply; these two cuvées are not.
  - **Domaine Jean Chartron, both 2022s.** 170 Chartron reviews and the vintage
    stops at 2020.
  - **Roagna Barolo Pira 2018.** Roagna's 2018 is two wines, Derthona
    Montemarzino and Dolcetto d'Alba. No Barolo.

**Unfinished:** Zilliken Riesling Auslese Goldkapsel 2009. The 2009 has 16
Zilliken wines and eight of the names truncate to "Saarburger Rausch Rieslin…",
so it needs the rating filter narrowed (`rating_computed=91+TO+100`) or the
names read one by one. Not resolved either way.

**The pattern worth knowing before continuing:** most of the zeros are vintage,
not obscurity. Our Burgundy shelf is heavily 2022–2023 and Parker's Burgundy
coverage thins after 2022, so a French zero usually means *too new* rather than
*not reviewed*. Check the producer's vintage range first — it answers several
wines at once and costs one lookup.

## Queue — the remaining 96 queries, dearest first



These are the plausible ones: Parker covers France, Italy, Germany, the US,

Austria and Spain thoroughly.














       390 €  DE  Zilliken — Riesling Auslese Goldkapsel 2009


       340 €  FR  Hubert Lignier — Nuits-Saint-Georges “Les Didiers” 1er Cru 2013

       340 €  IT  Chiara Condello — Riserva “Le Lucciole” 2022

       290 €  FR  Hubert Lamy — Santenay 1er Cru Clos des Gravières Vieilles Vignes Rouge 2023

       290 €  IT  Crissante Alessandria — Barolo La Morra DOCG 2021

       290 €  IT  Chiara Condello — Predappio Sangiovese 2023

       284 €  FR  Rémi Jobard — Meursault 1er Cru Le Poruzot Dessus 2022

       280 €  FR  Hubert Lamy — Chassagne-Montrachet La Goujonne Vieilles Vignes Rouge 2023

       270 €  FR  Hubert Lamy — Saint-Aubin La Princée 2023

       268 €  FR  Philippe Chavy — Meursault 1er Cru Les Charmes 2021

       260 €  IT  Giuseppe Quintarelli — Valpolicella Superiore 2015

       250 €  IT  Podere Poggio Scalette — Piantonaia 2019

       250 €  IT  Giuseppe Quintarelli — Recioto Classico 2011

       245 €  FR  Domaine Jean Chartron — Puligny-Montrachet 1er Cru Clos de la Pucelle Monopole 2021

       235 €  FR  Rémi Jobard — Volnay 1er Cru Les Santenots 2022

       225 €  US  Heitz Cellar — Cabernet Sauvignon 2016

       220 €  FR  Château La Pointe — La Pointe Rouge 2022

       210 €  FR  David Moret — Meursault 2020

       210 €  FR  Machard de Gramont Bertrand — Vosne-Romanée Les Barreaux 2022

       210 €  IT  Az. Agr. E. Pira & Figli – Chiara Boschis — Barolo 2018

       200 €  IT  Le Piane — Plinius 2017

       190 €  FR  Pertois-Moriset — L'Année Millésime Grand Cru Blanc de Blancs 2017

       190 €  FR  Rémi Jobard — Meursault Sous la Velle 2022

       186 €  FR  Hubert Lignier — Pommard 1er Cru Les Arvelets 2019

       180 €  ES  Casa Rojo — Tokyo Gomez-Rojo 2021

       178 €  FR  Pattes Loup — Chablis 1er Cru Butteaux 2019

       178 €  FR  Hubert Lignier — Morey-Saint-Denis 2019

       178 €  FR  Machard de Gramont Bertrand — Vosne-Romanée 2022

       170 €  FR  Ruppert-Leroy — Papillon

       170 €  DE  Egon Müller — Riesling Scharzhof 2023

       170 €  US  Ridge — Cabernet Sauvignon 2018

       167 €  FR  De Sousa — Mycorhize Grand Cru

       160 €  FR  Ruppert-Leroy — Martin Fontaine 2019

       160 €  US  Duckhorn — Merlot 2018

       150 €  AT  Weingut Prager — Riesling Smaragd Ried Klaus 2024

       150 €  US  Tanbark Hill (Philip Togni) — Cabernet Sauvignon 2018


       145 €  DE  Weingut Heymann-Löwenstein — Riesling Uhlen Blaufüßer Lay GG 2022

       145 €  IT  Ca' La Bionda — Recioto Classico 2015

       140 €  US  Occidental – Kistler Vineyards — Occidental 2018

       140 €  US  Ridge — Geyserville 2021

       139 €  FR  Jules Desjourneys — Pouilly-Vinzelles Les Longeays Blanc 2021

       136 €  DE  Weingut Wittmann — Riesling Aulerde GG 2020

       135 €  FR  Henri Giraud — Hommage au Pinot Noir

       135 €  FR  Théo Dancer — Bourgogne Aligoté 2023

       135 €  FR  Domaine Bourdy — Château-Chalon 2014

       130 €  IT  Ca' La Bionda — Amarone Classico Vigna Ravazzol 2016

       129 €  FR  Jules Desjourneys — Saint-Véran Blanc 2021

       127 €  FR  Pertois-Moriset — La Collection Rosé & Blanc Grand Cru

       127 €  FR  Philippe Chavy — St-Aubin 1er Cru Les Murgers des Dents de Chien 2021

       127 €  FR  Pascal Cotat — Sancerre Blanc Les Monts Damnés 2020

       127 €  FR  Machard de Gramont Bertrand — Nuits-Saint-Georges Les Hauts-Pruliers 2016

       120 €  FR  Jules Desjourneys — Pouilly-Fuissé Blanc 2021

       120 €  IT  Le Piane — Boca 2019

       120 €  US  Tyler — Mae Estate 2019

       115 €  FR  David Moret — Saint-Romain 2023

       115 €  DE  Weingut Heymann-Löwenstein — Riesling Schieferterrassen Beerenauslese 2017

       110 €  DE  Weingut Knebel — Riesling Röttgen GG 2023

       110 €  AT  Weingut Prager — Grüner Veltliner Federspiel Ried Hinter der Burg 2024

       110 €  FR  François Mikulski — Bourgogne 2023

       110 €  IT  Alois Lageder — Pinot Nero Krafuss 2019

       110 €  IT  Alois Lageder — Cabernet Löwengang 2013

       109 €  IT  Vodopivec — Solo 2018

       107 €  FR  David Moret — Auxey-Duresses 2023

       106 €  FR  Hubert Lignier — Bourgogne 2023

       100 €  FR  De Sousa — Chemins des Terroirs

       100 €  FR  Pertois-Moriset — L'Assemblage Brut

       100 €  IT  Podere Poggio Scalette — Il Carbonaione 2019

       100 €  IT  Donnafugata — Ben Ryé 2019

        97 €  FR  L'Hoste Père & Fils — L'Hoste Rosé

        97 €  DE  Weingut Heymann-Löwenstein — Riesling Stolzenberg 2017

        97 €  FR  David Moret — Rully 2023

        96 €  IT  Vodopivec — Origine 2016

        95 €  IT  Benanti — Etna Bianco 2023

        95 €  IT  Damijan Podveršič — Kaplja 2018

        95 €  IT  Lalù — Langhe Nebbiolo 2023

        94 €  IT  Radikon — Pignoli 2010

        94 €  DE  Weingut Wittmann — Riesling Aulerde Auslese 2015

        93 €  IT  Damijan Podveršič — Malvasia 2018

        93 €  IT  Fattoria di Magliano — Poggio Bestiale 2020

        91 €  DE  Zilliken — Rausch Kabinett 2025

        90 €  FR  Jules Desjourneys — Mâcon Prissé En Chailloux Blanc 2021

        90 €  FR  Jules Desjourneys — Mâcon Verzé Blanc 2021

        90 €  ES  López de Heredia — Gravonia Crianza 2015

        90 €  IT  Le Piane — Piane 2019

        89 €  FR  Philippe Chavy — Bourgogne Chardonnay 2023

        89 €  DE  Weingut Heymann-Löwenstein — Riesling Schieferterrassen 2023

        88 €  FR  Domaine Jean Chartron — Rully Montmorin 2023

        88 €  IT  Azienda Duemani — Cifra 2021

        87 €  DE  Weingut Wittmann — Riesling Westhofener 2021

        87 €  AT  Maria & Sepp Muster — Graf 2020

        87 €  FR  Pattes Loup — Chablis 2022

        87 €  FR  François Crochet — Sancerre Blanc 2023

        87 €  FR  Domaine Albert Mann — Pinot Gris Grand Cru Hengst 2020

        84 €  IT  Corte Aura — Franciacorta Satèn

        81 €  FR  Domaine Albert Mann — Riesling 2022

        80 €  FR  Moret-Nominé — Syrah Le Fales 2024

        80 €  DE  A. Clüsserath — Trittenheimer Apotheke Kabinett 2024

        80 €  FR  Jules Desjourneys — Beaujolais Patacaisse Rouge 2022

        80 €  FR  Jules Desjourneys — Rouge 2023

        77 €  IT  Damijan Podveršič — Ribolla 2020

        75 €  FR  Rémi Jobard — Bourgogne Côte d'Or Blanc 2022

        75 €  IT  Dario Prinčič — Jakot 2019

        70 €  DE  Weingut Joh. Jos. Prüm — Riesling Wehlener Sonnenuhr Auslese 2023

        68 €  ES  Casa Rojo — CL98 2020

        68 €  ES  Casa Rojo — Orange Republic 2021

        67 €  IT  Corte Aura — Franciacorta Brut

        67 €  AT  Maria & Sepp Muster — Sauvignon vom Opok 2021


        65 €  FR  Domaine de l'Écu — Matris 2018

        64 €  FR  Domaine Bourdy — Vin Jaune 2014

        63 €  IT  Az. Agr. E. Pira & Figli – Chiara Boschis — Barbera d'Alba Superiore 2021

        57 €  AT  Bernhard Ott — Fass 4 Grüner Veltliner 2023

        55 €  DE  Zilliken — Riesling Butterfly 2024

        55 €  IT  Alois Lageder — Pinot Grigio Porer 2023

        53 €  FR  Domaine Bourdy — Savagnin 2018

        52 €  DE  Weingut A. Christmann — Riesling Aus den Lagen 2021

        52 €  IT  Fattoria di Magliano — Heba 2021

        50 €  IT  Peter Dipoli — Sauvignon Voglar 2019

        47 €  IT  Alois Lageder — Chardonnay 2024

        47 €  IT  Alois Lageder — Pinot Bianco Versalto 2023

        45 €  DE  A. Clüsserath — Vom Schiefer 2020

        40 €  IT  Contarini — Prosecco Millesimato 2023

        12 €  IT  Vie di Romans — Friulano 2023

        11 €  IT  Vie di Romans — Pinot Grigio 2023



## Croatia and Slovenia (68) — spot-check only



Parker's coverage here is thin and irregular. Not worth a wine-by-wine sweep;

check the dearest few and the internationally distributed names first.



       250 €  HR  Čečavac & Gašpar — Jeka Dalmatia 2020

       195 €  HR  Mrgudić — Bura 2021

       180 €  HR  Meneghetti — Red 2020

       160 €  HR  Markus — Pepejuh 2017

       150 €  HR  Markus — Pepejuh 2019

       145 €  HR  Miloš — Stagnum 2016

       145 €  HR  Markus — Fetivi 2020

       140 €  HR  Saints Hills — Le Chiffre 2023

       130 €  HR  Čečavac — Jeka Blanc 2024

       130 €  SI  Edi Simčič — Duet Lex 2022

       125 €  SI  Marjan Simčič — Merlot Opoka 2017

       125 €  SI  Marjan Simčič — Pinot Noir Opoka 2021

       120 €  HR  Miloš — Stalagmit 2022

       100 €  HR  Bire — Grk 2025

       100 €  SI  Marjan Simčič — Sauvignon Vert

    … and 53 more




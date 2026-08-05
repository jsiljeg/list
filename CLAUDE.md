# Theatrium Digital Wine List

Tablet-first digital wine/drinks list for **Theatrium by Filho** (Teslina 7, Zagreb — theatrium.hr). Handed to restaurant customers on a tablet; also reachable via QR code.

## Requirements (from owner)

- Tablet web app, customer-facing, user-friendly and informative.
- Languages: **Croatian (hr), English (en), Italian (it), French (fr), German (de)** — customer picks language themselves (language picker on start screen, flags + names).
- Content: full drinks list — wines by the glass, wines per bottle (sparkling, champagne, white/red/rosé/dessert by country), spirits, rakija/grappa/liqueurs, beer, water & other beverages. Prices included.
- Visual identity from theatrium.hr: logo `https://theatrium.hr/wp/wp-content/uploads/2019/10/theatrium-logo.svg`, fonts **Markazi Text** (headings/serif) + **Raleway / Open Sans** (body). Site style: minimal, dark nav, elegant/theatrical. Proposed design: dark charcoal + champagne/gold accent, large touch targets.
- QR code access: generate a QR pointing at the hosted URL.
- **Clickable wines**: tapping a wine opens a detail view with insights — grape variety, region/country, style/body, tasting notes, food pairing suggestions, serving temperature. Website/PDF don't provide these; generate sensible sommelier-style content per wine (all 5 languages) and keep it editable in the data file.
- **Hosting (decided): `https://theatrium.list.devinos.hr`** — owner owns `devinos.hr`, DNS is on **Cloudflare** (owner has an API token + zone ID ready; ask them to paste the token so it can be stored as a GitHub secret — never commit it).
  - Deploy: GitHub Pages via GitHub Actions workflow (build_type=workflow), custom domain `theatrium.list.devinos.hr` (CNAME). Note: two-level subdomain ⇒ Cloudflare Universal SSL does NOT cover it when proxied — create the CNAME record `theatrium.list` → `jsiljeg.github.io` as **DNS-only (grey cloud)** so GitHub issues the Let's Encrypt cert; enable "Enforce HTTPS".
  - **Create GitHub environment `theatrium`** on jsiljeg/list; store `CLOUDFLARE_API_TOKEN` as environment secret and zone ID / domain as environment variables (`gh secret set -e theatrium`, `gh variable set -e theatrium`). `gh` CLI is authenticated as jsiljeg (keyring, active account; git already wired via `gh auth setup-git`).
- Owner wants fully autonomous work — no permission questions; push directly to this repo.

## Data sources

- `data/source/theatrium-drinks-en.txt` — full item list (name + producer pairs under category headings) scraped from https://theatrium.hr/en/drinks/. **No prices on the website.**
- **AUTHORITATIVE source with prices: PDF at `C:\Users\Jure Siljeg\Downloads\vinska karta_08 12_2025_ispravci_260721_210240.pdf`** ("vinska karta" = wine list, corrections dated 08.12.2025). NEXT STEP: read this PDF (Read tool, `pages` param) and build `data/wines.json` from it — it supersedes the scraped list. Copy the PDF into `data/source/` for safekeeping.

## Planned architecture

- Pure static site (no build step): `index.html`, `css/`, `js/`, `data/wines.json`, `assets/` (logo, flags).
- i18n: JS dictionary for UI strings + category names in all 5 languages; wine names/producers stay original. Language choice persisted in localStorage.
- Structure: language start screen → category navigation (chips/sidebar) → item lists grouped by country where applicable → tap item ⇒ detail view with insights (see requirement above); search + filters as enhancement.
- `qr.html` or generated `assets/qr.png` for the QR code pointing at https://theatrium.list.devinos.hr.
- Serve locally with `python -m http.server` (Python 3.9 is at `C:\Users\Jure Siljeg\AppData\Local\Programs\Python\Python39`).

## Status / TODO

- [x] Scrape site list + identity (fonts, logo URL)
- [x] Parse prices PDF → `data/wines.json` (392 items; 319 wines with insight blocks; PDF archived at `data/source/vinska-karta-2025-12-08.pdf`)
- [x] Download logo to `assets/` (white fill — works on dark bg directly)
- [x] Build app (HTML/CSS/JS, 5-language i18n; descriptor-key vocabulary translated once in `js/i18n.js` — style/body/aroma/pairing keys in `wines.json` must exist there; run a key-consistency check after editing either file)
- [x] Wine detail views with insights (grape, region, style, body, aromas, pairings, serving temp) in all 5 languages
- [x] Local verify (HTTP 200 on all resources, node --check, i18n/data key consistency). Visual check on a real tablet viewport still worth doing.
- [x] GitHub Actions Pages workflow (`.github/workflows/deploy.yml`, deploys repo root); Pages enabled with build_type=workflow; deploy run green. `theatrium` GH environment created — **secrets/vars still empty (need Cloudflare token from owner)**.
- [x] Cloudflare DNS: CNAME `theatrium.list` → `jsiljeg.github.io` created DNS-only (record `76fd1ebd8d55416347dc987d8ac65308`, zone `80ee450e09773979a46dc1336e1ab1a1`). Token stored as `CLOUDFLARE_API_TOKEN` secret + `CLOUDFLARE_ZONE_ID`/`SITE_DOMAIN` variables in GH environment `theatrium`. **Site live over HTTP.**
- [x] HTTPS: Let's Encrypt cert issued (~35 min after DNS; a remove/re-add of the cname retriggered provisioning), `https_enforced=true` set and verified — `https://theatrium.list.devinos.hr` serves 200, HTTP 301-redirects to HTTPS. **Site fully live.**
- [x] QR code (`assets/qr.png`, `assets/qr.svg`, printable `qr.html`) for https://theatrium.list.devinos.hr
- [x] Commit & push to `main`

## Deployment notes (learned 2026-07-21)

- Remote switched to SSH (`git@github.com:jsiljeg/list.git`): the keyring OAuth token lacks `workflow` scope, so HTTPS pushes touching `.github/workflows/` are rejected; SSH pushes work (key authenticates as `jsiljegmrt`).
- Repo was made **public** (was private) — required for GitHub Pages on the free plan.
- `https://jsiljeg.github.io/list/` 301-redirects to the custom domain (expected Pages behaviour once cname is set), so the site is only reachable after the DNS record exists.

## Wine-data conventions (settled 2026-07-27 — follow these, don't re-litigate)

**terroir means the vineyard, and must be evidenced as one.** The recurring
mistake (2026-07-30, caught by the owner four times in a day) is filling it with
the *estate address* — where the cellar is — because that is what a winery's
contact page gives you. Kutina is where Igor Ivanić works, not where his fruit
grows. A source that says "the winery is located in X" is not evidence for X as
a terroir; a source that says "položaj vinograda: X", "they farm ten hectares in
X", or "the vineyard spans X" is. If only the address is known, the producer
record can carry it — that field means the estate — and the wine's terroir stays
`""`.

**region / terroir.** `insight.region` is the appellation ladder, most specific
first; the app appends the localized country, so never put the country in it
(a bare `"France"` produced "France, Francuska"). `terroir` is the named
vineyard/climat/cru **only**, and `""` when the label names none — an explicit
empty string deliberately suppresses the producer-region fallback in
`openDetail()` (`item.terroir !== undefined ? item.terroir : info.region`).

- **France:** `<appellation>, <subregion>, <region>` — `Pommard, Côte de Beaune,
  Bourgogne`; `Saint-Estèphe, Médoc, Bordeaux`; two rungs where the appellation
  is its own côte (`Chablis, Bourgogne`).
- **Italy:** `<comune/subzone>, <denominazione/zone>, <regione>` —
  `Castiglione Falletto, Barolo, Piemonte`; `Marano di Valpolicella,
  Valpolicella Classica, Veneto`. The comune matters most here: Barolo spans 11
  of them.
- **Cru rank stays out of both fields** — the wine name carries "1er Cru" /
  "Grand Cru". Only exception so far: `Les Hauts Pruliers (1er Cru)`, whose name
  doesn't say it. Bordeaux château rankings are château-level, not site-level, so
  they are recorded nowhere (owner's decision).
- **USA:** `<nested AVA>, <parent AVA>, <state>` — `Spring Mountain District,
  Napa Valley, California`; `Yamhill-Carlton, Willamette Valley, Oregon`. Two
  rungs where the AVA hangs straight off the state (`Napa Valley, California`).
  Terroir = the named vineyard (`Monte Bello`, `Geyserville`, `Mae Estate`).
- **Spain:** `<village/subzone>, <DO/DOCa>, <comunidad>` — `Castrillo de la
  Vega, Ribera del Duero, Castilla y León`. Rioja's DOCa *is* the wine region,
  so it stops at two rungs: `Haro, Rioja Alta, Rioja`. Terroir = the named
  finca/viña (`Viña Bosconia`, `Finca Ygay – La Plana`).
- **Slovenia:** `<vinorodni okoliš>, <vinorodna dežela>` — `Goriška brda,
  Primorska`. Terroir = the cru/lega (`Medana Breg`), `""` when the label
  names none.
- **Germany:** `<Gemeinde>, <Bereich>, <Anbaugebiet>` — `Wehlen, Mittelmosel,
  Mosel`; `Ruppertsberg, Mittelhaardt, Pfalz`. Terroir = the Einzellage
  (`Wehlener Sonnenuhr`, `Gaisböhl`), `""` for estate/multi-site bottlings.
  The Anbaugebiet is **Mosel** — "Mosel-Saar-Ruwer" was renamed in 2007 and
  must not be used. Sub-areas use the trade names (Mittelmosel,
  Terrassenmosel, Saar, Ruwertal) rather than the official Bereich names
  (Bernkastel, Burg Cochem), which nobody outside the paperwork says.
- **Croatia:** `<vinogorje>, <podregija>` — two rungs, like Slovenia, from the
  official hierarchy at hr.wikipedia.org/wiki/Vinogradarska_područja_Republike_Hrvatske.
  The *regija* (Primorska / Zapadna kontinentalna / Istočna kontinentalna) is
  deliberately left off: it is administrative and adds nothing a guest wants,
  the same reason France stops above the country. All 79 Croatian wines were
  converted on 2026-07-30 (they carried the podregija alone before). Watch two
  traps: **Skradin is Dalmatinska zagora**, not Sjeverna Dalmacija, and
  **Zelina is Prigorje-Bilogora** while Kutina is Moslavina. **Komarna is its own
  rung** (owner's decision, 2026-07-30) — officially it sits under Neretva, but
  no Komarna estate would put "Neretva" on a label, and the whole point of the
  appellation is that it is not the delta. Vinogorje names
  keep the spaced en-dash the regulation uses — `Voloder – Ivanić-Grad`,
  `Plešivica – Okić`.
- **China:** no appellation system exists, so the ladder is administrative —
  `<county>, <prefecture>, <province>`: `Deqin, Diqing, Yunnan`. Terroir = the
  named villages the fruit comes from (`Adong, Xidang, Sinong, Shuori`).
  Mountain ranges are **not** a rung — "Himalaya" and "Shangri-La" are
  geography and marketing, not places the wine is from (Ao Yun's vineyards sit
  in Deqin County, a different county from Shangri-La City).

**One grape, one stored name** (settled 2026-07-31, from Caroline Gilby MW,
"Malvasia – the first generic wine brand?", jancisrobinson.com 2026-04-14;
copy at `data/source/malvasia-gilby-2026.pdf`). A variety is stored **once**
under one canonical name; each language view renders it under the name that
language's drinkers use, via `LANG_GRAPE` in js/app.js. **The guest's language
wins over the bottle's origin** — a Croatian guest reads "Rebula" whether the
wine is from Brda or Oslavia — because the field says what they are drinking,
and the label is already on the table. The wine's own *name* is never touched
(Damijan's "Malvasia 2018", Simčič's "Sauvignon Vert" are labels).

- **Never a bare `Malvasia` / `Malvazija`.** ~290 varieties share the name and
  most are unrelated; Croatia grows three (Istriana, Dubrovačka, and Maraština/
  Rukatac = Malvasia Bianca Lunga). Canonical here is `Malvazija istarska` →
  `Malvasia Istriana` in en/it/fr/de, `Malvasía istriana` in es, `伊斯特拉马尔瓦齐娅`
  in zh, unchanged in hr/sl. Guarded by a test.
- Don't invent a local form. French/German trade use the Italian name; the
  French-looking "Malvoisie" is one of the ambiguous variants the article warns
  about, so it would be actively wrong.
- **Rukatac** stays Rukatac — it is the Dalmatian label name for a genuinely
  different variety, not a bare Malvasia.
- Open: `Muscat` is stored bare on Geržinić Muškat 2020, and bare Muscat is
  ambiguous too (blanc à petits grains / Ottonel / Alexandria). Needs the label.

**One name for the name that was lost** (owner, 2026-08-01). The Friulano story
is told with **Tokaj** everywhere in guest text — never *Tocai*. The notes used
to mix the two, saying the grape was called "Tocai" and then that Jakot is
"Tokaj backwards", which makes the anagram — the entire reason Prinčič's bottle
is called that — unreadable. Prinčič's note now spells the reversal out in all
eight languages, and a test requires every language of it to name both JAKOT and
TOKAJ. *Tocai* survives only in `SEARCH_ALIAS`, next to tokaj/tokaji/jakot, so
either spelling on a merchant's list still finds the wine. Slovenian renders the
variety as **Jakot** (`LANG_GRAPE.sl`), its official Slovenian name since 2013.
Dates worth keeping: the ban took effect 31 March 2007, out of a 1993 EU–Hungary
agreement; the name Jakot was coined in Collio, and Slovenia adopted it later.

**Friuli is one token, and Croatian says Friuli** (owner, 2026-08-02). The
exonym was tried the other way on 2026-07-31 — "Furlanija" in Croatian, to match
Croatian notes said to use it — and that premise turned out to be false: no
Croatian note or blurb says Furlanija (a grep for the stem finds only Slovenian
text, where it is correct). So Croatian shows **Friuli** and Slovenian keeps
**Furlanija**; "Furlanija" stays in `REGION_ALIAS`, so a guest who types it
still lands on the wines. Guarded by a test.
`Friuli Isonzo` was **removed** from REGION_I18N: it is a DOC, and appellations
are shown as the label spells them; its exonyms moved to `REGION_ALIAS` so
search still reaches them. The ladders were made unanimous — Vie di Romans
`Mariano del Friuli, Friuli Isonzo, Friuli`, Prinčič `Oslavia, Collio, Friuli`
(matching Radikon, who already had all three rungs). Damijan deliberately stays
at two, `Gorizia, Friuli`: he withdrew from the Collio DOC after a tasting panel
judged a wine too dark, and Monte Calvario is his own hill.

**Critic aliases** (2026-07-31): `CRITIC_ALIAS` in js/app.js normalises on the
way to the screen — "Wine Advocate", "RP", "JS" and friends resolve to the
canonical name. The owner pastes what the merchant wrote; the list still says
Robert Parker. The data-spec invariant is therefore *resolves to* a known
critic, not *is* one, and every alias value must itself be on the list.

**Blends:** `Variety NN%, Variety NN%`, name first, descending share. Never
percent-first — `zhTokens`/`langTokens` strip a *trailing* percentage per token.

**Critic names** (exact strings already in use): Robert Parker (never "Wine
Advocate"), James Suckling, Wine Spectator, Wine Enthusiast, Vinous, Decanter,
Falstaff, Jasper Morris, Tim Atkin, Jancis Robinson (always `NN/20`), Lobenberg,
Jeff Leve, Jeb Dunnuck, Jeannie Cho Lee, Stuart Pigott. `+` and ranges kept
(`94+`, `91-93`). Order: 100-point scores high→low, the `/20` entry last.

**Alcohol:** only from a producer tech sheet or an EU/vintage-specific retailer
listing **for that exact wine and vintage**. A neighbouring vintage is not a
source. Conflicting sources ⇒ leave blank and ask the owner to read the label.

**Residual sugar** (`insight.rs`, grams per litre) follows the alcohol rule
exactly: the producer's own sheet, or a listing quoting the analysis for that
exact wine **and vintage**. A neighbouring vintage is not a source, and this is
the field that proves why — Zilliken's Rausch Kabinett measured 48.6 g/l in
2023, 60 in 2019 and 56.5 in 2012.

It is a **string, like `alcohol`**, not a number: `"144"`, `"129.33"`, or a
range `"120–140"` where the producer publishes only one (Ca' La Bionda's
Recioto). Storing a midpoint would print a measurement nobody took. En dash,
matching the serving temperatures — `scripts/lib/rs.mjs` rejects a hyphen, a
unit, a bare number and a reversed range, and both validate.mjs and
data.spec.mjs go through it.

Two sources worth knowing before spending a day searching. **vinmonopolet.no**
analyses everything it sells and prints sugar per listing — it produced the two
Prüms that Prüm themselves refuse to publish. And the **EU nutrition
declaration**, mandatory on wine since December 2023, is producer analysis in
disguise: `4.5 g/100 ml` is 45 g/l, good to ±0.5. Both beat a merchant retyping
a tech sheet — one merchant sheet quoted an alcohol 2% off and a *feinherb*
label against a sugar three times the feinherb ceiling, and was discarded whole.

It is on three wines, which is how many were sourceable out of the 23 non-dry
still wines: both Yquems and Ben Ryé. **Do not spend another day hunting the
rest** — the full record of what was searched and what does not exist publicly
is in `scratch/pairing-research.md`. Prüm publishes no analytics at all, and
neither do any of the five Croatian sweet wines.

And the thing that search established, which matters more than the numbers: a
guest is surprised by an 8% Kabinett labelled *slatko* not because a figure is
missing but because at ~50 g/l it genuinely **is** sweet — past the EU's 45 g/l
line — and tastes off-dry only against 8–9 g/l of acid. Sweetness alone cannot
carry that, and acidity is no better published than sugar. The honest instrument
there is a sentence in that wine's `note`, not another field.

**Notes:** `note` + `noteSig` renders as a signed quote (defaults to "Filho");
`notePlain: true` renders unsigned prose. Large-format twins (`– 1,5 l`,
`– 0,375 l`) are the same wine and must carry identical insight/notes/ratings/tags.

**Vocabulary:** every aroma/pairing/tag key in `wines.json` must exist in
`js/i18n.js` in **all 8 languages** (hr, en, it, fr, de, zh, sl, es), plus zh
tokens in `js/zh-terms.js` for new grape/region names. Run `node scripts/validate.mjs`
after every edit. Both JSON data files round-trip exactly with
`json.dumps(..., ensure_ascii=False, indent=1) + "\n"` and CRLF — edit them
structurally in Python, not by string surgery.

**Producer blurbs:** written per **estate**, not per flagship — a guest must not
read about a wine we don't pour, and every wine on the list should feel covered.
Naming the flagship is good (it upsells) as long as it doesn't stand in for the
house. Keep the Filho voice: vivid, honest, punchy — never a neutral list of
grapes. Croatian keeps grape names as on the label (**Cabernet/Caberneta**, not
"kabernet"); "rizling" was left as-is (accepted Croatian) — owner may revisit.

**Figures, not words** (owner, 2026-08-04). Write `25 godina`, `62.000 litara`,
`12.000 €`, `8 godina u bačvi`, `26 naraštaja` — never "dvadeset i pet godina".
The reason is length: a card is scanned standing up, and a numeral is one glyph
where the word is eleven. It applies to quantities, years, prices, areas,
altitudes, counts and durations, in every language. Ordinals stay words where a
figure would read oddly (`prva berba`, `četvrti Egon`), and a number that is
part of a name or an idiom is left alone.

Applied to the ~30 blurbs rewritten on and after 2026-08-04. The older ones
still spell some numbers out; a sweep is worth doing but has to be per
language, because each spells them differently — don't try to regex it across
all eight at once.

**One story per card, not a CV** (settled 2026-08-05, from the owner asking
whether there is a character limit). There isn't one, and the measurement is
why. The blurb the owner loved most — Quintarelli — is **577** characters. The
one he called *tiring to read* — the old Bürklin-Wolf — was **813**. Vouette
works at 421 and Salon at 408. Length is not the variable.

**Distinct years are.** Quintarelli names one (1950) and spends the rest on one
man: waits 8 years, refuses the Dutch queen over a car with no air
conditioning, draws his labels by hand. Old Wolf named six — founded 1597,
married 1875, took over 1990, certified 2005, classified 1994, tax map 1828 —
and not one of them led to the next. That is a CV, and a CV is tiring at any
length. Cut to two years it reads fine at 543.

So the rule is **one story, one date**. A second date is allowed only when it
is the *payoff* of the first (Wolf: the 1828 survey → the 1994 classification;
Knebel: the father dies in 2004 → the son returns in 2008). Obey it and the
length lands at 350–550 Croatian by itself. Past ~600 almost always means two
stories were merged: cut one, don't trim adjectives. French runs ×1.18 and
German ×1.14 against Croatian, so a 550 hr blurb is ~650 fr.

`scripts/validate.mjs` prints a **note** — never an error — for a blurb over
600 hr characters or with 4+ distinct years. It is a smell, not a rule a
deploy should enforce; the owner overrides it whenever the story earns it.

**The blurb owes the guest no facts at all.** Measured on the real card: the
winery section starts **711 px down a 906 px card** on the 1024×768 tablet, and
831 px down on the phone — the guest sees the heading and nothing else without
scrolling. Everything they *need* (grape, region, body, alcohol, serving
temperature, aromas, food, price, Filho's note) is already above it. Nobody
reaches the blurb by accident, which means it must never repeat the grid and
has exactly one job: make the bottle feel worth the money.

**The test for what goes in: would a guest say this out loud to the person
across the table?** "Osnovano 1597." — nobody has ever said that to anyone.
"Odbio je prodati boce kraljici jer je auto bio bez klime" — everybody says
that. This is not a balance between erudite and trivial; it is a filter.
Erudition earns its place only as the **setup for a payoff**: the 1828 tax
survey is textbook alone and lands only because it pays off in "the taxmen had
missed very little". Research everything, print the payoff.

The shape the three best cards share: **a person, a decision that cost them
something, and a line that lands.** Never founded → generations → hectares →
certifications. And an award is a badge, not a story — VINUM's Mosel winemaker
of the year came off Knebel's card for flattening it.

**Cross-references earn their place.** Several houses on this list are
connected, and a guest who spots it remembers both cards: Eva Clüsserath runs
Weingut Wittmann with her husband; Dal Forno went to Quintarelli for advice;
Gambelli made the wine at both Montevertine and Poggio di Sotto; Piero Antinori
talked his neighbour into selling Sassicaia and his brother founded Ornellaia;
Budinski's own OMO sits a few cards from the Erdoro he makes; Soldera and
Poggio di Sotto are the two Montalcino "first growths"; Alessandro Castellani
trained at Isole e Olena. Name the *other estate*, not just the person — "Eva"
told nobody anything until it said Clüsserath.

## Session state 2026-07-27 — resume here

Done today: Croatian + French + Italian **red** passes (alcohol, blends, critic
scores, aromas, region/terroir rework), the scroll-to-top fix for the detail
sheet, and a sweep of all 79 multi-wine producers whose blurbs described only one
wine (17 rewritten — full from/to in `docs/producer-blurb-changes.md`).

**Next up: continue with reds.** Wines still missing `insight.alcohol`, by
country: **US 13** (Ridge Geyserville + Cabernet, both Togni, Heitz, Mayacamas,
Domaine Eden, Cakebread, Duckhorn, Tyler, Résonance, Occidental, Walter Scott),
**IT 10** (Pira & Figli Barolo 2018, Isole e Olena Cabernet 2013, Piane 2019,
Tignanello 2019, both Valpolicella Superiore, both Montevertine, Duemani 2018,
Soldera 2020), **HR 7**, **FR 7** (all five Lignier reds, NSG Les Hauts-Pruliers
2016, both Desjourneys Beaujolais), **ES 5**, **SI 3**, **CN 1** (Ao Yun 2018).

Open questions for the owner:
- Desjourneys Beaujolais 2022/2023 ABV — 13% in 2020 and 2021, unverified for ours.
- Whether "rizling"/lowercase "chardonnay" in Croatian blurbs should become
  Riesling/Chardonnay, as "kabernet" did.
- Five blurbs that name an estate wine we don't stock (Benvenuti/Teran,
  Ca' La Bionda/Valpolicella, Geržinić/Malvazija, Tomaz/Malvazija, Niko
  Bura/Dingač) — reported, deliberately left alone.

## Tests (added 2026-07-30) — write them, but don't run them unasked

**Standing rule (owner, 2026-07-31): do not run the suite unless the owner asks
for it.** It takes ~8 minutes across three viewports and blocks the session for
all of it; the owner would rather ship the change and decide when a regression
run is worth the wait. Still *add* a test with every fix (see below) — say in
the commit and the reply that it was added and not run, and offer the command.

`npm test` runs a Playwright regression suite across three viewports; `npm run
check` adds the syntax and data checks. **It does not gate the deploy** — owner's
call, 2026-07-30: a data edit should be live in a minute, not after a browser
run. When asked, run it against the working tree, or against an older commit to
find where a regression came in:

    npm test                                  # this working tree
    gh workflow run test.yml --ref main       # on GitHub, on demand
    git checkout <sha> && npm ci && npm test  # a past commit

The deploy keeps the cheap guards: `node --check` on every script and
`scripts/validate.mjs`.

**Standing rule (owner, 2026-07-30): every bug we hit from now on gets a test in
the same commit as the fix.** Not later. The test goes in the spec that owns that
area, with a comment naming what it caught.

Every spec names the commit it guards in its header comment. See `tests/README.md`
for the table of what is covered. Three things worth knowing before adding one:

- **Test the edges, not the middle.** The first swipe tests ran down the centre
  of a phone, passed, and hid completely dead gutters on the tablet.
- **Gestures need real input.** `swipe()` in `tests/helpers.mjs` goes through CDP
  and therefore the browser's own touch pipeline. Synthetic `TouchEvent`s bypass
  `touch-action` and will pass on a broken app.
- **Measure ink, not boxes.** `.detail-name` is a full-width block whose text
  stops well short of the glass icon; comparing `getBoundingClientRect()` reports
  overlaps nobody can see. Use the `Range` pattern in `detail-sheet.spec.mjs`.

Two things the suite already found while being written: `assets/glass-syrah.svg`
was dead (removed), and `producers.json` is keyed by *short* forms which
`producerInfo()` resolves by longest containing substring — so an exact-key check
reports forty-seven false orphans.

## Looking at the app (added 2026-07-30)

`scripts/shot.py` boots a throwaway static server and a headless Chromium and
screenshots the app, so **visual work no longer has to be done blind** — the
jsdom harness proves structure but never paints, which is how a too-bright
watermark and a motif that read as a CJK character both shipped.

    python scripts/shot.py                    # 6 states x 3 viewports
    python scripts/shot.py story --vp tablet  # one state, one viewport
    python scripts/shot.py --out shots/before # a set to diff against

States: `start story list detail ikone search`. Viewports: tablet 1024x768,
laptop 1440x900, phone 390x844 (2x DPR, reduced motion). It also reports page
and console errors per viewport. Then **Read the PNGs** — that is the point.
Needs `python -m pip install playwright` and `python -m playwright install
chromium` (~114 MB, already installed here).

For taste calls, override CSS in-page with `page.add_style_tag` and montage the
variants into one image rather than editing the stylesheet per attempt.

## The first paint is not the font you designed in (2026-08-02)

Markazi Text and Raleway load from Google with `display=swap`, so **every first
visit paints in a local fallback** and swaps a beat later. Georgia sets the same
string **34% wider** than Markazi at the same font-size, so the language screen's
"Odaberite jezik · Choose your language" landed oversized — often not fitting —
and then visibly snapped smaller. The owner saw it on a laptop and expected it on
the tablet too; it was on every device and every cold load.

The fix is metric-override fallback faces in css/style.css — `local("Georgia")`
and `local("Times New Roman")` squeezed to Markazi's advance width and its
ascent/descent, so the swap changes the letterforms and nothing else. Measured
413px against the real font's 416px, from 539px before. `scripts/font-metrics.py`
prints the numbers; re-run it if a font in either stack changes. Raleway needs no
such face — its fallbacks are within 3%.

Two things worth keeping: the drift is only visible with the network in the
picture, so the test blocks `fonts.gstatic.com` and compares the two paints
rather than trusting the stylesheet; and `font-display: optional` is *not* the
alternative — it would leave a first-time guest in Georgia for the whole visit.

## The two nail sculptures (settled 2026-07-30)

Both are used **recoloured, never redrawn** — `scripts/nail-asset.py face|bowl`
turns the coloured wall (cobalt behind the face, red behind the bowl) charcoal
and the metal gold, with each pixel's brightness deciding its gold, so the
modelling survives. Sources in `data/source/atrium-{face,bowl}-source.*`.

Redrawing them as SVG strokes was tried twice and failed both times, for
different reasons worth remembering: the **face** is legible only through how
nails *cluster*, which independent strokes cannot make; the **bowl** has no
silhouette that survives abstraction — a closed oval with marks radiating off it
reads as an eye or a sun, and the side-on saucer that shipped read to the owner
as a smiling mouth. Photographs, not glyphs.

The bowl mark is **gone** (2026-07-30, owner's call) — `assets/atrium-bowl.webp`
deleted, source photo and the `bowl` recipe in nail-asset.py kept so it can come
back with one command. What follows was true of it and stays true of the face.
Recoloured lace needs room: the mark held together down to 160px at .7 opacity,
the floor, and it only holds there because both
assets are rendered at the source's own width with a **tight** saturation window
(.34-.44, not .30-.52). A wide ramp feathers every nail edge; at 1:1 the face
was visibly soft with it and resolves individual nails without it, and at the
.32 watermark opacity the outer scatter survives either way. Unsharp masking on
top only speckles the shadows. Never upscale past the source: the face asset was
1200px from a 1084px photo, which cost sharpness for nothing. The **grape** section ornament stays a drawn SVG —
it is an arrangement of nails, not a picture of a sculpture.

The face is a background on `.story-screen::before`, which is `display:none`
until a language is picked, so it must stay in the `<link rel="preload">` in
`index.html` — without it the fetch only starts at the tap and the splash lands
bare.

**The citrus in the water ornament is a *half* slice** (owner, 2026-08-02: the
glass read fine, "the fruit is not a bit clear it's fruit"). The first version
was a whole round — spokes radiating from one shared centre inside a ring of
dashes — and it failed twice over. Every spoke met at a single point, which is
a sunburst or an asterisk and not segments; and a round thing with marks inside
it is exactly what killed the nail bowl, an eye or a sun. Cutting it in half
answers both at once: the flat cut edge across the top breaks the radial
symmetry, and the segments fan down from *along* that edge, stopping short of
it, so nothing converges. Five drawings were rendered side by side at
18/24/32/48/130px and looked at — the wedge read as an arrow, a denser disc and
a rosette both read as a flower, the half slice read as fruit at every size.
A test now fails any ornament where three strokes share a point. The lesson
generalises: **in this set, radial symmetry is the enemy of legibility** —
the grape works because its rows are irregular, the alembic because it is two
unequal masses joined by an arc.

## Glass icons: measure, never eyeball (settled 2026-07-30)

`GLASS_ICONS` in `js/app.js` are traced from product photos of the house
stemware. Both glasses the owner sent a photo of turned out **wrong in the same
direction** when they had been drawn by eye — too narrow at the shoulder, and
ending in a hard V where the real bowl tapers gradually into the stem. So:

    python scripts/trace-outline.py photo.png --marks

scans the silhouette row by row (leftmost/rightmost pixel beating that row's own
background median) and reports the two numbers that get guessed wrong:
**rim / widest** — .64 on both glasses measured so far, where every eyeballed
attempt drew .75, which is a white-wine tulip — and **where the bowl merges into
the stem**, 57-65% down rather than the ~45% a drawn V implies.

Then map photo pixels into the viewBox with one uniform scale and **verify by
overlaying the candidate path back on the photo at that exact offset and
scale**. A stretched overlay flatters a wrong curve; one glass was approved off
a mismatched one and had to be redone. The icons are all drawn to a single 60px
height, so a glass that is genuinely wider gets a wider viewBox (the red cone is
46 against the others' 40) rather than different CSS.

Which glass a bottle gets is finally a sommelier's call, not a grape rule:
`insight.glass` in `wines.json` overrides `glassFor()` for a named wine (Grimalda
and Ottocento Crni are Merlot on paper but Istrian blends in the wide glass).
Prefer the override to widening the regex — a strict "all grapes Bordeaux" rule
was tried and wrongly flipped Solaia, Tignanello, Ao Yun and Boca as well.

**The two Winewings reds** follow Riedel's varietal lists: Pinot Noir and
Nebbiolo to the Burgundy bowl, Cabernet and Merlot to the Bordeaux cone. Both are
250mm tall on a 100mm foot and 117/115mm across, so the millimetres alone would
draw the same icon — the difference is in the wall, and only a row scan finds it:
the Cabernet widens at a steady 2px per 6 rows the whole way down (a straight
cone) while the Pinot races out at the shoulder then holds dead level for thirty
rows. The Pinot's bowl also ends higher, 51% of the glass against 55%. The
dominant grape decides, and blends led by a third grape fall through to the
Bordeaux glass on their Cabernet/Merlot component — which is where Riedel puts
Sangiovese anyway (Brunello is on its Bordeaux list).

Riedel's Bordeaux list is now read literally, so **Kratošija** brings Zinfandel,
Tribidrag and Primitivo with it (Plavac mali is Tribidrag's *offspring*, a
different grape, and stays on the cone), and **Brunello** is matched as
Sangiovese from Montalcino — which also picks up Soldera's Case Basse,
declassified in name but the same wine from the same hill. Beaujolais Cru is the
one Riedel-listed red still on the cone.

**Orange takes the wide Chardonnay bowl** (owner's question, 2026-07-31), as a
`style === "orange"` rule rather than eleven overrides, because the whole style
moves. Nobody publishes an orange shape — `riedel.com/en-int/wine-glass-guide/
orange-wine` is a 404, and their Ribolla Gialla and Friulano pages describe
light unoaked whites, i.e. the grape as it reads when nobody macerates it, so
those entries are not a ruling on ours. The evidence used instead is the
Winewings Chardonnay varietal list — "…Friulano, Fumé Blanc, … Pinot (Blanc,
Grigio, Gris), … Ribolla Gialla, … Sauvignon Blanc (oaked)…" — which covers
seven of our eleven. The other four (Malvazija ×2, Ottocento's Istrian blend,
Vitovska ×2) Riedel lists elsewhere or not at all (Vitovska 404s too); the
count said twelve until 2026-08-02, when Casa Rojo's "Orange Republic" turned
out to be a *name*, not a style — its own tech sheet describes classic white
vinification on lees, and the record correctly says `white_mineral`. Splitting
the style at the four Riedel does not list
would be an arbitrary cut dressed as evidence. Not the red `burgundy` cone: the
grip is tannic but the aromatics are a white's, and it would file orange in with
the reds visually. Serving temps were already 12–14 °C and needed no change.

**Riedel's own guide answers the Chablis question**: the Performance/Veloce
Chardonnay is listed for "Burgundy (white), Chablis, Chardonnay (oaked),
Corton-Charlemagne, Garnatxa Blanca, Meursault, Montrachet, Morillon (oaked),
Pouilly-Fuissé" — so Riedel puts *all* Chablis in the wide glass, not only Grand
Cru. All eight Chablis now carry `insight.glass: "chardonnay"` — an override rather
than a style retag, because they are `white_mineral` and steely is what they
are; only the glass changes. Riedel has **no Viura or white-
Rioja shape at all** — the guide has no entry — so Gravonia and Capellanía are
on the Riesling glass by the owner's call, not by a Riedel listing.

A maker's dimensioned drawing beats a photo where one exists: both Riedel Veloce
whites are 247mm tall, so their **92mm** and **113mm** bowls set the icons'
viewBox widths (42 and 50) directly, and the real size difference survives into
a 60px icon. Every glass in the set is now traced from a reference; none is drawn from the
eye. The sweet glass is the narrowest — a quarter of its height across the bowl
against the flute's third, belly high, bowl only 45% of the total height over a
very long stem. It no longer relies on being drawn *small* to read as the dessert
glass, which stopped working once every icon was normalised to one 60px height.

The wide Chardonnay glass is the oaked-white glass: `white_rich` only, which is
the white Burgundy shelf plus the barrel-aged Viura, Savagnin and Alsace Pinot
Gris beside it. Steely Chablis (`white_mineral`) and unoaked Chardonnay
(`white_fresh`) take the Riesling glass.

## Spirits get cards too (2026-08-01)

The whole spirits shelf — 63 bottles across `spirits` and `rakija-beer` — was
name-and-price only. It now carries insight cards like the wines, driven by
`insight.kind === "spirit"`, the single switch in `openDetail()`; no `kind`
means wine, which is what all 365 wines already say by saying nothing.

**The vocabulary lives in `js/spirits.js`, not `js/i18n.js.`** A spirit answers
different questions: `base`, `still`, `cask`, `age`, `serve`, and a `class` that
replaces the wine style line. Those are eighty-odd keys × 8 languages, and
folding them into i18n.js would have doubled a file that serves ten times as
many bottles. What the two share — aromas, pairings, countries, the note — still
comes from i18n.js, and `SPIRIT_I18N[lang].aromas` is read *before* `t.aromas`,
so peat and koji can be added without touching the wine dictionaries.
`validate.mjs` fails the deploy on an unknown key, same as for wines.

- **Countries were added to i18n.js**, not to the spirit file: SCT, IE, JP, TW,
  MX, JM, HT, BB, GD, AU, CH, LV. That keeps the region line, the search
  haystack and validation branch-free. No flags are drawn for them —
  `COUNTRY_FLAGS` misses gracefully, and Barbados' trident is not worth hand-drawing.
- **`country` may be `""`** for a spirit, unlike a wine: Veritas is a
  Barbados-and-Jamaica blend and belongs to neither.
- **Terroir is suppressed on a spirit card outright.** A distillery's address is
  not a vineyard, and printing one under that heading is the exact error the
  terroir rule exists to prevent.
- **Search needed teaching.** A spirit has no grape, so "rum", "mezcal",
  "Islay" and "mizunara" matched nothing until `itemHay()` started pushing every
  language's rendering of class/base/still/cask into the haystack.

**The vessels are drawn, not traced — with one measured rule.** There is no
photo of the house tumbler, so unlike the wine glasses these are the standard
geometries. That is defensible where a wine glass is not: a wine shape encodes a
claim about a grape, a rocks glass is a cylinder. But **the viewBox aspect must
be the vessel's real aspect**, because every icon is normalised to one 60px
height and the width is the only thing left to carry the shape. Drawn without
that rule the highball came out 4:1 and read as a test tube and the tumbler 2:1
as a short vase; at the real 150×65 and 90×85 they are unmistakable. The wine
glasses already obey it (Veloce: 247×92mm, viewBox 42×100). Millimetres and
viewBoxes are in the file header. `scripts/shot.py` has a `spirit` state, and
`PW_CHROMIUM` points it at a Chromium whose build the installed playwright
package doesn't match.

**A house story goes in producers.json, never in the note.** Six of them were
first pasted onto every bottle their house makes, so a guest tapping three
Mulassanos read the same paragraph three times. Distillery blurbs now exist for
Wise Grus, Clairin, Hampden, Lorenzo Inga, Kavalan, Mulassano and Foursquare;
the note is what distinguishes *that* bottle. Guarded by a test. Adding the
Clairin record also fixed a live bug: `producerInfo()` matches by longest
containing substring, and "Clairin" contains "Clai", so all three Haitian rums
were showing Giorgio Clai's **winery** blurb.

**Alcohol follows the wine rule** — printed on the bottle or a producer sheet,
otherwise blank. Left blank on purpose: Kavalan Solist and the Whisky Sponge
Jura (single casks, per-cask strength), Hampden Great House 2024, the three
clairins, Bruxo, Redemption (the list doesn't say rye or bourbon), and most of
the Wise Grus range. Open questions for the owner: whether "Papalin 7Y" is the
Haiti or the Jamaica blend (recorded as Haiti), and what "LMDW Australia 2014"
was distilled at — the label was not to hand, so the record names only the
bottler.

## The library split (2026-07-31) — where the data lives now

`data/wines.json` is **gone**. In its place:

- **`library/wines.json`** — `{"wines": {"<ref>": {...facts}}}`. What a wine
  *is*: name, producer, insight, terroir, note, ratings, tags, music, nameI18n.
  Venue-independent, and the only place research goes.
- **`lists/theatrium.json`** — the section/category/group tree, with items as
  `{"ref", "price", "recommended"?, "new"?}`. Those three fields are the
  complete list of what a venue decides (`VENUE_FIELDS` in split-library.py).
- Joined in the browser by `mergeList()` in `js/app.js`, and for tooling by
  `scripts/lib/list.mjs` (JS) / `scripts/winedata.py` (Python). **No build
  step** — 365 wines merge in under a millisecond and the site stays plain
  static files. The two merge implementations are duplicated on purpose; ten
  lines of spread syntax is cheaper to keep in step than a build would be.

`ref` is `slug(producer)--slug(name)`, diacritics folded (`đ`→`d` needs the
explicit map; it has no NFKD decomposition). A wine poured by the glass *and*
sold by the bottle is now **one entry referenced twice** — 24 such duplicates
collapsed, and with them the whole drift bug class the large-format-twin rule
exists for. The migration found one already live: `Meneghetti White 2023` vs
`Meneghetti white 2023`.

**The warrant:** `python scripts/split-library.py --check` rebuilds the old file
from the two halves and diffs it against `data/source/wines-presplit.json`
(frozen at 4893df1). It printed *identical* at migration time. It will stop
matching the day the list legitimately changes — that is expected; the snapshot
has done its job by then. Don't "fix" it by regenerating the snapshot.

An **unresolved ref fails the deploy** (validate.mjs). It has to: the wine is
priced and on the shelf, and it silently doesn't render. An **orphan** — a
library wine no list pours — is only a `note`, because that is the normal state
once a second venue exists.

## The 86 board — admin.html (2026-07-31)

`admin.html` + `js/admin.js`: a switch per wine, writing `data/unavailable.json`
through the GitHub contents API. Staff-facing, deliberately not sharing
`css/style.css` with the guest app.

**Security, stated once so nobody assumes more.** The repo is public and this
page ships with it. The **PIN (`const PIN` in js/admin.js) is a screen lock**,
nothing more. The **token is the only credential** — fine-grained, `jsiljeg/list`
only, Contents: Read and write, held in that tablet's localStorage. Worst case
if a tablet walks: someone hides and unhides wines on our own list, and
revoking takes a minute. Don't "improve" this with a hashed PIN; it would only
look like security.

**The receipt is the feature**, not the switch. A switch you don't trust is
worse than editing JSON, because typing JSON at least feels like it did
something. Three stages: saved → published → on the tablets. Stage 2 is
**verified by re-fetching the deployed file until it matches**, never assumed;
stage 3 counts out the 30 s poll window.

**Writes go through a queue, and nothing is ever locked.** The first build
disabled every switch until the whole receipt had run — ~40 s per wine, so you
could not 86 three things at once, which is exactly what happens mid-service.
Now a flip lands in `rules` optimistically, queues a message, and one worker
drains it, always sending *current* `rules` rather than a snapshot. Both
`waitForPublish()` and `countdown()` **abort the moment `queue.length` goes
non-zero** — the countdown is a progress bar, not a lock, and it was making
un-hides wait 30 s, the one thing that must never be slow.

**A 409 does not retry over the top.** Another tablet wrote since we read:
re-read, re-render, and say so. Losing the flip just made costs one tap;
silently erasing someone else's change does not announce itself.

Wines listed by the glass *and* by the bottle get two extra buttons writing
`where`, because an open bottle running out is not the wine running out.

Testing it needs no token: `tests/admin.spec.mjs` intercepts `api.github.com`
with an in-memory file. Scope that route by **origin** — `**/data/unavailable.json*`
also matches the GitHub contents URL, which silently feeds the page the wrong
shape.

## Out of stock tonight, back tomorrow (2026-07-31)

`data/unavailable.json` is the 86 list: `{"hidden": [{"producer", "name",
"where"?, "since"?, "reason"?}]}`. `dropHidden()` in `js/app.js` rebuilds `DATA`
from it **at load, before anything indexes into it** — that is the whole design.
Every detail sheet opens by an `si/ci/gi/ii` path into `DATA`, so filtering in
the renderer instead would open the wrong wine off the card below a hidden one.
Groups, categories and sections left empty are dropped with it; hiding
*everything* is treated as a mistake and falls back to the unfiltered list.

Two deliberate choices: it is a **separate small file**, because the owner needs
to see the current state of the gaps at a glance and re-pour a wine by deleting
one line, not by hunting through 12k lines of `wines.json`; and `scripts/validate.mjs`
**fails the deploy on a rule that matches nothing**, because a typo means the
owner believes a wine is hidden while the guest is still being offered it.
`where` is `"glass"` | `"bottle"` (a bottle-* section), omitted = everywhere —
the same wine is often in both. Owner docs: UREDIVANJE.md, "Privremeno sakriti
vino".

**Polling (2026-07-31).** The app read its data once at load, so nothing was
live: a tablet a guest was *reading* never reloaded, and a wine 86'd at the
start of a long browse could still be ordered at the end of it. `pollData()`
now re-reads `unavailable.json` **and library+list** every 30 s, plus once on
`visibilitychange`. A corrected note or price is live within the minute.

Two traps here, both paid for:

- **`cache: "no-cache"` on every data fetch** (`fresh()`), not just inside the
  service worker. GitHub Pages serves everything `max-age=600`; the SW rewrites
  requests the same way, but it is only in charge once it has installed and
  claimed the page — not on a first visit, and not straight after its own
  update. An uncontrolled page read a **ten-minute-old** file out of the browser
  cache without asking, which is exactly what "my edit didn't go live" looked
  like on the owner's laptop.
- **Change detection compares bodies, not ETags.** ETag was the first attempt
  and looked right against Pages, which sends one — but `tests/serve.mjs` does
  not, so the check silently did nothing for ever. A 304 is answered from the
  browser cache, so `text()` is a local read: comparing 300 kB of string costs
  nothing on the wire.

**Code still needs a reload.** app.js, i18n.js and SEARCH_ALIAS cannot be hot
swapped into a running page; they ride the 3-minute idle reload.

Three things hold it together. `FULL` keeps the merged list with nothing
hidden, and every poll re-derives `DATA` from it — filtering `DATA` in place
would make unhiding impossible without a reload. A change arriving while a
detail sheet is open is **queued in `pending` and flushed by `hideModal()`**,
never applied under the sheet: sheets are si/ci/gi/ii paths into `DATA`, and the
‹ › arrows would start stepping onto the wrong wines. And `applyUpdate()`
restores `window.scrollY` after the re-render, because `renderContent()` rebuilds
the column and would otherwise throw a reading guest back to the top.

## Search matches word starts (2026-07-30)

`hayMatch()` requires the query to land at the start of a word, not anywhere
inside one. Plain substring matching turned "burgun" into 94 hits, because
SEARCH_ALIAS feeds every Pinot its German names and *spät*burgunder,
*grau*burgunder, *weiss*burgunder and *blau*burgunder all contain it — a guest
after Burgundy got the whole Pinot family instead of the 51 Burgundies. Typing
those names in full still finds them. CJK queries have no word boundary to
anchor to and fall back to substring.

## Search aliases: appellations, not grape synonyms (2026-07-30)

`SEARCH_ALIAS` widens the haystack, and a synonym that is *also* an appellation
must not be filed under the grape. "brunello" sat on `sangiovese`, so a guest
typing it got eighteen Tuscan reds of which four were from Montalcino. It now
lives only on `montalcino`, which is the place the guest means — and that alias
also reaches Case Basse, whose label never says Brunello. Same test for any
future one: does the word name a grape everywhere, or a place?

## A wine's style is searchable, and wines outrank spirits (2026-08-02)

The haystack knew what a spirit *is* — class, base, still, cask, in all eight
languages — and nothing about what a wine is beyond its name, producer, grape
and region. So "orange", "narančasto" and "macerirano" returned **nothing**,
while "macerat" returned thirteen gins, vermouths and liqueurs and not one of
the eleven orange wines. `itemHay()` now pushes `styles`/`bodies`/`sweetness`
through every language, the mirror image of what it already did for spirits.

`STYLE_ALIAS` sits beside `SEARCH_ALIAS` for the words the style strings don't
contain. They are written to be *read on a card*, not typed: the Croatian
orange style reads "Macerirano bijelo · odležano na kožici", and not one of the
eight says "amber". Two things decide what belongs in it — **stems**, because
`hayMatch` anchors at a word start, so "maceration" answers a query of
"macerat" and "macerirano" answers "macerir" but neither answers the other; and
**both spellings** of anything accented, since the fold only applies to a query
that carries no diacritics of its own.

**Search results come out in two blocks: wines, then everything else.** It was
incidentally true before, from section order alone; it is now explicit, because
that is the answer a wine list owes the question. A wine is `insight && !kind` —
the same single switch `openDetail()` reads — so water and the soft drinks,
which have no insight at all, sit in the second block with the spirits.

## The search box answers in four blocks (2026-08-02)

Everything the card prints is now typeable, which for a *restaurant* list meant
one large gap: **aromas and food pairings were searchable nowhere**. Twenty of
twenty-two food words a guest might type - "janjetina", "tartufi", "kamenice",
"prsut", "biftek" - returned nothing, though every one was already translated
into eight languages two files away.

`itemHay()` therefore builds **two** strings, and `itemCore()` exposes the
first:

- **core** - what the wine *is*: name, producer, grape, region, terroir,
  country, style, sweetness, tags, critic names, plus SEARCH_ALIAS and
  STYLE_ALIAS.
- **flavour** - what it tastes like and goes with: aromas and pairings, in all
  eight languages, plus PAIRING_ALIAS.

Results come out in four blocks: wine-core, wine-flavour, other-core,
other-flavour. Wines before spirits is the owner's rule; identity before
flavour had to follow it, because the moment aromas became searchable "orange"
matched both the eleven orange wines and every wine with orange peel in its
nose, and the weaker sense buried the stronger.

**Body is deliberately excluded.** It went in with style and sweetness and was
measured back out the same day: "srednje puno" contains "puno", so a query of
"puno" returned 276 of 308 wines, and English "medium" begins with "med", so a
Croatian searching for honey got 130 wines that merely have a body. Every match
correct, every match useless. "Lagano" still works through the style string.

Three alias tables, each for a different failure:

- `SEARCH_ALIAS` - grape and place synonyms, applied to core only.
- `STYLE_ALIAS` - words for a *shelf* that the card strings don't contain,
  because those are written to be read, not typed ("amber", "skin contact",
  "pjenusac", "bijela vina").
- `PAIRING_ALIAS` - food words the stored phrasing misses. `hayMatch` anchors
  at a word start, so "jela s tartufima" answers "tartufi" by luck of Croatian
  morphology while "truffle dishes" does not answer "truffles".

**Both halves are labelled, and both carry a count.** The owner asked whether
aromas belong in search at all; they do, but a guest who typed "orange" and got
45 rows had no way to know the first twelve were the answer and the rest merely
smell of it. Labelling only the second half fixed that and created the next
question - what is the *first* group, then? So now:

    REZULTATI                  12
    PO AROMI I SLJUBLJIVANJU   33

A count explains a group better than a noun does, and it dodges Slavic plural
agreement completely: "Rezultati · 12" needs no concord, while "12 vina / 1
vino / 21 vino" needs three rules and gets one of them wrong. Headings are
always on, so the layout is something a guest learns once.

The test for whether a field belongs in search at all: **does the word narrow
the list?** Body fails it (three values across 308 wines, so "puno" returns
276). Aroma passes (10-85 wines). Food passes, and it is the question a
restaurant guest actually has.

**How to find the next gap: type what a guest would type and count.** That is
how all of the above was found - a battery of ~250 queries across grapes,
regions, colours, countries, foods, aromas, badges, producers and formats, with
every zero investigated. A zero is only a bug if we pour the thing: "viognier",
"priorat" and "vega sicilia" correctly return nothing.

## Descriptor capitalisation (settled 2026-07-30)

The style line reads `Crno · srednje puno · suho`: **sentence case across the
whole compound** — first segment capitalised, every later segment lowercase —
because the segments are one descriptor, not a row of labels. This is what the
`styles` strings already did (`Bijelo · svježe`); `sweetness` was the odd one out
and is now lowercase in all eight languages. It is also the only rule that
survives German, where the adjectives (`trocken`, `halbtrocken`) are lowercase
anyway but `Champagner` must keep its capital — a blanket Title Case would break
it and a blanket lowercase would break the nouns. Proper terms keep their own
capitals wherever they fall: Champagne, Blanc de Blancs, and the dosage (`Brut`),
which is a label term rather than a description.

## The sommelier: what it scores, and what it can answer with (2026-08-02)

`dishScore()` is three points per pairing the wine and the dish share, three
for the style, one for being one of Filho's picks. That has not changed. Two
things around it did.

**One list at a time, and the glass offered quietly.** This took three goes and
the first two are worth remembering as things not to do again.

  1. It searched `bottle-*` only, so it could answer nothing but a whole
     bottle - useless to the guest most likely to ask (one person, one dish),
     and it ignored the shelf the owner curates hardest: 28% of the
     by-the-glass pours are picks against 9% of the bottles.
  2. So it showed two glasses *and* three bottles under two headings. The owner
     called it "super confusing": the step said "boca" three times, then the
     answer showed bottles and then a glass, and the glass was the same wine
     under every price band - because a bottle budget says nothing about a
     glass. It read as an error.

What stuck: **the budget question is the four bands it always was, and the
answer is three bottles and nothing else.** The glass appears two ways, neither
of them a second list:

  - **on the row**, when the suggested bottle is also poured by the glass -
    `🍷 i na cašu 8 €` under the producer. 24 of the 32 pours are sold both
    ways, and at least one of the three suggestions carries the line in 57% of
    dish x band combinations. It upsells the wine the guest is already reading,
    which is the only upsell that does not feel like one.
  - **one link underneath** - "Radije na cašu?" - which flips the whole answer
    to four pours, and back. `helperState.mode`, reset to bottle whenever the
    helper opens.

`GLASS_PRICE` memoises producer|name -> glass price and **must be cleared
whenever DATA is rebuilt** (both the initial load and every poll), because a
wine can be 86'd off one shelf and not the other - and an advertised glass that
is not being poured is worse than no offer.

**Three rows either way, frozen, and the two lists do not overlap.** Three so
the flip never resizes the sheet under the guest. Frozen — `helperState.picks`,
keyed by dish|budget — because the scoring carries a random tie-break, so
recomputing on every flip reshuffled the bottles behind the guest's back; the
link has to be a toggle, not a reroll. And the glass list skips whatever the
bottle rows already advertised inline, topping back up from the skipped ones
only if that would leave fewer than three: showing the same wines again is not
three more options.

**The pairings were researched against published sources, dish by dish and
grape by grape** (2026-08-02). The findings, with what each one changed, are in
`scratch/pairing-research.md` — read that before re-litigating any of it.
`scripts/lib/grape-foods.mjs` holds the grape->food reference it produced;
`scratch/grape-audit.mjs` reports what a wine's grape suggests that the wine
does not claim, and the reverse.

Three things worth carrying forward:

  - **A publication's taste is not a clash rule.** I wrote that `white_mineral`
    was too coarse because World of Fine Wine likes Chablis with Schnitzel and
    dislikes dry Riesling, and both live in that bucket. The owner pushed back
    and was right: both wines genuinely *are* mineral, so the classification is
    correct, and the discrimination that matters happens through the food tags,
    which is where the finer instrument belongs — Riesling carries `pork` and
    `asian`, Chablis carries `oysters` and `risotto`. Austria drinks Riesling
    with Schnitzel too; one author's "too assertively acidic" is a preference.
    **Do not split a style because one source dislikes one wine in it.**
  - **A missing tag reads as a missing wine.** `veal` was on 9 of 308 bottles,
    so Wiener Schnitzel under 60 EUR offered one. Burgundy in both colours and
    Grüner are textbook veal wines: +47 tags, and the dish now fills at every
    band. Same story for `pasticada`, which the sources put squarely on Plavac
    mali and which was on two continental bottles.
  - **Five tags per wine, hard cap.** The enrichment respects it and skips
    rather than overflowing. A card is a suggestion, not an inventory — twenty
    one-off tags were removed earlier for exactly that reason.

**The by-the-glass list is ordered lightest to fullest, then cheapest first**
(owner asked, 2026-08-03: by body or by country?). By body. A glass list is
short, read top to bottom once, while deciding a single drink — and the question
in the guest's head is "how big", not "which country". The category headings
already do the coarse work, and 32 wines split across eight countries would be
twenty tiny groups; the flag on every row keeps the country visible for the
guest who wants Croatian. `body` is the sort key, price the tiebreak, both from
the data — so a wine added later lands in the right place by being sorted, not
by being placed.

**The kitchen's ingredient list is deliberately not printed in the sommelier**
(owner asked, 2026-08-02). It would be 30 dishes x 8 languages of text that goes
stale the day the menu changes, and it tells a guest what they already know:
they ordered the dish. What they cannot know is why *these three wines* — so the
line under the dish name names the foods the suggestions share with it ("uz
jela: janjetina, tvrdi i zreli sirevi"), from vocabulary already translated and
data already there.

**Twenty of the 120 combinations cannot fill three suggestions, and the reason
is almost always the shelf.** Thirteen are the Ikone band: 36 trophy bottles,
nothing tagged for a pea soup or an artichoke, and the ones that do exist
(Yquem for every dessert) are right. The other seven are real thinness — the
dessert shelf between 60 and 120 EUR is two wines; `foie_gras` is on eight
bottles and one is under 60 EUR; `veal` is on nine of 308 wines, which is why
**Wiener Schnitzel under 60 EUR offers exactly one bottle.** Run
`node scratch/underfilled.mjs` for the current list with reasons. The cure is
tags, not code: no scoring change adds a wine that is not on the shelf.

**A fried dish must not ask for a rich white.** The schnitzel listed
`white_rich`, which is how Albert Mann's Pinot Gris Grand Cru Hengst — off-dry,
14.5%, honey and pineapple — came to be suggested for breaded veal: it scored
three points for being exactly the style the dish asked for. Breaded and fried
wants acidity to cut the crumb, which is why Austria drinks Grüner and dry
Riesling with it. The dish now asks `white_fresh, white_mineral, red_light,
sparkling` and returns exactly those. The *wine's* `white_meat` tag was fine
and stays — an Alsace Grand Cru Pinot Gris with roast pork or guinea fowl is
classic; it is only the fried cutlet it has no business near. Guarded by a test,
and it is the only off-dry wine on the list carrying a savoury pairing at all,
so no blanket rule was needed.

**Whites for a risotto are correct** (owner, 2026-08-02) — acidity is what
balances the fat and the cream, so the beef risotto returning Chardonnay and
Pinot Bianco is the right answer, not a bug. Noted because it looked like one.

**Pairings are stored best-food-first, and both directions read the same
array** (owner, 2026-08-02: "rank the best pairing for each wine and match them
accordingly"). `scripts/lib/pairing-rank.mjs` holds the order: each style's own
ranking, plus a short list of grapes whose classic dish outranks it — Nebbiolo
takes truffles before steak, Riesling takes the spice, Pinot Noir the bird and
the mushroom. 207 of the 308 wines were reordered by it.

That one array now drives both things the owner asked to agree:

  - the **card** prints it as stored, so the first food a guest reads is the
    wine's best;
  - `dishScore()` weights the wine's first food at **4** points, its second at
    3, its third at 2 and the rest at 1 — so a Dingač that exists for lamb
    outranks a Bordeaux that lists lamb third.

They cannot disagree, because there is only one list.

The tie-break moved 3 -> 4 with it: ranked weights make the score steps finer
(4/3/2/1 rather than a flat 3), so the same jitter bought less variety. At 4:
252 of 276 bottles reachable, 8.4 different wines per combination, and the
suggested wine still lists the dish's food as, on average, its first. The 29
combinations still locked are locked by the food-first filter, not the jitter.

**The style weight was left at 3, deliberately.** Raising it to 4 or 5 sounded
right — the kitchen names the styles, so they should outweigh a generic food
match — but measured it moves suggestions-in-a-target-style only 77.1% -> 78.5%
-> 79.1% while costing reachability (252 -> 248 -> 247). The cases that look
wrong (a Chardonnay for the beef risotto under 60 EUR) are thin shelves, not
scoring: not one sub-60 EUR red on the list carries `beef`. Fix that in the
tags, not in the weights.

**Every pairing is compatible, and the rules that say so are in the code**
(owner, 2026-08-02: "I don't want non-compatible wine-food pairings... quality
before quantity"). All 964 tags on the 308 wines were read against five clash
rules — the full style x food matrix is in `scratch/pairing-matrix.txt` — and
four wines failed:

    Pertois-Moriset rosé   `desserts`        -> light_starters
    Henri Giraud Hommage   `dark_chocolate`  -> removed
    Dom Pérignon P2        `game`            -> poultry
    Jacques Selosse Rosé   `game`            -> charcuterie

The last two were **my error**, made merging the vocabulary: Moët's own note
says *pigeon*, and mapping `pigeon` -> `game` turned a game bird into venison on
the card. Worth remembering whenever a key is merged — a coarser bucket can
turn a true statement into a false one.

The five rules, each with the reason a sommelier would give, live in
`validate.mjs` and in data.spec.mjs, so a bad tag fails the deploy:

  1. a dry wine with a sweet dish — sugar in the food must never outrun sugar
     in the glass;
  2. a sweet wine with a savoury main — a clash of purpose;
  3. a big red with oysters, caviar or raw fish — tannin plus iodine reads
     metallic;
  4. a white or a sparkling with red meat or game — no weight;
  5. dark chocolate on a dry sparkling — it strips the wine bare.

**One documented exception, and it is a real pairing rather than a loophole:**
a Brut *rosé* sparkling may carry `fruit_desserts`. The acidity matches the
fruit's and the wine's own red-berry character echoes it — which is why the
kitchen's strawberry dish lists `champagne_rose` itself. Generic `desserts` and
`dark_chocolate` stay forbidden even there.

These are a floor, not a house style: anything a reasonable sommelier would
defend is left alone. Champagne with aged cheese, orange wine with game,
Riesling with pork — all stay.

**A suggestion must name the food on its own card** (owner, 2026-08-02: "I
don't want to have some wine recommendation for some food, but not to have that
food in wine description"). The score is three points per shared pairing *plus*
three for the style, so a wine could be proposed on style alone — and 15.7% of
all suggestions were. A guest tapping a wine recommended for their pea soup read
"beef, game, aged cheese", which makes the whole feature look like it is
guessing.

`foodFirst()` therefore uses the wines that share a pairing **on their own**
whenever there are any, and never mixes a style-only wine in beside them to pad
the list to three. Two wines that genuinely suit the dish beat three where one
is filling a slot: 103 of 120 combinations still show three, ten show two,
seven show one. The style-only fallback survives for the four combinations that
would otherwise answer with nothing — all in the Ikone band, where a 500 EUR+
shelf simply has nothing tagged for a pea soup. Mismatch fell from 15.7% to
3.6%, and all of the remainder is that fallback.

This also explains a thing that looked like a bug and was not: **Duemani Cifra
was the standing by-the-glass suggestion for Wiener Schnitzel** because `veal`
is on *none* of the 32 pours and `white_meat` on three, one of which is Cifra.
The rule surfaces thin tagging rather than causing it, so `validate.mjs` now
prints which dishes have fewer than three by-the-glass matches.

**The tie-break is one scoring step wide, and that is a deliberate number.**
It was 0.4, which only ever shuffled *exact* ties — so 25 of the 120 dish x
budget combinations returned the same three wines for ever and 80 of 276
bottles could never be suggested for anything. The owner asked whether some
bottles were being preferred all the time; they were. It is 3 now, which is one
shared pairing or the style match: comparable wines take turns, and a wine four
or more points behind still cannot displace the leader. Measured over 200 runs
per combination:

    jitter   distinct/combo   locked combos   bottles ever proposed
    0.4               6.3          25/120           196/276
    3.0               9.8           9/120           251/276

The average suggestion moved from 1.03 to 1.12 points below the best match,
which is the whole price paid. Do not raise it further: at 4.0 the worst
suggestion drops from 6 to 9 points below the best, which is a genuinely worse
pairing rather than a comparable one.

The freeze is per *interaction*, not per device: `openHelper()` clears
`picks`, so the same tablet re-rolls every time a guest starts again. And
"Promijeni budžet" resets `mode` to bottle — it is a bottle question, and
answering it with the same glass list (glasses are not budget-filtered) reads
as the app ignoring you.

**Both helper screens go through `showModal()`.** A wine card puts the modal in
`detail-mode` (top-aligned, 87vh) and turns the ‹ › arrows on. The back path
re-rendered `#modal-body` alone, so the suggestions came back inside the card's
frame — taller, off-centre, with live stepping arrows that opened wines from
behind the list. `showModal()` is the one place that knows how to restore the
frame and it is safe to call while already open; call it from anything that
replaces the modal body.

"Bez ogranicenja" stays, wording and behaviour both: it means spare no expense
and shows the 500 EUR+ Ikone. It was renamed to "Ikone (500 EUR+)" for exactly
one round on the grounds that the label did not describe the filter; the owner
had asked for both explicitly and asked for them back. Do not rename it again.

**The menu is validated.** `data/menu.json` speaks the pairing vocabulary and
was never checked, and it showed: the Tiramisu asked for a pairing called
`coffee`, which is in no dictionary and on no wine, so it silently scored zero
for as long as it existed. `validate.mjs` now fails the deploy on a dish key
that no wine carries, and *warns* on one carried by fewer than five wines -
which is not an error but does mean that dish falls back to matching on style
alone.

**Pairings are foods, not recipes.** Three bottles carried lists pasted from
their producer's own notes - `salmon_zucchini_tart`, `goat_cheese_veg_tiramisu`,
`scallops_basil_mustard`, `istrian_fuzi`, `green_tomato_sorbet`, `chicken_rice`
- each on exactly one wine, unreadable on the card and unmatchable by any dish.
Twenty such keys were merged into the shared vocabulary, and near-duplicates
with them (`chocolate` to `dark_chocolate`, `sushi_sashimi` to `sushi`,
`fish` to `white_fish`, `red_meat`/`dark_meat` to `beef`, `game_birds` to
`game`). Guarded by a test; `pasticada` and `smoked_fish` are the allowed
rarities, because one is on the kitchen's menu and the other is why we pour an
Islay.

**The dish data must match the plate.** Checked against the ingredient lists at
theatrium.hr/jelovnik: the oyster mushrooms were tagged on the veal, which has
none, instead of on the sirloin, which has them; the pasticada asked for `game`
when it is beef cheeks; the fish fillet did not mention its grilled asparagus;
the fritto misto asked for `grilled_fish` when it is deep-fried. Re-read the
menu page when the kitchen changes it - the pairings are only as good as the
ingredient list they were written from.

## Regions: twelve cards, localized to the last map label (2026-08-02)

Six cards covered 157 of 308 wines. Bordeaux had a card for 8 wines while
**Istria (21) and the German Riesling shelf (22) had none.** Five were added -
Istria, Germany, Veneto, Friuli, Northern Croatia - taking coverage to ~240.
The next two by size are the rest of Italy (14) and California (11).

**Twelve cards, Croatia first.** California and Oregon joined (13 wines), and
the order is no longer arbitrary: Croatia leads - which is what the wine list
itself does inside every category, so the Regions screen should not invent a
different convention - then by how many wines we pour. Dalmatia, Northern
Croatia, Istria, Burgundy, Champagne, Bordeaux, Tuscany, Piedmont, Friuli,
Veneto, Germany, California.

**The maps are schematic and not to scale, on purpose** - a to-scale Burgundy
beside Bordeaux is an invisible sliver. What they must get right is relative
position and neighbours, and all twelve were checked against that: the communes
run in order down the Cote d'Or, the two banks are on the right sides of the
Gironde, the Adige separates the Valpolicella rather than crossing it, the
Carso sits east of the Isonzo, Sonoma is west of Napa with the Mayacamas
between them. Label geometry is now a test rather than an eyeball, in Croatian,
German and Chinese - localizing changes every label's width, so what fits in
one language can hang off the frame in another.

**Everything on the screen is localized, including inside the maps.** The
appellation chips were printed raw, so the Chinese view read "Barolo,
Barbaresco, La Morra, Alba, Langhe"; they now go through `localizeRegion()`,
the same function as the region line on a wine card. The labels drawn inside
the map SVGs go through `localizeMap()`, which rewrites the text of
`.t-town`/`.t-dot`/`.t-zone` on the way out - the maps are hand-drawn with
their labels baked in, and a coordinate table per language would be a lot of
machinery for eleven pictures. Consequences to know:

- **Write place names in full in maps.js.** "Saint-Emilion", not "St-Emilion";
  the abbreviation is in no dictionary. Two names in one label are joined by
  " - " (a middle dot), which the localiser splits on.
- **Chinese gets the bare Chinese name inside a map**, not the
  bracketed-Latin form the chips and cards use. That form is right where there
  is room; at a hand-picked x/y it tripled the label width, ran one label
  through another and pushed Le Mesnil off the picture.
- **`MAP_FEATURES` holds the rivers, lakes and seas.** They are places on a map
  but not places wine comes from, so they have no business in `ZH_REGION`.
- **`appellations` holds appellations.** Grapes were in two of the new lists
  doing the work of a subtitle; they have no entry in `ZH_REGION` and came out
  as bare Latin.

Drawing one: viewBox `0 0 320 240`, classes `zone`/`river`/`coast`/`road`/
`town`/`dot`/`t-town`/`t-dot`/`t-zone`. Four things the first draft of all five
got wrong, found by rendering them and looking: a river must not run *through*
a zone it runs past (the Adige sliced the Valpolicella Classica in half, which
is precisely the boundary it forms); every zone label needs a zone under it
(Nahe and Friuli Isonzo were floating captions); a zone must sit inside the
coastline that contains it; and a label must not land on another zone.

**Kras is a rung, not a region** (owner, 2026-08-02). Vodopivec read
`region: "Kras"` - one rung where every other Italian wine has three, as if the
karst plateau were a region of Italy. It is the (bilingual, "Carso - Kras") DOC
above Trieste, inside Friuli: now `Sgonico, Kras, Friuli`, terroir
`Colludrozza`, the hamlet on the Origine label. Stored under the Slovene form
because the plateau runs across the border and `REGION_I18N` renders it per
language - English trade says Carso for the Italian side, which is the only
side we pour.

## Swipes are bound to the app, not the column (2026-07-30)

The section swipe listens on `#app` and the sheet swipe on `#modal`, not on
`#content` and `#modal-sheet`. Binding them to the inner element left dead
strips exactly where a thumb starts: the list column is capped at 900px, so a
1024px tablet has a 62px gutter down each edge, the sheet is 700px in the same
1024px screen (160px each side), and the footer — which a short category now
parks at the bottom of the screen — was outside `#content` altogether.

Two guards go with it. The header is excluded by `closest(".header")` rather
than by scrollWidth, because at 1024px the chip strip sometimes fits exactly and
then it is not a scroller and the swipe gets stolen from it. And the sheet's
drag-away still requires the touch to start **on the card** (`sheet.contains`) —
only the sideways step is allowed from the backdrop, since dragging the backdrop
down should not throw the card off the screen.

Test it with real input, not synthetic TouchEvents: dispatch through CDP
(`Input.dispatchTouchEvent`) at several viewports, and check the dead zones
specifically — a swipe down the middle of a phone passes while a tablet edge
fails.

## The Croatian flag is the official artwork (2026-07-30)

Nine flags are drawn by hand in `js/app.js`; Croatia is not. `assets/flag-hr.svg`
carries the coat of arms verbatim from the public-domain `Flag_of_Croatia.svg`
on Wikimedia Commons, re-framed from the source's 1:2 onto the 60x40 box the
rest of the set uses — the arms keep their 62% of flag height and their
off-centre vertical placement (44.9%), so the shield straddles the bands exactly
as on the real flag. Two things to know if it is ever touched: the root `<svg>`
**must** declare `xmlns:xlink`, because the artwork uses `<use xlink:href="#lion">`
and without it the file silently fails to parse and every flag renders 0x0; and
it is referenced as an `<img class="flag-img">` rather than inlined, because
`hrFlag()` is called for the language button, the header switch and every
Croatian country heading, and 67 kB of path data would be pasted into the DOM
once per call. CSS sizes `.flag-img` alongside the sibling `svg` selectors.

Emoji were the other option and do not work: flag emoji need a font glyph, and
Windows ships none — Chrome on Windows renders 🇭🇷 as the letters "HR".

## Copyright, and what is actually protectable (2026-08-02)

The repo is **public** - GitHub Pages on the free plan requires it - and every
data file is one request away: wines.json 458 kB, producers.json 258 kB,
i18n.js 118 kB. A complete copy takes about a second. There is no technical fix
for that; anything a browser renders, a scraper takes.

So the answer is a notice, in every place a notice is read:

  - `LICENSE` - all rights reserved, and specific about *what*. The clause that
    does the real work is the **sui generis database right** (Directive
    96/9/EC): it protects the substantial investment in obtaining, verifying
    and presenting the contents, independently of copyright in the texts, and
    it forbids repeated extraction of insubstantial parts as well as one big
    grab. Croatia is in the EU, so this is the strongest instrument available.
  - **Text and data mining reserved** under Art. 4(3) of Directive (EU)
    2019/790, which only works if the reservation is *machine-readable*. Hence
    all three of `robots.txt`, `/.well-known/tdmrep.json` and the
    `tdm-reservation` meta element - and the crawler list in robots.txt names
    GPTBot, ClaudeBot, CCBot, Google-Extended and the rest by name while
    leaving ordinary search engines allowed, because guests still need to find
    the restaurant.
  - `ui.copyright` - one line under the footer, in all eight languages.

None of it stops a copy. All of it turns "found it online" into a documented
one, which is the difference between having a case and not.

Worth being clear about what the asset is. The wine list copies badly - a
competitor gets wines they do not stock at prices they do not charge against a
menu they do not cook. What is genuinely reusable is the *engine*: 226 aroma
keys and 65 pairing keys in eight languages, the region ladders, the glass
research, the structure. That is what the database right is for.

Do not "improve" this with obfuscation or a bundler. It buys minutes against a
copier and costs the no-build design that makes a price edit live in a minute.

## Windows environment notes

- Git Bash paths (`/c/...`) don't work inside `python -c` — pass `C:/...` style paths.
- Python 3.9 default console encoding is cp1252 — always write files with `encoding='utf-8'` (Croatian diacritics!).
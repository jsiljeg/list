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
  **Zelina is Prigorje-Bilogora** while Kutina is Moslavina. Vinogorje names
  keep the spaced en-dash the regulation uses — `Voloder – Ivanić-Grad`,
  `Plešivica – Okić`.
- **China:** no appellation system exists, so the ladder is administrative —
  `<county>, <prefecture>, <province>`: `Deqin, Diqing, Yunnan`. Terroir = the
  named villages the fruit comes from (`Adong, Xidang, Sinong, Shuori`).
  Mountain ranges are **not** a rung — "Himalaya" and "Shangri-La" are
  geography and marketing, not places the wine is from (Ao Yun's vineyards sit
  in Deqin County, a different county from Shangri-La City).

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

## Tests (added 2026-07-30) — run them before you push

`npm test` runs a Playwright regression suite across three viewports; `npm run
check` is the whole gate (syntax + `scripts/validate.mjs` + tests) and is exactly
what CI runs. **CI now blocks the Pages deploy on it** — `.github/workflows/
deploy.yml` calls `test.yml` and the deploy job `needs: test`.

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

## Windows environment notes

- Git Bash paths (`/c/...`) don't work inside `python -c` — pass `C:/...` style paths.
- Python 3.9 default console encoding is cp1252 — always write files with `encoding='utf-8'` (Croatian diacritics!).
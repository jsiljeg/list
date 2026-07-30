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

Sizing follows from that: recoloured lace needs room. The bowl closing mark is
280px wide at .7 opacity (under ~180px the weave mats into a smudge), the face
watermark is `contain` at .32. The **grape** section ornament stays a drawn SVG —
it is an arrangement of nails, not a picture of a sculpture.

The face is a background on `.story-screen::before`, which is `display:none`
until a language is picked, so it must stay in the `<link rel="preload">` in
`index.html` — without it the fetch only starts at the tap and the splash lands
bare.

## Windows environment notes

- Git Bash paths (`/c/...`) don't work inside `python -c` — pass `C:/...` style paths.
- Python 3.9 default console encoding is cp1252 — always write files with `encoding='utf-8'` (Croatian diacritics!).
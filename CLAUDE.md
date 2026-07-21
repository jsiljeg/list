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
- [ ] HTTPS: waiting for GitHub to issue the Let's Encrypt cert, then `gh api -X PUT repos/jsiljeg/list/pages -f https_enforced=true` (background poll doing this automatically; verify `https_enforced` later).
- [x] QR code (`assets/qr.png`, `assets/qr.svg`, printable `qr.html`) for https://theatrium.list.devinos.hr
- [x] Commit & push to `main`

## Deployment notes (learned 2026-07-21)

- Remote switched to SSH (`git@github.com:jsiljeg/list.git`): the keyring OAuth token lacks `workflow` scope, so HTTPS pushes touching `.github/workflows/` are rejected; SSH pushes work (key authenticates as `jsiljegmrt`).
- Repo was made **public** (was private) — required for GitHub Pages on the free plan.
- `https://jsiljeg.github.io/list/` 301-redirects to the custom domain (expected Pages behaviour once cname is set), so the site is only reachable after the DNS record exists.

## Windows environment notes

- Git Bash paths (`/c/...`) don't work inside `python -c` — pass `C:/...` style paths.
- Python 3.9 default console encoding is cp1252 — always write files with `encoding='utf-8'` (Croatian diacritics!).
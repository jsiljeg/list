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
- [ ] Parse prices PDF → `data/wines.json`
- [ ] Download logo to `assets/` (a `curl` for it was interrupted — retry)
- [ ] Build app (HTML/CSS/JS, 5-language i18n)
- [ ] Wine detail views with generated insights (grape, region, tasting notes, pairings) in all 5 languages
- [ ] Local run + verify on tablet-sized viewport
- [ ] GitHub Actions Pages workflow; create `theatrium` GH environment; secrets/vars (need token from owner)
- [ ] Cloudflare DNS: CNAME `theatrium.list` → `jsiljeg.github.io`, DNS-only; Pages custom domain + HTTPS
- [ ] QR code for https://theatrium.list.devinos.hr
- [ ] Commit & push to `main` as work progresses

## Windows environment notes

- Git Bash paths (`/c/...`) don't work inside `python -c` — pass `C:/...` style paths.
- Python 3.9 default console encoding is cp1252 — always write files with `encoding='utf-8'` (Croatian diacritics!).
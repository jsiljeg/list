#!/usr/bin/env bash
# Copy just the files the guest app needs into $1 (default _site).
#
# The deploy used to publish the repo root, so everything we work with was also
# on the restaurant's domain: scratch scripts and HTML dumps, docs/, tests/, and
# data/source/ with the supplier PDFs and a third-party article. The repo is
# public regardless, but that is a different thing from the venue's own URL
# serving them next to the wine list.
#
# Keep this list and the app in step: if index.html, sw.js or js/app.js starts
# loading something new, add it here. `npm run check` runs a verification that
# every file the app fetches is present.
set -euo pipefail
out="${1:-_site}"
rm -rf "$out"
mkdir -p "$out"

# pages, the service worker, and the crawler/TDM declarations (see LICENSE)
cp index.html admin.html qr.html manifest.webmanifest sw.js robots.txt LICENSE "$out/"

# the price list in a form a machine can read, plus its archive. Croatian law
# from 01.10.2026: published on the website, refreshed as soon as anything
# changes, and every published version reachable for at least 30 days. The
# whole directory goes, because the archive *is* the retention.
#
# Postponed with the anchor price (owner, 2026-10-03): one switch,
# scripts/lib/cjenik-publish.json. While it is false the directory simply is
# not published, and check-site.mjs makes sure of that.
if grep -q '"publish": true' scripts/lib/cjenik-publish.json; then
  cp -r cjenik "$out/"
fi
cp -r .well-known "$out/"

# code and artwork
cp -r css js assets "$out/"

# the data the app polls — data/source/ is deliberately not copied
mkdir -p "$out/data" "$out/library" "$out/lists"
cp data/menu.json data/producers.json data/regions.json data/unavailable.json "$out/data/"
cp library/wines.json "$out/library/"
cp lists/theatrium.json "$out/lists/"

# The code version (2026-10-03). The owner has no hands on the tablets, so a
# new app.js has to reach them by itself. Two parts, both done here so the
# source stays a plain static site with nothing to build:
#
#  1. A fingerprint of the CODE only — the page, the stylesheet, the scripts,
#     the service worker. Data is left out on purpose: a price edit already
#     reaches every tablet in 30 seconds without a reload, and must not cause
#     one. It goes into index.html's app-version meta and into version.json;
#     the app polls the second and compares it with the first.
#  2. ?v=<fingerprint> on every script and the stylesheet, so a reload can
#     never be answered from the browser's own cache. GitHub Pages sends
#     max-age=600, and a plain reload in Chrome does not revalidate
#     subresources — without this a tablet could reload and keep running the
#     old app.js for up to ten minutes.
code_files="index.html admin.html sw.js manifest.webmanifest css/style.css $(ls js/*.js | sort | tr '\n' ' ')"
version=$(cat $code_files | sha256sum | cut -c1-12)
sed -i \
  -e "s|<meta name=\"app-version\" content=\"dev\">|<meta name=\"app-version\" content=\"$version\">|" \
  -e "s|href=\"css/style.css\"|href=\"css/style.css?v=$version\"|" \
  -e "s|src=\"js/\([a-z0-9-]*\)\.js\"|src=\"js/\1.js?v=$version\"|g" \
  "$out/index.html"
grep -q "content=\"$version\"" "$out/index.html" || { echo "app-version meta not stamped into index.html" >&2; exit 1; }
# The staff page too (2026-10-10). Its page and scripts are cached separately
# for 10 minutes, so a phone could pair a new admin.js with an old admin.html
# — "Cannot read properties of null" and a half-styled board. With the
# fingerprint on its scripts, a page only ever loads the scripts it was
# deployed with.
sed -i -e "s|src=\"js/\([a-z0-9-]*\)\.js\"|src=\"js/\1.js?v=$version\"|g" "$out/admin.html"
grep -q "admin.js?v=$version" "$out/admin.html" || { echo "admin.html scripts not stamped" >&2; exit 1; }
printf '{"code":"%s"}\n' "$version" > "$out/version.json"

# Nothing here is published for theatrium.hr to embed any more (2026-09-07).
# The plan is a plain link from their nav to this list, so there is no fragment
# for their developer to paste and no staging replica of their site: embed-hr /
# embed-en, scripts/build-embed.mjs and preview/ are all gone. check-site.mjs
# fails if any of those paths becomes reachable again — Pages has no auth, so
# "published but hidden" is not a state it can offer, and robots.txt is a
# request rather than a control (the lesson /scratch/ already taught once).

echo "site assembled in $out/ ($(find "$out" -type f | wc -l) files)"

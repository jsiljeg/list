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
cp -r .well-known "$out/"

# code and artwork
cp -r css js assets "$out/"

# the data the app polls — data/source/ is deliberately not copied
mkdir -p "$out/data" "$out/library" "$out/lists"
cp data/menu.json data/producers.json data/regions.json data/unavailable.json "$out/data/"
cp library/wines.json "$out/library/"
cp lists/theatrium.json "$out/lists/"

# The drinks list as plain markup for theatrium.hr, so the restaurant site
# stops keeping a second, hand-typed copy. Built here rather than committed:
# it is derived from the two files above and must never be edited by hand.
node scripts/build-embed.mjs
cp embed-hr.html embed-en.html "$out/"

echo "site assembled in $out/ ($(find "$out" -type f | wc -l) files)"

# Audit — the live theatrium.hr

Measured 2026-09-07 against the WordPress site currently on `theatrium.hr`.
Everything below is a number pulled off the wire, not an impression: the page
was fetched with a Googlebot user-agent and read as a crawler reads it.

This is the *evidence*. `PLAN.md` §4 is what we do about it — read this first if
you want to know why that section is ordered the way it is.

**The premise.** The owner's own scoring: design 9/10, Google visibility 3/10.
The finding is that these are the same fact. The site is a brand poster built in
2019 and untouched since, and every choice that makes it beautiful is a choice
that removes a signal Google needs.

---

## 1. There is almost no text, and none of it is what people search

The homepage is **238 words in total** — that count includes the navigation and
the footer. Body copy is about 180.

Worse than the volume is the vocabulary. The navigation is written entirely in
the theatre metaphor:

| Label on the site | The word a guest types |
|---|---|
| Scenario | O nama / About |
| Ensemble | Chef / Tim |
| Repertoire | **Jelovnik / Menu** |
| How to solve drinking problems | **Vinska karta / Wine list** |

The URLs are actually fine — `/jelovnik/`, `/ponuda-pica/` — but the anchor
text, the headings and the `<title>` are not, and those are what carry weight.

- `<title>` on the homepage is `Theatrium by Filho`. Brand only: no *restoran*,
  no *Zagreb*.
- Meta description is 39 characters — `Restoran u Zagrebu - Theatrium by Filho`.
- The menu page's title is `Repertoire - Theatrium by Filho`. Nobody searches
  "repertoire".
- The subpages carry **no meta description at all**.
- **No page on the site has an `<h1>`.** Zero across all four pages checked; the
  OnePress theme goes straight to `<h2>`.

Net effect: the site cannot be found for `restoran zagreb centar`,
`fine dining zagreb`, `degustacijski meni zagreb`, `michelin restoran zagreb`.
It is reachable only by someone who already knows the name — which is the
definition of a site that adds no discovery.

One genuine positive worth recording: the menu and drinks pages are **real
text**, not photographed PDFs. 463 words on `/jelovnik/`, 1527 on
`/ponuda-pica/`. That content is salvageable as-is.

---

## 2. No restaurant structured data at all

Yoast is emitting `Organization`, `WebPage`, `WebSite`, `BreadcrumbList`,
`SearchAction` — the generic set, identical on all four pages.

There is **no `Restaurant` and no `LocalBusiness` node anywhere**. So no
`address`, no `telephone`, no `geo`, no `priceRange`, no `servesCuisine`, no
`acceptsReservations`, no `hasMenu` in any machine-readable form.

And the human-readable version is missing too: **opening hours appear nowhere on
the site, in either language.** Not in schema, not as text. For a restaurant
this is the single most-requested fact and it is absent.

This is what §4.3 of the plan exists to fix.

---

## 3. The server is slow and the images are enormous

TTFB, measured four times in a row on the homepage:

```
2.05s   2.46s   2.81s   3.93s
```

That is unaccelerated WordPress with no page cache. Then:

| Asset | Size | Problem |
|---|---|---|
| `Theatrium_hero.jpg` | **3.6 MB** | Not an `<img>`. Injected by jQuery from a `data-images` attribute on `#hero`, so the LCP element does not begin downloading until JS executes. |
| `Theatrium_menu_H.jpg` | **3.46 MB** | The homepage loads the *full-size* file behind a 480×300 thumbnail slot. |

The logo also ships as `<img width="1" height="1">`.

So the largest element on the page is a 3.6 MB JPEG that is invisible to the
preload scanner by construction. On a phone on 4G in Zagreb this fails Core Web
Vitals on LCP before any other consideration. `PLAN.md` §4.5 (AVIF/WebP,
`srcset`, explicit dimensions, `fetchpriority` on the hero only) is the direct
answer to this row.

---

## 4. Indexing is half-broken

`robots.txt` is fine and the redirects are clean — `http://`, `www.`, and
`/index.php` all 301 to `https://theatrium.hr/` correctly. The problem is the
sitemap.

`sitemap_index.xml` → `page-sitemap.xml` contains **three unique URLs, each
listed twice** (a WPML artefact — the translations emit the source `loc`):

```
https://theatrium.hr/            lastmod 2019-11-06
https://theatrium.hr/ponuda-pica/
https://theatrium.hr/jelovnik/
```

**The entire English site is missing from it.** `/en/`, `/en/menu/` and
`/en/drinks/` all return 200 and all are absent from the sitemap — zero `/en/`
occurrences in the whole index.

Every `lastmod` is 2019, and `article:modified_time` on the homepage says
`2019-11-06T08:30:58`. Google has been told, correctly, that nothing has
happened here in seven years.

Homepage `hreflang` (hr / en / x-default) is present and correct. That part
works.

---

## 5. Aggregators own the brand

Searching the restaurant's own name returns, in order: Mindtrip, Tripadvisor,
Facebook, Wanderlog, RestaurantGuru, Postcard, Wheree, and the Michelin Guide.
The official site does not dominate its own brand query.

The [Michelin Guide entry][michelin] — Michelin selection, two covers — is a
real asset, and the site never mentions or links it. Neither does it link the
Gault&Millau 16/20 that the press page now carries.

[michelin]: https://guide.michelin.com/ae-az/en/zagreb-region/zagreb/restaurant/theatrium-by-filho

---

## 6. Nobody is measuring

No GA4, no Google Tag Manager, no pixel, no Clarity — grep finds nothing on any
page. There *is* a `google-site-verification` meta tag, so Search Console was
verified once and then abandoned.

This is why the 3/10 was a feeling rather than a number. `PLAN.md` §11 fixes it
with Cloudflare Web Analytics plus Search Console from day one.

---

## 7. What could not be checked from here

**The Google Business Profile.** For a restaurant this is roughly two-thirds of
"Google visibility" — hours, category, photo freshness, review replies, posts,
the menu link. It cannot be inspected remotely and it is not in this repo's
control.

If the profile is unmanaged, that alone could account for the 3/10 independently
of everything above. It is the first thing to check and the cheapest thing to
fix, which is exactly why `PLAN.md` §4.1 puts off-site work ahead of any code we
write.

---

## Summary — the five numbers

| | Measured |
|---|---|
| Homepage word count | 238, nav and footer included |
| Pages with an `<h1>` | 0 of 4 |
| `Restaurant`/`LocalBusiness` schema | none |
| Homepage TTFB | 2.0–3.9 s |
| Hero image | 3.6 MB, JS-injected |
| URLs in sitemap | 3 unique, all `lastmod` 2019, `/en/` absent |

---

## See also

**`PLAN.md`** §4 — what we build instead, ordered by payoff.
**`CUTOVER.md`** §"Search" — what has to survive the move off this site.

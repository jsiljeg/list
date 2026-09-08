# Theatrium — new site: plan

Working document, started 2026-09-07. The wine list is **not** part of this and
does not change; see "What must not move" below.

---

## 1. The one-sentence strategy

The restaurant already owns something no competitor has — 393 drinks with
researched pairings, in eight languages — and it is currently **invisible to
Google**. The new site's job is to turn that asset into pages, and to stop
paying for things that can be a form.

---

## 2. What must not move

`theatrium.list.devinos.hr` stays exactly as it is: same repo, same GitHub Pages
deploy, same allowlist in `scripts/site-files.sh`, same data files. It is live in
the restaurant and linked from theatrium.hr.

The new site is **downstream and read-only**. It fetches the published JSON at
*build time* and never writes to it:

```
library/wines.json  ─┐
lists/theatrium.json ├─> build step ─> static HTML for the new site
data/menu.json      ─┘
```

One direction, build-time only. If the new site breaks, nothing in the
restaurant notices. `web/` is not in the wine list's deploy allowlist, so it
cannot be published to the venue domain by accident.

---

## 3. Stack, and why

**Astro, deployed to Cloudflare Pages.**

| Need | Why Astro |
|---|---|
| SEO | Static HTML by default. This is the whole problem with the current list app — its HTML is 6.5 kB with zero wine names in it, so Google indexes nothing. |
| Speed | Ships no JavaScript unless a component asks for it. Core Web Vitals are a ranking factor and a conversion factor. |
| Content | Dishes, wines and press are content collections — typed, validated at build. |
| Growth | Server endpoints exist when we need them (booking, newsletter) without changing stack. |

**Why Cloudflare Pages:** the DNS is already there, the account and API token
already exist, the free tier covers this comfortably, and the pieces we will
need later are in the same place — D1 (SQLite) for bookings, Cron Triggers for
scheduled email, Workers for form endpoints. No new vendor.

**Not** Next.js (more JS than a restaurant site should ship), not WordPress
(what we are leaving), not a hand-rolled generator (the wine list is already
that, and it is the right choice *there* because it must edit in a minute — a
marketing site has different pressures).

---

## 4. SEO: where the wins actually are

Ordered by how much they matter for a restaurant, which is not the order people
expect. The measurements this ordering rests on are in
**`AUDIT-THEATRIUM-HR.md`**.

### 4.1 Off-site comes first, and it is not our code
The largest source of restaurant discovery is **Google Business Profile / Maps**,
not the website. Before any of this pays off: claim and complete the profile,
correct hours, menu link, photos, and reply to reviews. Consistent NAP (name,
address, phone) between the profile, the site and directories. This is free and
outperforms most on-site work.

### 4.2 Have more than six pages
`site:theatrium.hr` currently returns **six indexed pages**. That is the whole
footprint. Dish pages, wine pages and press pages take it into the hundreds —
and they are genuinely useful pages, not doorway spam, which is the difference
that matters.

### 4.3 Structured data
`schema.org` `Restaurant` with `Menu` / `MenuSection` / `MenuItem`, opening
hours, geo, `priceRange`, `acceptsReservations`, `servesCuisine`. This is what
produces rich results for restaurants. Add `Article`-less `NewsArticle` links
for press mentions and `BreadcrumbList` for navigation.

### 4.4 Real HTML for the wines
The dish pages carry the paired wines **as text in the HTML**, generated at
build time. This is the fix for the problem diagnosed on 2026-09-07: the list
app is a JS shell and its 393 wine names are unreachable to a crawler.

### 4.5 The rest
- `hreflang` for hr/en (and later it/de, which are real guest languages here).
- One canonical URL per page; no duplicate hr/en content without hreflang.
- `sitemap.xml` (the Astro integration), `robots.txt`, Search Console verified.
- Images as AVIF/WebP with `srcset`, explicit `width`/`height` to stop layout
  shift, `fetchpriority` on the hero only.
- Fonts: reuse the metric-override trick already proven in the wine list —
  Georgia sets Markazi 34% wider, and without the override the first paint
  visibly reflows.

---

## 5. The differentiator: dishes ↔ wines

This is the part worth building carefully, because it is the only part a
competitor cannot copy in an afternoon.

`data/menu.json` already carries, per dish: eight names, `pairings` (food tags)
and `styles` (wine styles). `js/app.js` already scores a wine against a dish —
four points for the wine's best-matching food, three for the next, then two,
then one, plus three for a style match. That is a real sommelier model and it
has been tuned against published sources.

At build time we run the same scoring and emit:

- **a page per dish** — the dish, and the three or four wines that go with it,
  each linked to the list;
- **a page per wine** (later) — the wine, and the dishes on tonight's menu it
  suits.

Both directions come out of one array, so they cannot disagree. Both are static
HTML, so both are indexable. And "which wine with this dish" is a question
guests actually type.

**Constraint carried over:** parked dishes (`"off": true`) are seasonal and must
not be published — the wine list already filters them through `menuDishes()`,
and the build step must do the same.

---

## 6. Reservations — built, and what the model is

**Decision: real bookings, confirmed on the spot.** Owner's call, 2026-09-07.

The model is **covers-based pacing with turn times, not table assignment**, and
the distinction is worth keeping written down because "real reservations" can
mean either.

Assigning tables means modelling table sizes, combining two-tops into a four,
splitting them back, and choosing who sits where — and when it goes wrong a
party stands at the door on a Saturday. Pacing answers the two questions that
actually constrain a room, and gives the guest the same thing (instant
confirmation, capacity respected):

1. **Capacity** — how many covers are in the room at once.
2. **Pacing** — how many arrive within the same 15 minutes.

The second is the one kitchens lose on. A kitchen that serves 40 covers across
an evening cannot serve 20 that walk in together.

**Where it lives**

| Piece | File |
|---|---|
| The rules, pure and testable | `src/lib/booking.mjs` |
| Slot list for a date + party | `functions/api/availability.js` |
| Taking the booking | `functions/api/reservations.js` |
| Guest + house email | `functions/_lib/mail.js` |
| Tables | `schema.sql` |
| The three-step form | `src/pages/rezervacija.astro` |

**The race is handled in SQL.** Two guests can be looking at the last two seats
at 20:00. Checking availability in JavaScript and then inserting is
check-then-act with a gap, and that gap is the double-booking. The capacity test
is therefore part of the INSERT — a conditional `INSERT ... SELECT ... WHERE`
that writes one row or none, atomically. The loser gets a 409 and a refreshed
slot list. `/api/availability` is advisory only and is never trusted.

**Email cannot fail a booking.** The row is written first; a send failure is
logged, not surfaced. A guest seeing an error after their seat was taken is the
worst available outcome.

**Still to build:** cancellation page (`/otkazivanje/`), the staff view behind
Cloudflare Access — not a PIN, because this holds guest personal data — blackout
management for closures and private events, and a no-show flag.

**Run SevenRooms in parallel for a month before cancelling it.** The failure
mode here is silent: a booking that never arrives is not noticed until an empty
table at 20:00.

## 7. Newsletter and birthdays — where the traps are

**Never build the sending.** Deliverability is a specialist discipline: SPF,
DKIM, DMARC alignment, bounce and complaint handling, list hygiene, warm-up. Get
it wrong and the restaurant's domain lands in spam folders — including its
booking confirmations. Use a provider: **Resend** (developer-friendly, good
deliverability) or **MailerLite / Brevo** if the owner wants to write campaigns
in a UI without us in the loop. Prefer the latter if staff will send them.

**Keep personal data in the provider, not in our database, wherever possible.**
Every copy is a copy we must secure, honour erasure requests against, and
explain in a privacy policy.

**GDPR is not optional here** — Croatia is in the EU and these are marketing
emails to identified people:

- Explicit **opt-in** (a pre-ticked box is not consent). Double opt-in is the
  defensible standard and also keeps the list clean.
- **Unsubscribe in every email**, one click, honoured immediately.
- **Birthday is personal data.** Collect it only with a stated purpose, make it
  optional, and set a retention policy. A birthday greeting is marketing, so it
  needs the same consent as the newsletter.
- Record **when and how** consent was given. That record is the defence.
- Privacy policy and a named controller (Apelacija d.o.o.) before the first
  address is collected.

**Birthday mechanism:** a Cloudflare Cron Trigger runs daily, queries who has a
birthday, hands the list to the provider. No always-on server.

**Staff-only surfaces** (bookings list, subscriber counts, campaign sending) are
behind auth from day one. The 86 board's model is the precedent and its
limitations are documented — a PIN is a screen lock, the token is the credential.
For anything holding guest personal data, that is not enough: use Cloudflare
Access (free tier, Google/email login) rather than a PIN.

---

## 8. Press and articles — link, never republish

Coverage of the restaurant and of Filip Horvat is a real asset for both guests
and search. The rule is simple and it is legal, not stylistic:

- **Link out.** Publication name, headline, date, link, and our own one-line
  note on why it is worth reading.
- **At most a short quoted phrase**, in quotation marks, with attribution.
- **Never the article text**, not reworded, not "summarised" at length.
  Republishing a periodical's copy is an infringement regardless of credit.
- Photographs in articles belong to the photographer or the outlet. Do not lift
  them; use the restaurant's own images.

A curated press page of eight good links, each with a sentence of context, is
more persuasive than a wall of scraped text — and it is the version we are
allowed to publish.

---

## 9. Identity and design direction

Keep what theatrium.hr already established and what guests recognise:

- The **theatrical framing** — Scenario, Ensemble, Repertoire. It is distinctive
  and it is theirs.
- **Markazi Text** for display. It is on both properties already.
- The **logo** and the atrium nail sculpture.

Lean toward the wine list where the two disagree, because the wine list is the
newer and more considered system: the warm near-black ground rather than pure
black, the champagne accent used to carry meaning rather than decoration,
Raleway for dense text where Markazi's small x-height fights legibility.

Where the marketing site should differ from the list: **photography leads.** The
list is a tool used standing up; the site is read while deciding whether to come.
Large food images, generous space, one clear action per screen.

---

## 10. Phasing

**Phase 0 — foundation (this PoC).** Astro scaffold, design tokens, layout, home
page, dish pages generated from the real data with real pairings, structured
data, sitemap. Deployed to a staging subdomain. Nothing points at it.

**Phase 1 — content.** Real photography, the full menu with descriptions, press
page, about/chef page, hr+en. This is where the SEO actually starts working, and
it is mostly the owner's material rather than code.

**Phase 2 — booking request.** Form, D1, the two emails, staff list behind
Cloudflare Access. Cancel SevenRooms only once this has run a month in parallel.

**Phase 3 — newsletter.** Provider integration, double opt-in, preference page,
privacy policy. Birthdays after the newsletter is proven.

**Phase 4 — cutover.** Move theatrium.hr itself. Keep every existing URL alive
with 301s — `/jelovnik/`, `/ponuda-pica/`, `/en/...` — because those six indexed
pages are the search equity we have.

---

## 11. Measurement

- **Google Search Console** from day one on the staging domain; it is the only
  honest source for what is indexed.
- **Cloudflare Web Analytics** — no cookies, so no consent banner, which is both
  faster and one less thing to get wrong under ePrivacy.
- Track two numbers that matter: booking requests started vs completed, and
  which dish/wine pages bring people in.

---

## 12. Decisions — answered 2026-09-07

| Question | Answer |
|---|---|
| Reservations | **Build real bookings**, not a request flow. Done: capacity + pacing, instant confirmation. |
| Newsletter | **We send it**, staff never touch a campaign tool → Resend. |
| Languages | Croatian first; the other seven added afterwards on the wine list's pattern. |
| Photography | All 26 dishes plus room, chef, interiors — brief in PHOTOGRAPHY.md, list in SHOTLIST-DISHES.md. |
| Domain | devinos.hr for now, theatrium.hr at cutover. |

### Still blocking

1. **Cloudflare credentials.** A token with Pages + D1 + Workers scope, and the
   account id, as secrets on a `theatrium-web` GitHub environment. The existing
   `theatrium` token is DNS-scoped and cannot deploy.
2. **Resend key and a verified sending domain.** Sending from an unverified
   domain earns a bad reputation in a week that takes months to undo.
3. **The service numbers are my guesses and must be corrected before go-live** —
   they are in `src/lib/booking.mjs`:
   - open Tue–Sat? (currently Mon–Sat, closed Sunday)
   - lunch 12:00–15:00, dinner 18:00–23:00 (23:30 Fri/Sat)
   - **34 covers bookable online** — deliberately under true capacity so walk-ins
     and the phone still have somewhere to go
   - **8 covers may start in any 15 minutes** (kitchen pacing)
   - turn: 90 min to 2 people, 105 to 4, 135 above
   - parties over 8 are told to call
   Every one of these is a business decision, not a technical one.

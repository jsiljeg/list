# Cutover to theatrium.hr

Everything that is deliberately temporary while this is built on devinos.hr, so
none of it goes live by being forgotten. **Add to this list the moment you make
a temporary choice** — that is what it is for.

Nothing here is a bug. Each line is a decision that was right for staging and is
wrong for production.

---

## Must change, or something breaks

| # | What | Now | At cutover | Where |
|---|---|---|---|---|
| 1 | Notification recipient | `jures91@gmail.com` | `joy@theatrium.hr` | `wrangler.toml` → `MAIL_HOUSE` |
| 2 | Sending domain | `rezervacije@devinos.hr` | `rezervacije@theatrium.hr` | `wrangler.toml` → `MAIL_FROM`, re-verify in Resend |
| 3 | Canonical host | `theatrium.preview.devinos.hr` | `https://theatrium.hr` | `astro.config.mjs` → `site` |
| 4 | Indexing | `noindex, nofollow` on every page | remove it | `src/layouts/Base.astro` |
| 5 | Wine list link | `theatrium.list.devinos.hr` | keep, or move to `karta.theatrium.hr` | nav + footer + dish pages |

**#1 is the one with teeth.** Until the owner asks for it, no reservation mail
should reach the restaurant — a test booking arriving in their inbox at 23:00
is a real phone call about a table that does not exist.

**#2 needs DNS access to theatrium.hr**, which is the same access #3 needs. Ask
for it early; it blocks nothing today and blocks everything on cutover day.
A guest receiving booking mail from `devinos.hr` reads it as phishing, and the
sending reputation built there is discarded at the switch — so do not send
volume from devinos.hr.

---

## Search — the part that is easy to lose

`theatrium.hr` has **six indexed pages** today. That is the whole search
footprint and it is the one asset a rebuild can actually destroy.

- **301 every old URL to its new home.** Not a homepage redirect — a redirect to
  the matching page. At minimum: `/jelovnik/`, `/ponuda-pica/`, `/en/`,
  `/en/menu/`, `/en/drinks/`.
- `/ponuda-pica/` currently 404s nowhere useful — decide where it lands. It is
  one of the six.
- Resubmit the sitemap in **Google Search Console** and watch coverage for a
  fortnight. Verify the property *before* the switch so there is a baseline.
- Update the website link on the **Google Business Profile**.
- Keep the old WordPress reachable for a few days after DNS moves, in case a
  redirect was missed.

---

## Reservations — before taking a real booking

- **Confirm the capacity numbers** against the SevenRooms configuration
  (`src/lib/booking.mjs`). Last seating and slot interval are already copied
  from it: 22:00, every 15 minutes.
- **Run both systems in parallel for a month.** The failure mode is silent — a
  booking that never arrives is not noticed until an empty table at 20:00.
- **Privacy policy live** before the first real guest submits the form. The page
  is linked from the form already and does not exist yet.
- **Staff view behind Cloudflare Access**, not a PIN. This holds guest names,
  emails and phone numbers.
- Decide **retention**: how long reservation rows are kept.
- Only cancel SevenRooms after all of the above.

---

## Housekeeping

- `robots.txt` for the new site — it currently inherits nothing.
- Analytics: Cloudflare Web Analytics, so there is no cookie banner to write.
- Check the OG image renders — social previews are unset while staging.
- Re-run the photography paths once real images land; the gradient placeholders
  are in `index.astro` and the dish pages.

---

## Log of temporary choices

| Date | Choice | Why temporary |
|---|---|---|
| 2026-09-07 | `noindex` on all pages | staging must not compete with theatrium.hr in search |
| 2026-09-07 | `devinos.hr` sending domain | no DNS access to theatrium.hr yet |
| 2026-09-07 | `jures91@gmail.com` notifications | owner has not asked to receive them |
| 2026-09-07 | Gradient placeholders for photography | shoot is this week |
| 2026-09-07 | Croatian only | other seven languages after Croatian is complete |

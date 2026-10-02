# Dnevna ponuda — the daily offer

Started 2026-10-02. The chef goes to the market in the morning, photographs
what he buys, and by lunch the day's dishes are on the website, each with
wines from the list.

**The wine list is not touched by any of this.** It was going onto the
restaurant's tablets the day this was built, and it stays byte-for-byte as
it was. The daily offer *reads* the list's published JSON; the list does not
know the daily offer exists (yet — see "Filhov izbor" below).

---

## What a guest sees

`/dnevna-ponuda/` — today's published offer: the chef's note, a strip of
market photos, an optional video, then the dishes by course, each with its
photo, price, description and the wines picked for it (glass and bottle
price, live from the list). Before anything is published it says so and
links to the menu and the list. `/dnevna-ponuda/2026-10-02/` is a past day.

Not in the nav yet: the six-item nav was a deliberate decision. Where to link
it from (nav, the home page, Instagram bio) is the owner's call.

## What the chef does — `/kuhinja/`

On a phone:

1. Enter the staff key once (kept on that phone).
2. Write a line about the market, add photos (shrunk on the phone to ~1600 px
   before upload), paste an Instagram/YouTube link if there is a video.
3. Add dishes: name, price, short description. Tap what is on the plate
   (fish, mushrooms, lamb…) and optionally the wine style. **The page
   proposes wines from the list as the tags are tapped** — the list's own
   scoring, by the glass and by the bottle, nothing 86'd. Tick 1–3.
4. *Spremi skicu* (guests don't see it) or *Objavi* (live within a minute).

Other languages are optional fields behind "drugi jezici". The sommelier
skill (`.claude/skills/sommelier`) can write them in all eight, along with a
complete offer from a list of dishes.

## How it is built

| Piece | File |
|---|---|
| Pairing model (port of the list's) | `src/lib/pairing.mjs` |
| Public page frame (static) | `src/pages/dnevna-ponuda/index.astro` |
| Fills the frame per request | `functions/dnevna-ponuda/[[path]].js` |
| Shared logic, rendering | `functions/_lib/daily.js` |
| Public JSON feed (CORS open) | `functions/api/dnevna-ponuda.js` |
| Staff save / load / delete | `functions/api/kuhinja/ponuda.js` |
| Photo upload / delete | `functions/api/kuhinja/media.js`, `media/[id].js` |
| Photo serving (immutable) | `functions/media/[id].js` |
| Staff page | `src/pages/kuhinja/index.astro` |
| Tables | `schema.sql` — `daily_offers`, `media` |

Decisions worth knowing:

- **The page stays static, the content does not.** Astro builds the frame;
  a Pages Function fills `#daily-slot` with HTMLRewriter on every request. A
  crawler gets real HTML, the stack is unchanged, and publishing needs no
  rebuild.
- **Wines are stored as refs, never names or prices.** Prices are read live
  from the list (edge-cached 2 minutes), and a wine 86'd after breakfast
  drops out of the page by itself.
- **The chef chooses; the model proposes.** No tie-break jitter here: a list
  that reshuffles as you type cannot be chosen from.
- **Clash rules filter only the style-only fallback.** A wine that shares a
  food with the dish already passed `validate.mjs`; applying the rules
  dish-wide would forbid Champagne with beef tartare.
- **Photos live in D1**, not a bucket, so nothing new had to be enabled on
  the Cloudflare account. Content-hashed ids, served `immutable`, so the edge
  serves them after the first guest. ~300 kB a photo, a few a day, comes to
  a few hundred MB a year against D1's 5 GB.
- **Video is a link, not an upload.** D1 rows top out at 2 MB, and the chef's
  market video lives on Instagram anyway. YouTube embeds via
  youtube-nocookie; Instagram/TikTok are a link (their embeds need
  third-party scripts and consent the site does not otherwise ask for). When
  uploaded video is wanted, the step is an R2 bucket (needs R2 enabled on the
  account, which asks for a card even on the free tier) or Cloudflare Stream.
- **Staff auth is a shared key**, the 86 board's model: it guards public
  content (a menu), not guest personal data. Bookings get Cloudflare Access.
  The key is the GitHub secret `STAFF_KEY` on environment `theatrium`;
  `deploy-web.yml` copies it to the Pages project. Rotate:
  `gh secret set STAFF_KEY -e theatrium`, then re-run the web deploy.

## On the wine list — the sommelier, prepared, not live

Owner, 2026-10-02: parity. The list already pairs every dish on the
kitchen's menu in "Pomozi mi odabrati"; the day's dishes belong there too,
and **only** there (not in Filhov izbor). That needs a change to
`js/app.js`, which must not happen while the tablets are new, so it is on the
branch **`wine-list-daily-offer`** and not merged. When merged:

- the list polls `/api/dnevna-ponuda` on its usual 30 s cycle;
- the sommelier's dish picker opens with a *Danas iz kuhinje* group — the
  day's dishes in the guest's language — above Predjela/Juhe/…;
- picking one runs the ordinary flow: budget, three bottles, the glass
  flip, all from the dish's **tags** (what is on the plate + wine styles),
  exactly as for a menu dish. The wines the chef ticked are for the website;
  the tablet answers with the same model the rest of the list uses;
- an untagged dish is not offered there (the staff page warns on publish);
- a feed that is down, empty or not today's leaves the picker as it is now.

Merge only when the owner says so — not before there are daily dishes and a
website — and run `npx playwright test tests/daily-offer.spec.mjs` first.

## Open for the owner

- **Link it**: nav, home page, or only Instagram/QR for now?
- **Who publishes**: the chef, or the chef sends photos and someone else
  writes it up?
- **Languages**: Croatian only on the website for now (the whole site is),
  but the wine list's guests read eight; worth writing at least English.
- **Cjenik**: the daily offer has prices. Whether the 01.10.2026 rule wants
  them in the machine-readable price list is a legal reading; the JSON feed
  is machine-readable either way.
- **Allergens**: the page carries the standard "ask our staff" line, as the
  list does. A per-dish allergen field is easy to add if wanted.

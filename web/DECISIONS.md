# Open decisions

A running log. Answer them as they come up — none of these block building, and
each one is written so it can be answered in a sentence. Settled items move to
the bottom with the date.

---

## Blocking go-live

### 1. Cloudflare account id
The only thing still missing from the deploy. The token is already stored and
now has Pages permission; the account id was never needed for DNS work.

```
gh secret set CLOUDFLARE_ACCOUNT_ID -e theatrium
```
Find it: Cloudflare dashboard → pick the account → right sidebar, or on the
Workers & Pages page.

### 2. Sending domain for email
**devinos.hr is temporary and must not survive to launch.** A guest who books
Theatrium and gets mail from `devinos.hr` reads it as phishing, and the sending
reputation we build on it is thrown away when we move.

Needs DNS access to theatrium.hr — the same access the domain cutover needs, so
worth asking for now. No mailbox is required at the sending address; Resend
authenticates the domain, and replies are already pointed at `joy@theatrium.hr`.

### 3. Kitchen close vs door close
Google says Mon–Sat 12:00–23:00. That is when the *door* shuts. If the kitchen
stops earlier, the last bookable table has to come off the kitchen time.

Currently: last table at **21:30** for two people, **20:45** for five (90 and
135 minute turns against a 23:00 close).

### 4. The capacity numbers
Still my guesses:

| Setting | Now | Question |
|---|---|---|
| `capacity` | 34 | How many seats does the room have, and how many should be bookable online rather than kept for walk-ins and the phone? |
| `pacing` | 8 | How many guests can arrive within the same 15 minutes before the kitchen suffers? |
| `turnMinutes` | 90 / 105 / 135 | How long does a table actually stay occupied, by party size? |
| `maxParty` | 8 | Above what size should they call instead of booking? |
| `leadMinutes` | 120 | How close to the sitting can someone still book online? |
| `horizonDays` | 60 | How far ahead should the calendar open? |

All in `src/lib/booking.mjs`. Owner is checking how SevenRooms is configured —
copying those numbers is the right answer, since they reflect how the room is
actually run.

---

## To decide as we go

- **No-shows.** Card guarantee or deposit? This is the main thing SevenRooms is
  actually being paid for. Adds Stripe and a payment flow — real work, worth it
  only if no-shows are costing money.
- **Cancellation window.** How late can a guest cancel by link? Suggested: up to
  4 hours before, then it says to phone.
- **Lunch bookings online, or dinner only?** The room runs straight through, so
  currently everything from 12:00 is bookable.
- **Who receives booking notifications?** `joy@theatrium.hr` today. A second
  address, or a shared inbox?
- **Reservation data retention.** GDPR wants a stated period. A year is typical
  for hospitality; longer needs a reason.
- **Privacy policy.** Required before collecting the first email. I can draft
  it; it should be read by someone who is not me.
- **Google Business Profile access.** The single biggest lever on new guests,
  bigger than anything on the site — and it is where the opening hours above
  came from, so it is already load-bearing.
- **Newsletter cadence and who writes it.** We send; nobody has said how often
  or in whose voice.
- **Birthday greetings.** Deferred until the newsletter is proven. Needs its own
  consent — a birthday greeting is marketing.
- **The other seven languages.** After Croatian is complete, on the wine list's
  pattern.

---

## Settled

| Date | Decision |
|---|---|
| 2026-09-07 | Reservations: build real bookings, not a request flow. |
| 2026-09-07 | Newsletter: we send it; staff never touch a campaign tool → Resend. |
| 2026-09-07 | Croatian first; other languages afterwards. |
| 2026-09-07 | devinos.hr for staging, theatrium.hr at cutover. |
| 2026-09-07 | Photography: all 26 dishes plus room, chef, interiors. |
| 2026-09-07 | Cloudflare: widen the existing token rather than mint a new one. |
| 2026-09-07 | Opening hours Mon–Sat 12:00–23:00, Sunday closed (Business Profile). |

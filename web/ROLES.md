# Staff roles on /admin — the head sommelier (Toni)

Owner, 2026-11-17: Toni, the head sommelier, gets /admin with **Karta**,
**Dodaj vino** and **Ponuda** only, and everything those three tabs do: hide
and bring back (86), prices, "+ čaša", NOVO, new wines, the daily offer. He
must never see **Povijest** or **Troškovi** (and so Prihodi, Računi, Cijene,
PDV and anything else). "It is dangerous to leave even 1% chance he sees
Troškovi or anything else he is not allowed to see." Filho's access stays
exactly as it is.

This file is the plan and the record of how it is built. Status at the end.

## 1. What /admin is made of today

`admin.html` is a public static page on theatrium.list.devinos.hr (GitHub
Pages). Its PIN (`7777`, in js/admin.js, public) is a screen lock and
protects nothing. The only credential is the key in the device's
localStorage (`theatrium-admin-token`): a fine-grained GitHub token of the
owner's account.

| Tab | Script | Reads | Writes |
|---|---|---|---|
| Karta | js/admin.js | `library/wines.json` (site, public); `lists/theatrium.json` and `data/unavailable.json` through the **GitHub contents API** with the key | the same two files, PUT through the GitHub contents API with the key (86, prices, NOVO, + čaša) |
| Dodaj vino | js/admin-wines.js | `GET /api/vina`, `/api/vina/:id/foto/:n` | `POST /api/vina`, `POST /api/vina/:id/{odgovor,objavi,ispravak,ponovi,odustani}` |
| Ponuda | js/admin-daily.js | `GET /api/kuhinja/citaj`, `GET /api/kuhinja/ponuda`, site JSON | `POST /api/kuhinja/citaj`, `POST /api/kuhinja/citaj/:id/{objavi,ponovi,odustani}`, `POST /api/kuhinja/media`, `DELETE /api/kuhinja/media/:id`, `PUT/DELETE /api/kuhinja/ponuda` |
| Povijest | js/admin-wines.js (`loadHistory`) | GitHub commits API (public repo) **and `GET /api/troskovi/povijest`** — receipts marked paid, with vendor and amount | — |
| Troškovi | js/admin-expenses.js | `/api/troskovi*` (receipts, photos, MER), `/api/prihodi*` (revenue, companies, waiters), GitHub `data/till-map.json`, `data/buy-map.json` | the same, plus the two maps through GitHub |

`/api/*` lives on theatrium.devinos.hr (Cloudflare Pages Functions, D1).
Every staff endpoint calls `isStaffAsync()`: STAFF_KEY, or a GitHub key of
`jsiljeg` whose fingerprint is in `TABLET_KEYS` / `WINE_GH_KEYS`.

## 2. Where Troškovi could reach Toni — every path checked

1. **An API answer.** Every receipt, photo, revenue figure and the paid-log
   comes from `/api/troskovi*` and `/api/prihodi*`. Today any staff key opens
   all of it. → the server must refuse them to his key (§3).
2. **A prefetch on page load.** js/admin-expenses.js warms Troškovi and
   Prihodi **1.5 s after /admin opens, whatever tab is shown** (`setTimeout(…,
   1500)`). Hiding a tab would not stop this. → in his mode the script is not
   loaded at all.
3. **Povijest.** Half of it is the public git history; the other half is
   `/api/troskovi/povijest` (who marked which invoice paid, vendor, amount).
   → the tab, its code and the endpoint are all closed to him.
4. **The GitHub token itself — the biggest hole.** A Contents-write token on
   jsiljeg/list can commit *any* file to `main`, and a push to `web/**`
   deploys the server (deploy-web.yml). With one, Toni could add his own key
   to `TABLET_KEYS` and be Filho a minute later, or change js/admin.js. A
   fine-grained token cannot be limited to two paths. → **Toni gets no
   GitHub token.** His key is a server key that GitHub has never heard of,
   and his Karta writes go through a server endpoint that accepts only the
   changes the Karta tab can make (§3.4).
5. **Browser caches on a shared device.** API JSON is `no-store`, and so
   are receipt photos (`private, no-store`, checked — nothing to change).
   localStorage holds only the key; the service worker never controls /admin
   (admin.html unregisters it). Logout reloads the page, and a key changed
   in another tab now reloads this one, so nothing of Filho's stays in
   memory. (Label photos in Dodaj vino are cached for an hour; they are his
   tab's own content.)
6. **Error messages and e-mails.** A refusal is `{"error":"role"}` and
   nothing else. Alerts go to the owner only; none are sent to Toni.
7. **Public anyway, stated so nobody assumes otherwise.** The repo is
   public: its commit history (every price change, every 86, who signed it),
   `data/till-map.json`, `data/buy-map.json` (supplier line names, no prices)
   and `data/list-since.json` can be read by anyone on github.com, Toni
   included. Povijest's wine half adds nothing to that; its Troškovi half is
   the secret one, and it is closed. `GET /api/stat` (guest statistics,
   aggregates) has never needed a key — unchanged, not part of this.
8. **The way round, through a card.** Dodaj vino's Claude run reads text a
   person types (remark, answers, corrections) and a label photo, and Toni
   may tap Objavi on his own card. A card may change `js/i18n.js` and
   `js/zh-terms.js`, and `js/i18n.js` is loaded by /admin itself — so a line
   of script slipped in by a prompt injection would run on Filho's /admin
   with Filho's key and Troškovi in reach. → `scripts/check-card-patch.mjs`:
   in those two files a card may only add or remove `key: "string"` /
   `key: number` entries (several per line, or one `key: { … }`) and
   one-line comments — every line a card run has written to them in the
   repo's history passes, except one multi-line comment. add-wine.yml checks
   the patch before applying it; publish-wine.yml checks the whole merge
   before it reaches main.
9. **Existence leaks.** `/api/troskovi/:id/:action` read the receipt before
   checking the key, so a 404 told anyone whether a receipt id exists. Found
   by the new spec; the key is checked first now, as in the vina and kuhinja
   actions (which had the same order and were changed with this work).

## 3. The design

### 3.1 The role travels with the key, and the server decides

- **full** — Filho and the owner: STAFF_KEY, or a listed GitHub key. Exactly
  as today; nothing about it changes.
- **somm** — a server key, `somm_` + 43 random characters, generated by
  `node scripts/new-somm-key.mjs`. The server holds only its **full SHA-256**
  (64 hex), in `SOMM_KEYS` in web/functions/_lib/roles.js or the env var
  `WINE_SOMM_KEYS` (`<sha256>:<Name>,…`). The name ("Toni") comes from that
  entry, never from the page, so his commits and his requests are signed by
  the server.
- `isStaffAsync()` still means **full only**. A somm key does not match its
  GitHub-key shape, so every endpoint that has not been explicitly opened to
  somm refuses it — **deny by default**, including any endpoint added later.

### 3.2 Two locks, not one

1. **`web/functions/api/_middleware.js`** (new, runs before every `/api/*`
   function): a request carrying a somm key is let through only if its
   method and path are on the somm allowlist; otherwise `403
   {"error":"role"}` and the function never runs. An unknown somm key gets
   `401 {"error":"key"}`.
2. **The function itself**: allowlisted functions call
   `isStaffOrSomm()`; every other one calls `isStaffAsync()`, which a somm
   key fails. So if the middleware were ever skipped, the endpoints still say
   no.

The allowlist and the per-endpoint roles are one table, `ACCESS` in
web/functions/_lib/roles.js: every route file, every method, the roles that
may call it. The middleware derives its allowlist from it.
`tests/roles.spec.mjs` fails when a route file exports a handler `ACCESS`
does not declare, or `ACCESS` names one that does not exist — the allowlist
cannot grow a hole silently.

### 3.3 Toni's allowlist (and nothing else)

| Endpoint | Methods | Why |
|---|---|---|
| `/api/uloga` | GET | "who am I": role and name, so the page knows which tabs to build |
| `/api/karta` | GET, PUT | the Karta tab's two files, through the server (§3.4) |
| `/api/vina` | GET, POST | Dodaj vino: the inbox and a new bottle |
| `/api/vina/:id` | GET | one request |
| `/api/vina/:id/foto/:n` | GET | label photos |
| `/api/vina/:id/:action` | POST | odgovor, objavi, ispravak, ponovi, odustani — `stanje` stays worker-only |
| `/api/kuhinja/citaj` | GET, POST | Ponuda: the inbox and a new menu |
| `/api/kuhinja/citaj/:id` | GET | one request |
| `/api/kuhinja/citaj/:id/:action` | POST | objavi, ponovi, odustani — `stanje` stays worker-only |
| `/api/kuhinja/media`, `/api/kuhinja/media/:id` | POST, DELETE | offer photos |
| `/api/kuhinja/ponuda` | GET, PUT, DELETE | the day's offer |

Not on it: all of `/api/troskovi/*`, all of `/api/prihodi/*`,
`/api/vina/test-obavijest` (alerts to the owner), and every public endpoint
(a public endpoint answers without a key anyway).

Inside the allowed answers, `usage` (what a Claude run cost) is removed for
somm. The page never showed it.

### 3.4 Karta without a GitHub token: `/api/karta`

- `GET /api/karta?file=lists/theatrium.json|data/unavailable.json` →
  `{sha, content}` (base64), the same envelope as GitHub's, so js/admin.js
  only swaps the URL.
- `PUT /api/karta` `{file, content, sha, message}` → the server reads the
  current file from GitHub, checks the change, and commits it with its own
  token `KARTA_GH_TOKEN` (fine-grained, jsiljeg/list, Contents: read and
  write), authored and signed with the key's name (`— Toni`). A stale `sha`
  is `409`, exactly like GitHub, so the board's "netko je u međuvremenu…"
  path works unchanged.
- **Only these two files**, and only the changes the tab can make — checked
  by diffing the new document against the one on GitHub
  (web/functions/_lib/karta.js):
  - `lists/theatrium.json`: the same sections, categories, groups and items
    in the same order; on an item only `price` (a positive amount, two
    decimals at most) and `new` (true or absent) may change — never `anchor`
    or anything else. New items only in the `glass` section, only `{ref,
    price}`, only a wine already sold by the bottle and not yet by the glass;
    a new category only on the glass shelf, only one a bottle shelf already
    has.
  - `data/unavailable.json`: `{_, hidden}` only; every rule
    `{producer, name, where?, since?, reason?}` with strings; `where` is
    `glass` or `bottle`; a rule that is not already there must name a wine
    the library has (validate.mjs would otherwise stop the deploy).
  - Anything else is `422 {"error":"change"}` and nothing is written.
- Filho keeps writing straight to GitHub with his own key, as today. The
  endpoint also accepts full keys, but his page does not use it.

Why not give Toni a GitHub token with fewer rights: there is no smaller
GitHub right that still writes those two files, and any right that writes
them writes the server too (§2.4). The server endpoint is the only way to
let him change prices without letting him change the rules.

### 3.4b His activities in Filho's history (owner, 2026-11-17)

"We need to see his activities in history, but he should not see any
history." Every write he can make is attributed with the **name from his
key on the server** — a `by` the page sends is ignored for a somm key:

| Where | Trail | Povijest shows it as |
|---|---|---|
| Karta (86, return, price, NOVO, + čaša) | git commit through `/api/karta`, signed "— Toni", authored Toni | the existing rows (Skinuto, Vraćeno, Cijena, NOVO, Na čašu) |
| Dodaj vino: send, answer, correct, publish, retry, cancel | `staff_log` row (D1) + `created_by`/`published_by` on the request; publishing also makes the git commit "… joins NOVO — Toni" | **Dodaj vino** · Poslao novo vino / Odgovorio / Ispravio / Objavio na kartu / Pokrenuo ponovno / Odustao |
| Ponuda: send a menu, publish, retry, cancel, offer save/publish/delete, photo add/delete | `staff_log` row (D1) + `created_by`/`published_by` on the request | **Ponuda** · Poslao jelovnik / Objavio / Spremio / Obrisao / Dodao fotografiju … |

- `staff_log (at, who, role, area, what, ref)` is in web/schema.sql; the
  deploy's `schema.sql` run creates it (`CREATE TABLE IF NOT EXISTS`).
  `logStaff()` in roles.js writes it and never fails the write it records.
  Filho's own writes are logged too, under the name his page sends.
- **`GET /api/dnevnik`** reads it, and `ACCESS` gives it to **full only**:
  the middleware refuses a somm key with 403, the function with 401. Only
  js/admin-history.js (full mode only) calls it.

### 3.5 The page: his tabs are the only tabs that exist

- The mode is read off the key: a `somm_` key is somm mode, anything else is
  today's page. Filho's page makes no new request and looks the same.
- **admin.html no longer contains Povijest or Troškovi** — no button, no
  container, no `<script src="js/admin-expenses.js">`. In full mode
  js/admin.js builds them and loads js/admin-expenses.js and
  js/admin-history.js (Povijest, moved out of admin-wines.js) after the PIN.
  In somm mode none of it is ever in the DOM, none of that code is on the
  page, and no request to `/api/troskovi*`, `/api/prihodi*` or the commits
  API is made.
- In somm mode the page first asks `/api/uloga`; anything but `somm` stops
  it before a single tab is drawn. Karta reads and writes through
  `/api/karta`; Dodaj vino and Ponuda call the same endpoints with his key.
- `show()` builds only tabs the mode allows, so `adminTab`-style tricks,
  `#povijest` in the address, or calling the functions from the console have
  nothing to open.
- The demo gets the same mode: `admin.html?demo&uloga=somm` (the demo server
  refuses Troškovi to it like the real one).

## 4. Enrolment (the owner's step, after his manual test)

1. On the owner's laptop: `node scripts/new-somm-key.mjs Toni`. It prints the
   key (`somm_…`, give it to Toni — never commit it, never paste it in a
   ticket) and the line to register: the SHA-256 and the name.
2. Register it, either:
   - in code: add `"<sha256>": "Toni",` to `SOMM_KEYS` in
     web/functions/_lib/roles.js and deploy (a hash, safe in a public repo); or
   - without a deploy: `gh secret set WINE_SOMM_KEYS -e theatrium` with
     `<sha256>:Toni` and re-run deploy-web.yml (it copies it to Pages).
3. Once only: create `KARTA_GH_TOKEN` — github.com → Settings → Developer
   settings → Fine-grained tokens → repository `jsiljeg/list` only, Contents:
   Read and write, nothing else — and `gh secret set KARTA_GH_TOKEN -e
   theatrium`; deploy-web.yml copies it. Without it Toni's Karta tab says
   it cannot write (`503 not_configured`); Dodaj vino and Ponuda work.
4. On Toni's device: /admin → PIN → paste the `somm_…` key → his three tabs.
5. Revoking: delete his line (or his part of `WINE_SOMM_KEYS`) and deploy.
   One step; nothing on GitHub to revoke because he never had a GitHub key.

## 5. What this does not solve (residual risk)

- **A device that holds Filho's key is Filho.** The PIN is public and
  guards nothing. If Toni can pick up an unlocked device with Filho's key
  on it — a shared bar tablet, Filho's phone — he has everything. TABLET_KEYS
  lists a key "seen on the owner's Povijest as Filho" (`448f…`): if that is a
  shared restaurant tablet, it must either be moved to a somm key or never be
  left where Toni works. This is the one risk the code cannot remove.
- The owner's KARTA_GH_TOKEN can write the whole repo; it lives only in
  Cloudflare and GitHub secrets, and the endpoint writes nothing but the two
  checked files.
- Commit messages for Toni's Karta changes are written by his page (as
  Filho's are); the server limits their size and signs them, but a hostile
  page could word one misleadingly. The diff itself is what git keeps.
- The public git history (§2.7) is visible to everyone.
- A card's **data** is still written by a model that reads his text: a
  wrong price, a misleading note or a bogus wine on the list is possible,
  as it is with Filho today. It is data, it is in git, and it cannot run.
  A card run that wants a multi-line comment or a new multi-line block in
  i18n.js now fails instead of publishing; the owner fixes that by hand.

## 6. Tests

| Spec | What it proves |
|---|---|
| `tests/roles.spec.mjs` | every `/api` handler is declared in `ACCESS` and vice versa; table-driven over **every** route and method: a somm key through the middleware gets `403 {"error":"role"}` without the function running unless allowlisted; called directly, every non-somm staff function refuses a somm key with an error-only body; the allowlisted ones work for somm against a real SQLite D1; full keys still pass everywhere they did; `/api/karta`'s change checker accepts exactly the board's edits and refuses the rest |
| `tests/admin-somm.spec.mjs` | in the browser, as somm: Povijest and Troškovi are absent from the DOM (not hidden), no address/hash/console trick opens them, the full session's network log never touches `/api/troskovi`, `/api/prihodi` or the commits API, and hide/unhide, price, + čaša, NOVO, Dodaj vino and Ponuda all work; a tablet re-keyed from Filho to Toni carries nothing over; Filho's page still has all five tabs |

## 7. Manual test before merging (the owner)

No preview deployment exists for this: deploy-web.yml deploys only `main`
to production, and GitHub Pages (where /admin lives) has no previews. Two
ways to look at it without touching production:

1. **The page, with invented data** — after `npm run site`, serve `_site/`
   (`cd _site && python -m http.server 4173`) and open
   `http://127.0.0.1:4173/admin.html?demo&uloga=somm` (Toni) and
   `…/admin.html?demo` (Filho). The demo's fake server refuses Toni exactly
   what the real one does.
2. **The real thing, after merge, before Toni has a key** — merge and deploy,
   then enrol a throw-away key for yourself as somm (§4), try everything in
   the checklist in the PR on your own phone, and delete that key again.

## 8. Status

- [x] Investigation and plan (this file)
- [x] Server: roles.js, middleware, opt-in endpoints, /api/uloga, /api/karta
- [x] Page: somm mode, tabs built per mode, Povijest moved out, demo mode
- [x] Tests written and run: tests/roles.spec.mjs, tests/admin-somm.spec.mjs, all three viewports
- [x] PR opened (not merged, not deployed)
- [x] His activities in Povijest (§3.4b): staff_log + /api/dnevnik (full only); tests: roles.spec 21, admin-somm.spec 10
- [ ] Owner: manual test, then `KARTA_GH_TOKEN` and Toni's key (§4)

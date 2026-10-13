# Troškovi — where Filho's money goes (2026-10-11)

The owner's brief: a tab in /admin where Filho photographs his receipts; they
are read, every line is filed under a category, and he can see where his
money goes. Confidential: the pictures must never reach GitHub.

## What he sees

**Pregled** — one month at a time (‹ listopad 2026 ›):
- the month's total, receipts, average per day, and the change against last
  month;
- *Kamo ide novac*: six groups a chef thinks in — Hrana, Piće, Potrošno,
  Oprema i održavanje, Režije i usluge, Ostalo — as horizontal bars with
  euros and share; a tap opens the categories inside a group;
- *Dobavljači*: the top five suppliers that month;
- *Najveće stavke*: the five biggest single lines;
- *Zadnjih 6 mjeseci*: a bar per month; a tap moves the overview there.

**Računi** — every receipt, grouped by month with the month's total. A tap
opens its lines; each line's category is a chip, and a tap on the chip
offers the eighteen categories (one tap to fix, saved at once). Photos are
shown; delete asks on the row ("da, obriši račun" · "odustani"). A receipt
that could not be read says why and offers "pokušaj ponovno".

**Cijene** — the same product bought more than once: the latest price per
kg / l / piece against the previous purchase, or against the first one we
have when the last two agree ("▲ 8% od svibnja"). Changed prices first,
largest change on top. Bills and services are left out — they have no unit
price worth following.

Upload: "Slikaj račun" (camera) or "Galerija" (several at once). Several
photos are sent as that many receipts, or as one long receipt with a tap
("1 račun, 3 slike"). Photos are shrunk to 2400 px on the phone.

## Where things live — and why it is confidential

| | where | who can read it |
|---|---|---|
| photos, read lines | D1 `theatrium` on Cloudflare (`expense_receipts`, `expense_photos`) | staff key (the /admin GitHub key) and the reading run |
| reading | GitHub Actions in **jsiljeg/theatrium-troskovi, private** | the owner |
| code of the tab and the API | this public repo | everyone — code only, no data |

The public list repo never sees a receipt: its logs and artifacts are public,
so nothing about expenses runs there. The private run downloads the photos
into the runner, reads them, posts the result back and deletes the copies; it
uploads no artifacts and its log prints counts and usage, never contents.

## The pipeline

1. `POST /api/troskovi` (staff) stores a receipt, `queued`.
2. `pump()` — after an upload and on every staff read — takes up to 8
   queued receipts as a batch (`working`) and dispatches `read-receipts.yml`
   in the private repo with **only the batch id**. Brakes: one run at a time,
   80 runs a day (12, then 24, until the full-year MER backfill, 2026-10-12), 200 a month, 3 tries per receipt, a batch silent for 15
   minutes goes back in line.
3. The run fetches `GET /api/troskovi/posao/<batch>` and the photos with
   `EXPENSE_WORKER_KEY`, runs Claude (`prompt.md` there; Read/Write/Glob in
   `work/` only, no web, no shell), and posts each `work/out/<id>.json` to
   `POST /api/troskovi/<id>/rezultat`. Categories are a closed list; the
   server turns anything else into `ostalo`.

## Keys

- `EXPENSE_WORKER_KEY` — generated once, stored in the `theatrium`
  environment here (deploy-web copies it to Pages) and as a secret of the
  private repo. Never seen by anyone.
- `EXPENSE_DISPATCH_TOKEN` — optional; a fine-grained token allowed to start
  workflows in the private repo. Without it the inbox uses
  `GH_DISPATCH_TOKEN`, which then needs that repo added to its access.
- `CLAUDE_CODE_OAUTH_TOKEN` — a secret of the private repo (the owner's
  subscription), set by the owner.
- Variable `EXPENSE_MODEL` in the private repo overrides the model (`opus`).

## Bez računa — cash with no receipt (Filho, 2026-10-12)

"Treba dodati da se može staviti račun plaćen gotovinom ali bez slike jer
nema uvijek računa … majstora isto plaćam gotovinom bez računa — i da se to
unese i prati."

Računi → **✍️ Plaćeno bez računa — upiši**: kome ili za što, datum (today),
gotovina / kartica / virman (gotovina), then lines of *description + amount*.
The category is guessed from the words as he types (`GUESS` in
js/admin-expenses.js: "majstor", "popravak" → Održavanje; "rajčica",
"plac" → Voće i povrće …) and is one tap to change. Enter on an amount opens
the next line. Saved as `source = 'rucno'`, status `done` at once — no run,
no subscription spent. Shown with a **BEZ RAČUNA** badge and "ispravi"
(re-opens the form); Pregled says *od toga bez računa X € (n upisa)* under
the month's total, which is the "da se prati". Lines have no unit price, so
they never reach Cijene.

## moj-eRačun (MER) — e-invoices come in by themselves (2026-10-12)

Filho: "kad bi se moglo na MER spojit di su e-računi, pa on može 80% sam
učitavat". Since Fiskalizacija 2.0 (1.1.2026) every VAT-registered supplier
must invoice electronically, so the wholesalers, the mesnica, the vinoteka
and the utilities arrive in Theatrium's MER inbox; what is left for photos
and *bez računa* is the market and the odd cash job.

How (web/functions/_lib/mer.js, ubl.js):

1. On a staff read of /api/troskovi (in the background, at most every 30
   min) or on **provjeri sada**: `queryInbox` from the last check minus 3
   days (from the 1st of the current month the first time). Older months are
   a backfill: `POST /api/troskovi/mer {from, to}` imports that range the
   same way and leaves the forward check where it was. Documents already in `expense_mer_docs`
   are skipped — including ones Filho deleted, which must not come back.
2. Each new one: `receive` → UBL, parsed here: supplier, OIB, date, number,
   payable amount, VAT, every line with VAT added back and g/ml converted to
   kg/l. A credit note is negative. The embedded PDF is kept (≤1.5 MB) and
   opens from the receipt as "📄 Račun u PDF-u". Not an invoice → recorded
   as `other` and ignored.
3. Stored as `source = 'mer'`, queued, and read by the same private run —
   which for an e-invoice gets `/<id>/eracun` instead of photos and only
   names the lines, sets key/unit for Cijene and the category. **The money
   is never taken from the run** (`mergeEinvoice`): amounts stay the
   invoice's own.
4. **Twins**: the same invoice photographed *and* arrived from MER counts
   once. On every finished read the other kind is looked up by OIB + number
   (punctuation ignored) or OIB + date + total; the photo gets `dup_of`, is
   left out of every sum, shown as **DVAPUT**, with "nije isti račun" to undo.

**Read only, deliberately.** Nothing is sent to MER. Accepting/rejecting an
e-invoice (`UpdateDokumentProcessStatus`) has legal weight under
Fiskalizacija 2.0 and stays a person's act in MER itself.

A refusal comes back as **HTTP 200** shaped per field —
`{"Username":{"Messages":["Korisničko ime i lozinka nisu ispravni."]}}` —
so `call()` reads Messages out of any JSON object and treats it as an
error; the tab then says *moj-eRačun se ne javlja* with MER's own words.

**Setup** — four secrets in GitHub environment `theatrium` (deploy-web copies
them to Pages; until all four exist the tab says "spajanje je u pripremi" and
MER is never called):

| secret / variable | what |
|---|---|
| `MER_USERNAME` | the MER user id (best a separate user created for this, not Filho's own login) |
| `MER_PASSWORD` | its password |
| `MER_COMPANY_ID` | Theatrium's OIB |
| `MER_SOFTWARE_ID` | the API software id MER issues for web-service access |
| var `MER_COMPANY_BU` | optional business unit |
| var `MER_DEMO` | `1` to talk to demo.moj-eracun.hr |

Then deploy web (or wait for the next) and tap *provjeri sada*.
Docs: manual.moj-eracun.hr/documentation/api-specification-2/. Brakes: 20
documents per check (subrequest budget), the rest on the next one.

Schema: `expense_receipts.source` and `.dup_of` are added by deploy-web's
"add missing columns" step (SQLite has no ADD COLUMN IF NOT EXISTS);
`expense_mer_docs`, `expense_mer_state` are in schema.sql.

## Plaćeno — what is still owed (owner, 2026-10-12)

"We would also need some option to mark račun as plaćeno … some easy way."

- **Card and cash need no mark**: a till receipt is paid by being one. Only a
  receipt **na virman** — most e-invoices, every utility bill, a hand-typed
  one marked virman — waits, until `paid_at` is set.
- **Računi → Za platiti**, above the receipts: every unpaid one, latest due
  date first, "kasni 3 dana" in red, and **✓ plaćeno** on the row. One tap
  marks it paid today; the row turns into "✓ označeno plaćeno · poništi"
  for six seconds, so a wrong tap costs another tap, never a dialog. A tap
  on the name opens the receipt.
- An open receipt says *Nije plaćeno · dospijeva 20. 10.* with the same
  button, or *✓ Plaćeno 12. 10.* with "nije plaćeno".
- **Pregled** leads with *Za platiti 4.370 € · 6 računa · 3 kasne ›*, across
  all months — last month's bill is still owed.
- **Due date** (`due_date`): from the e-invoice (UBL `DueDate`, or the payment
  means' `PaymentDueDate`), or read off a photographed invoice ("datum
  dospijeća"). Without one the row says when the invoice was issued.
- API: `POST /api/troskovi/<id>/placeno {paid: true|false}`; the date is the
  server's Zagreb day.

Not done, on purpose: MER is not told anything is paid (read only, as above),
and payment is not matched against the bank — that would need the bank's
statement, and is a later step if Filho wants it.

### One pill that toggles (owner, 2026-10-12, same day)

"Should we just click on NEPLAĆENO / PLAĆENO and it toggles? just like we do
for NOVO." So the Za platiti buttons and the "poništi" step became one pill on
**every** read receipt — in the list and in Za platiti — reading PLAĆENO,
NEPLAĆENO, or KASNI past the due date. A tap flips it; the next tap flips it
back. No confirm: it is reversible in one tap and loses nothing, which is the
same reasoning NOVO uses. A row paid from Za platiti stays there six seconds
so the same pill is still under the thumb.

Until he taps, the default is the way it was paid: card or cash (Konzum Plus
at the till) = paid, virman = not. `paid_at` therefore has three states — a
date (he marked it paid), `"ne"` (he marked it not paid, which also overrides
a card receipt he is still settling), empty (the default).

The made-up demo ("Pogledaj primjer") was removed at the owner's request —
the tab has real receipts now.

### No separate Za platiti list (Filho, 2026-10-12, same evening)

"Znači da bude samo po mjesecima i da na svakom stoji opcija plaćeno /
neplaćeno i ti samo klikneš i mijenjaš, ali bez ove gornje za neplaćene
posebno." The Za platiti card above the receipts and the Pregled banner are
gone; the pill on each receipt, month by month, is the whole of it. What is
above in this section about the list and the banner is history.

## A long month kept clean (owner, 2026-10-12: "many invoices — pretty but clean")

- **One month at a time** in Računi, with Pregled's ‹ month › and the same
  month in both tabs.
- **Supplier as a person says it**: the legal form and anything after it is
  dropped ("SELECTA ADRIA d.o.o. za trgovinu" → Selecta Adria), all-capitals
  words get ordinary ones unless they are 3 letters or fewer (HEP, CWS). The
  full name, the number of lines and who added it are on the opened receipt.
  Pregled and Cijene use the same short name.
- **One quiet line** under a supplier: its kind, in the kind's colour, and
  the date.
- **Twin photos are out of the way**: a photo that also arrived from MER is
  hidden, with "2 slike — stigle i kao e-račun ›" under the list.
- **Neplaćeno** is a chip at the end of the kinds row — a filter, never a
  section of its own, which is what Filho asked to be rid of.
- **Search** covers every month: supplier, invoice number, a line's name, or
  the amount ("523" or "523,65"). It redraws only the list, so the phone
  keyboard stays up.

## Receipts by kind (Filho, 2026-10-12)

"Bilo bi dobro ako bi moglo i račune razvrstavat. Kao hrana, piće, potrošno,
režije." Računi has a row of chips — **Sve · Hrana · Piće · Potrošno ·
Oprema i održavanje · Režije i usluge · Ostalo**, each with its count, only
the kinds that occur. A receipt's kind is the group most of its money went
to, computed from its own lines (no new field), so re-filing a line moves the
receipt with it; each row names its kind in the group's colour. The month
totals follow the chosen kind. Pregled's bars stay line by line — a Selecta
invoice that is mostly food but carries detergent splits there correctly.

## As printed, priced with PDV — and who marked it paid (owner, 2026-10-12)

"Numbers are made up — Teranino didn't cost like you put it." They were
converted, not made up: the reader turned bottles into litres and added PDV,
and the receipt showed only that (4,2 l × 28,50 € for 6 × 0,7 l). Each line now
keeps the paper's quantity and unit (`doc_qty`, `doc_unit`, `doc_price`,
`discount`, `doc_total`, `vat_rate` — copied, never derived) and is **shown
with PDV**, as the owner asked: *6 kom × 19,95 € · s rabatom 5% … 119,70 €*.
A till receipt prints with PDV already, so its price is the printed one. The
per-kg/l price lives only in Cijene. "Pročitaj ponovno" re-reads a photo,
keeping categories chosen by hand.

**Povijest** lists PLAĆENO / NEPLAĆENO taps with who made them, among the wine
list's changes. The wine list's history is its git log; receipts never touch
git, so these come from `expense_events` in D1 (`GET /api/troskovi/povijest`,
staff key), with supplier and amount copied in so a deleted receipt still
reads. The toggle sends `by` — the name /admin is signed in as, as for NOVO.

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

## Plaće (owner, 2026-10-13)

"We would need Plaće category … I would upload it as 1 document from the
gallery; total price is only what matters, but you need to recognize the
month." A payroll document (obračun plaće, rekapitulacija, platna lista,
JOPPD) is read as **one item**, `Plaće za rujan 2026`, category `place`:

- the amount is the employer's full cost (ukupni trošak / bruto II); if the
  paper shows only net or gross, that is taken and the note says which;
- `doc_date` is the last day of the month the salaries are **for**, not the
  day it was printed, so September's pay counts in September;
- no employee's name, OIB, IBAN or individual pay is kept anywhere;
- Plaće is its own group (chip, Pregled bar), never compared in Cijene.

They come as the bank's **Popis naloga za plaćanje** (the owner's example:
17 orders sent 15.09.2026 — pay "Plaća i naknade KOLOVOZ 2026", income-tax
advances and contributions "za KOL 2026", one obustava; Ukupno EUR
15.897,77). The total is Ukupno EUR, the month is KOLOVOZ (so 31.08.), and
because a list of executed orders is proof of payment the reader also
returns `paid_date` (15.09.) — the receipt arrives PLAĆENO. A mark set by
hand is never overwritten.

## Reading runs: 24 e-invoices, 8 photos (2026-10-13)

113 runs in one night at 8 receipts each, every one re-sending the prompt
and ~400 known keys. E-invoices are exact text, so a run now takes up to 24
(`BATCH_EINVOICE`); photos stay at 8 (`BATCH`). 160 turns a run. A run Claude
refuses to start reports `retry` (back in line, try not counted, reading
paused 30 min); a silent batch is requeued after 15 min; the workflow has no
concurrency group (GitHub cancelled waiting runs and stranded their batches);
reports back retry on a dropped connection.

## PDFs from the gallery (owner, 2026-10-13)

"Gallery should also accept PDF as well." Galerija takes `.pdf` beside
images; a PDF is sent as it is (no shrinking — it is text already), up to
1,5 MB like a photo, stored with the photos, shown as "📄 Dokument u PDF-u",
and handed to the reading run as `work/photos/<id>-<n>.pdf`, which Claude
reads directly. An e-invoice's own PDF still stays out of the run.

## Cijene compares the printed price (2026-10-13)

With the whole year in, the biggest "moves" were the reader's per-kg
conversion being unsteady: the same "3 kom" of ricotta at 7,70 € was 0,75 kg
one week and 3 kg the next (−75%). A line with the paper's numbers now
compares **total ÷ printed quantity** — with PDV, after the line's rabat — in
the printed unit; only old photo lines without them fall back to the
converted price. The "jump no real price makes" guard (+60% / −40%) covers
everything except weighed fresh food (a "kom" of peas is a bag): a Tabasco
jar and its box of twelve shared a name too.

Year check the same morning: 660 receipts, all read; every 2026 document
in the MER export is in Troškovi; 3 March invoices written twice by two
imports running at once were deleted (and the import can no longer do it);
6 other same-number pairs are real. 292 products compared, 12 to check.

## Cijene: Plaće month by month, and sorting (owner, 2026-10-13)

"Plaće could also be in Cijene … some sorting (asc/desc when I click)."
- **Plaće · po mjesecu** is one row: each month's payroll documents added
  together, compared month against month like a product (never set aside
  as "two articles", salaries move with the season). It appears once two
  months have one.
- **Promjena · Potrošeno · Naziv**: a tap sorts by it, a second tap turns it
  round. Default: biggest rise first.
- September–December 2025 imported from MER the same day (24 documents).

## PDV (Filho, 2026-10-13: how much PDV he has to pay)

PDV za uplatu = izlazni PDV (sales, from the Remaris till) − pretporez
(purchases, from Troškovi). The accountant: **monthly**, **fakturirana
realizacija** (by invoice date — an invoice counts in its own month, paid or
not), and the accountant takes out what is not or only partly deductible
(reprezentacija, cars), so the tab says it is an estimate and why.

- Tab **PDV**, same month switch. Pretporez: every receipt with PDV in the
  month; for an e-invoice rate by rate from its lines (gross − net; the sum
  matches the invoice total — September 4.919,71 € both ways); a credit note
  subtracts. A photographed receipt counts only if made out to the company
  (R-1), which cannot always be told, so its share is shown apart. Cash with
  no receipt and Plaće carry no PDV.
- Izlazni PDV: Remaris can export CSV from its back office. Waiting for a
  sample month to learn the layout; it will be parsed on the server, no
  reading run.

## Faster to open; MER twice a day (owner, 2026-10-13)

"It takes even 5 seconds when I click Troškovi." Five pages one after
another. Now the newest 60 are shown as soon as they arrive, the first page
says how many there are, and the rest are asked for all at once. Coming back
to the tab shows what is already loaded and freshens it with the newest page
(a full reload past 5 minutes); while receipts are being read the 10-second
refresh asks only for the newest page, every sixth a full one.

MER is now also asked at **9:00 and 16:00 Zagreb** by `mer-sync.yml` in the
private repo (cron at both possible UTC hours, the step goes on only at 9 or
16 in Zagreb), with the reading run's key; it asks until nothing is left.
Opening the tab still checks too (at most every 30 minutes).

PDV: "PDV za uplatu" is the first card; the 6 months run newest first.

## Prihodi — the till's bills from Remaris (owner, 2026-10-13)

"The counterpart of Kamo idu novci … income and expenses at the same admin
place, and only then PDV." And: "this process has to be automated — I don't
want to click every day or force anyone to do this."

- **Remaris has no API** (Monri's manual, docs.monri.com, documents none; the
  sales contact said "export CSV"). Its back office has *Analiza podataka →
  Excel podaci → Računi*: every bill with its lines, storno bills, fiscal
  data (JIR/ZKI) and each line's tax group.
- **The morning run does those clicks as plain HTTP**, no browser:
  `theatrium-troskovi/remaris/sync.py`, scheduled 6:00 Zagreb by
  `remaris-sync.yml`. Log in (form post), `POST /ExcelData/StartExcelGeneration`
  `{RequestGuid}`, `POST /ExcelData/GetInvoiceExcel?startDate&endDate&organizationId
  &locationId&includeCanceled=true&exportInvoiceItems=true&exportFiskalizationInfo=true
  &exportTaxGroupSign=true&includePivot=false&requestGuid`, poll
  `ExcelGenerationStatus` for `downloadUrl` (remarisfiles.gastromaster.com.hr),
  download, `GET /Account/LogOff`. Mapped 2026-10-13 by a one-off probe (in
  that repo's history). Read-only: it never opens any other screen.
- **The last 4 days every morning**, so a storno or a changed payment method
  from yesterday lands. Each export is the truth for its days: bills are
  replaced, and one the export no longer has is removed — except that an
  *empty* export never deletes (a glitch must not wipe days). Backfill by hand
  with the workflow's from/to; it exports a month at a time.
- **Credentials** are the owner's Remaris user (`REMARIS_USER`/`REMARIS_PASS`
  secrets, `REMARIS_URL` variable, in theatrium-troskovi); the run posts with
  `EXPENSE_WORKER_KEY` to `/api/prihodi/uvoz`, ≤ 40 bills a post (a free
  Worker's CPU). The log prints counts only.
- **Stored** in `sales_bills` / `sales_lines`, id = year/fiscal number — the
  numbers restart every January. A storno is its own negative bill, so sums
  are right as they are. `/api/prihodi?mjesec=` sums a month in SQL.
- **/admin**: Troškovi gets a *Prihodi* view (month, days, payment methods,
  sales groups, company customers, 12 months); *Pregled* opens with Prihodi −
  Troškovi = Ostaje; *PDV* fills izlazni PDV (total − net per line tax group)
  and PDV za uplatu. A failed run shows its reason under Prihodi, and GitHub
  mails the owner.

### Pregled redone; writes kept small (2026-10-14)

- **D1's free plan writes 100.000 rows a day, and an index entry is a row.**
  The January–October backfill (4.500 bills, 36.000 lines) used ~85% of one
  day on its own (Cloudflare's warning, 2026-10-13). A bill now carries a
  content hash `h` and is written only when it changed, so the morning run's
  4-day overlap costs only the new bills (a few hundred rows). Any future
  backfill: a few months per day, not a year.
- **Pregled** (owner: "simple and effective … relevant stats"; Filho: "rubrike
  Vino, Žestoko, Hrana"): Prihodi − Troškovi = Ostaje with its margin; then
  *Po rubrikama* — Hrana, Vino, Žestoko, Kava/sokovi/voda — sold (the till)
  against bought (the receipts) and the share; the costs that are not goods;
  six months in and out. Suppliers and the biggest lines left Pregled
  (Računi and Cijene have them).
- A till line's rubrika: food by tax group H; a drink is wine when its sales
  group says so (vin, šampanj, pjenušac), alcoholic (P) otherwise žestoko,
  non-alcoholic (N) kava/sokovi/voda. Beer is sold under "Rakija, grappa,
  pivo" but bought as pivo_sokovi — said under the table.
- **Prihodi** no longer shows payment methods (owner: not relevant); it shows
  the average bill, and "Što se prodaje" by rubrika, opening onto the till's
  sales groups.

### Pregled leads the owner somewhere (2026-10-14)

"Not generic data, but the useful ones … to drive him to the right
direction" — and the owner is the chef. Pregled opens with **Na što se
usredotočiti**: findings ranked by the euros a month at stake, each with the
evidence and one thing to do. A finding with no honest euro figure ranks
after those with one. Five shown, the rest on a tap. What it looks for:

- a rubrika's cost share (3 months, net) **above** its usual band — euros =
  the part above the band; or far **below** it — most likely missing receipts
  (cash at the market), said as such;
- **supplier price rises** this month: (new − previous price) × what was
  bought now, per product, from the Cijene history (`priceHistory()`);
- **wine per bill by waiter** — euros = lifting everyone below the median to
  it; it says lunch shifts explain part of the gap;
- **discounts and free items**, and who gave the most;
- the **average bill** falling ≥5% against last month;
- **dishes selling less** than last month, per open day (a running month
  compares fairly) — euros = the shortfall;
- **dishes sold ≤4 times** in a month — the chef's candidates to drop;
- the **weakest weekday** against the strongest; **storno** as a control.

Below it: the result **without PDV** (the till's lines carry their net; a
receipt line its e-invoice net, else its receipt's net ÷ gross), **prime
cost** = (goods + plaće) ÷ net income, PDV to set aside, the rubrike with
month and 3-month shares against their usual bands (25–35% food, 30–45% wine,
15–25% spirits, 15–30% coffee/soft drinks — orientation, not law), the other
costs and six months, all net. A past month with no Plaće says so on top: the
result is too high without them, and they belong under the month they pay for.

Prihodi gained the evidence: the dishes and wines that carry the month (▲▼
per open day against last month), the week, lunch against dinner (16 h), and
each waiter's bills, average bill, wine per bill and discounts. Payment
methods are gone (owner: not relevant).

### Filho's cut: three cards (2026-10-14)

Filho on the list above: "Prosječni račun je ok. Vina po računu. Ostale
opaske su nebitne — nekad imaš puno ulaza rakije, al se prebacuje dalje",
and "Meniji su grupe, zato ih nema uvijek". The owner: the house may be in
danger; give him numbers to steer by. So Pregled leads with exactly three:

1. **Prag isplativosti** — over the last 3 complete months, net: of each euro
   sold, what is left after the goods (`keep`); every other cost (plaće,
   režije, usluge, oprema, potrošno…) ÷ `keep` ÷ open days = what must be sold
   per open day. Against what is sold: above it is profit, below it says how
   many bills more a day, or how much more per bill, closes the gap. Until
   plaće are entered for all three months it says so instead of a number.
2. **Prosječni račun** — against last month, lunch and dinner.
3. **Vino po računu** — against last month, share of bills with wine, by
   waiter, and the euros to the median.

Storno, discounts, cost-share alarms, falling and slow dishes and weekdays
are gone from Pregled; the rubrike show the 3-month share only. Group menus
(Repertoire, "MENU 60") are never ranked or trended as dishes; Prihodi shows
them as one line.

### Last year, and the Monday e-mail (2026-10-14)

- **2025 comes from Remaris a month a morning**: after the daily 4 days,
  `sync.py` asks `/api/prihodi/uvoz` (GET) for the oldest day held and
  exports the month before it, back to January 2025 — ~10.000 rows written a
  morning, a tenth of D1's free day. A month that comes back empty sets
  `floor` and the search stops. Only **income** is compared with last year:
  e-invoices (MER) were not mandatory in 2025, so 2025 costs are incomplete;
  the till's bills are not.
- Prihodi's header and Pregled's average-bill and wine cards say "lani" once
  the month a year back is in.
- **Monday 8:00 Zagreb**, `weekly-report.yml` (theatrium-troskovi) asks
  `/api/prihodi/tjedan`, which writes last week against the week before and
  the same week last year — turnover, average bill, wine per bill, the days,
  the five dishes, the month so far — and sends it through web/alerts.
  Spend per guest sits under the average bill (owner, 2026-10-14), with lunch
  and dinner apart and the guest count, each against the week before. That
  sender can only write to the address verified in Cloudflare Email Routing
  (today the owner's Gmail); Filho's address needs verifying there first.
  `{dry: true}` returns the text without sending.

### Vinska karta i blagajna (2026-10-14)

Prihodi shows, over the last three months, which list wines sold (bottles and
glasses, takings), how many list wines did not sell at all, and the till's
wine lines it could not tie to the list. The till names wines its own way, so
`matchTill()` in js/admin-expenses.js uses `TILL_ALIAS` (names confirmed by
hand) and otherwise a strict rule: the producer's words, every other word of
the till name in the wine's name (a word of 4+ letters may be cut short), a
vintage at most 3 years off (till articles keep old vintages in their names),
and a tie is no match. A wrong wine is worse than none. On 2026-10-14 it tied
90% of July–September wine takings. The rest is for Filho: wines sold that
are not on the list (Bregh Blanc de Blancs, Tomac Millenium, Château de Pez
2016…) and ambiguous names ("HENRI GIRAUD 0,75": Esprit or Hommage?, "Via de
Romans 0,1", "C.COSTANTI, BRUNELLO": 2018 or 2020?). Each answer is one line
in TILL_ALIAS.

Fair to a list that changes (owner, 2026-10-14: "the wine list changed, so
be reasonable about it"): a wine is called unsold only if it was on the list
the whole period and is not 86'd now, cheapest first — a trophy bottle that
waits is normal, an everyday one is not. Wines added during the period are
shown apart, with what they sold so far. The dates come from git history:
`scripts/list-since.mjs`, run by site-files.sh into `data/list-since.json`
on the deploy (checkout with fetch-depth: 0); history starts 2026-07-31, so a
wine dated then counts as listed before it. July–September: 175 wines listed
throughout did not sell once, 41 were new.

### Konobari, and the Monday e-mail to Filho (2026-10-14)

Filho: "koji je konobar što prodao, i koji promet ima i što mu je palo …
jer onda mogu upozorit i ispravit — dal mu fali aperitiv, dal više proda
pjenušca a ne šampanjca". `staffReport()` (web/functions/_lib/sales.js)
puts every till line in a category (`STAFF_CAT`: kokteli i aperitivi,
šampanjac, pjenušac, vino na čašu / na bocu, desertno vino, predjela,
deserti, žestoko) and gives each waiter the share of their bills with it,
against what the others sell **at the same mix of lunches and dinners** — a
lunch waiter is not expected to sell dinner's aperitifs. A flag needs 15+
bills, an expected share of 5%+, and the waiter below 70% of it **and** 5
points under. Champagne vs sparkling: of what a waiter sold in bubbles, the
champagne share against the others', once there are enough sales to mean it.
Prihodi shows a card per waiter (takings, bills, average, wine per bill,
the flags, and what fell against their own last month; a tap shows every
category); Pregled's fourth card lists the flags; the Monday e-mail has a
section per waiter for the week.

The Monday e-mail goes to the owner and Filho (filip.horvat1312@gmail.com):
web/alerts sends `to: "weekly"` to `MAIL_TO_WEEKLY`, one message per address,
and the send_email binding allows exactly those two. **Each address must be
verified in Cloudflare → Email Routing → Destination addresses**; until Filho
clicks Cloudflare's link, his copy fails and the owner's still goes.

### The first card is profit against Filho's goal (2026-10-14)

The card said the revenue above break-even "is profit" — it is not: profit
is that × what is left of each euro after the goods. It now reads **Zarada:
X € po radnom danu, cilj 1.000 €** (Filho: "dnevna zarada 1k € dnevno, što
je meni cilj, tako i držat"; `PROFIT_TARGET`), with sales and break-even net
and with PDV, **every cost it counts, by category, per month** — so a missing
one shows — and what closes the gap in bills a day or euros per bill.
Filho expects break-even at 3.000–3.400 € a day against the 1.473 € (net) the
data gives: costs are missing from Troškovi, or his figure is gross; asked.

Filho's corrections the same night: his own table (Manuela rang it "7×, po
500 € vina, nema hrane") — a bill with no food and 300 €+ of wine — is set
apart (`OWN_TABLE`) and left out of every waiter comparison, the average
bill and wine per bill, and shown as its own line; "Filip Horvat" is the
owner (`OWNER_WAITERS`), listed but never compared nor part of the others'
baseline; and a category is judged only on days someone sold it ("bilo je
dosta dana bez deserta"). Each card also names the waiter's top three wines
(Filho: Ahmed and Benjamin sell more Jules, Stela more Croatian). Open: 256
of September's 578 bills are under the owner's name — if others ring on his
login, they cannot be attributed. `isMenu` matches whole words since
"KAMENICA" (oysters) was taken for a menu.

## Potrošnja po gostu (owner, 2026-10-14)

"We need average spendings per guest … map it with number of couverts."
`guestData()` in `_lib/sales.js` counts a bill's guests as its **couverts**,
or the persons on a **group menu** when that is more (a group may not be
charged a couvert). A storno bill takes its couvert back. Per guest = the
takings of bills with guests ÷ those guests, for the month and for lunch and
dinner apart, with ▲▼ against last month. Bills with no guest on them (the
bar, a coffee, the owner's table) are shown as their own line, neither
averaged in nor lost. It is only as good as the couvert: a table the waiter
forgot to charge one counts nowhere, so the share of bills without one is
worth watching.

## Blagajna ↔ vinska karta, 1:1 (owner, 2026-10-14)

"I need clarity on this topic and precise 1:1 mapping … each time we pull from
Remaris, the new occurrence may happen." The fuzzy matcher guessed on every
page load and remembered nothing. Now **`data/till-map.json`** holds every
till wine article once: `{ref, vol}` (the list wine and the size it pours,
0.1 = glass), `{ref, vol, ask}` (a suggestion waiting for Filho, not
counted), or `{none: "nije na karti" | "nije vino", why}`.

- All 371 wine articles sold Dec 2025 – Oct 2026 were mapped by hand on
  2026-10-14: 263 confirmed, 17 asked, 82 sold but no longer on the list,
  9 not wine at all (MENU 68, Römerquelle, gin tonik… rung under wine groups).
  The old matcher had several of them wrong — Le Volte dell'Ornellaia as
  Ornellaia, Bürklin-Wolf Goldbächel as Gaisböhl, Crochet's Sancerre as
  Cotat's, Marjan Simčič Pinot Grigio as the Opoka Pinot Noir.
- **Only `{ref, vol}` counts.** An article the map has never seen, or one with
  `ask`, goes to **Za povezati** with the strict matcher's suggestion; one tap
  (✓, another wine from the list, *nije na karti*, *nije vino*) commits it to
  the file through the GitHub contents API, like the 86 board — one commit per
  article, a 409 re-reads instead of writing over. Every later Remaris pull is
  read against it, so only genuinely new articles are ever asked.
- The map is read from GitHub, not the site, so a confirmation does not come
  back as a question while the deploy runs. `validate.mjs` fails a ref that is
  not in the library or an entry without a size.
- **U blagajni u krivoj grupi** compares the till's group with the one the
  wine belongs in — "Vina na čaše" for any glass, otherwise Šampanjci /
  Pjenušci / Desertna / Bijela|Crvena vina + the till's country pair. 93 of
  289 articles were wrong; "Bijela vina DE/AUT" had become a catch-all
  (Sassicaia, Brunello, Amarone, glass pours). That matters beyond tidiness:
  the waiter comparison sorts čaša / boca / šampanjac by the till's group.

## Marža po vinu (owner, 2026-10-14)

"Do we even make money on drinks?" In Prihodi → Vinska karta i blagajna,
**Marža po vinu** sets each wine's purchase price against the list:

- **Cost** comes from the supplier receipts in Troškovi (net of PDV), mapped
  once per supplier line name in **`data/buy-map.json`** — names and sizes
  only, never a price (the repo is public; prices stay behind the receipts
  API). A purchase in the size the list sells wins over a 3 l or a magnum,
  which cost more per litre; then the latest.
- **Cost %** = net cost ÷ list price without PDV (25%), per bottle and per
  glass. A glass costs its pour — the till article's 0,1 or 0,05; 0,05 for a
  dessert wine not yet sold by the glass. 60% and up is shown in red.
- **Earned** in the three months = till takings without PDV minus litres
  sold × cost per litre.
- Supplier lines the map does not know yet wait in **Nabava, za povezati**,
  answered with the same one tap, committed as "Nabava: X → Y".

Found on the first run (2026-10-14): on the 109 wines with a known cost, cost
is 39% of net wine sales. Benvenuti Malvazija alone earned ~8.100 € since
December. Below cost or nearly: Quintarelli Amabile del Cerè at 25 € a glass
(costs more than it earns even at 0,05 l), Prošek Ruža (75–77%), Corte Aura
Franciacorta Brut, and a run of Burgundy priced close to cost (Montevertine
Le Pergole Torte 76%, Chavy Murgers 76%, Jobard Bourgogne blanc 77%, Chavy
Meursault Charmes 73%). Bernard-Bonin invoices five Meursaults under one line
name, so they carry no cost until they are told apart.

**A glass is poured 0,1 l, and a bottle gives 6** (owner, 2026-10-14 —
both facts, after an afternoon of treating them as alternatives). The till
sells "0,1" articles; the rest of each bottle goes to tasting, topping up and
the last drop. So a glass costs a sixth of the bottle (`costVol()`), and the
glass rule compares 6 glasses with the bottle price. Cost is 44% of net wine
sales on the 110 wines with a known cost.

### Cijene, prijedlozi

The target cost share rises with what the bottle costs us (`COST_TIERS` in
js/admin-expenses.js): 30% to 15 € net, 33% to 35 €, 38% to 80 €, 45% to
200 €, 55% above — a guest knows the shop price of a famous bottle, so a
trophy cannot be multiplied like an everyday wine. Every cost share in Marža
po vinu is coloured against its own wine's target (green on target, amber
3–12 points over, red 12+ over, blue 15+ under), with the tier table as the
legend. Cheap: a bottle 12 points over target; a glass 7 points over, or the
6 glasses of a bottle earning under 110% of the bottle's price. A
suggestion is the target price, never more than +40% in one step.
Expensive: 15 points under target with no bottle sold in three months.

## Tvrtke (owner, 2026-10-14)

"Proactive approach to companies from the invoices, and a custom tailored
approach for each of these companies when they arrive." In Prihodi, each
company is a row that opens its card: bills, first and last visit, guests and
spend per guest against the house, lunch or dinner, the usual weekday, wine's
share, virman, what they eat and drink most, and advice (`companyAdvice()` in
_lib/sales.js — each line from their numbers against the house's: not seen
for 60+ days, paid by the firm, comes as a group, comes for lunch, little
wine, no aperitif, no dessert unless a set menu covers it, spends well above
the house). Staff keep a note per company (`sales_companies`, by OIB) through
`PUT /api/prihodi/tvrtke`. Under the month's companies, **Za nazvati** lists
those that came twice or more and not for 60 days. The habits are summed from
the bills on every read; nothing about a company is stored but the note.

`/api/prihodi?od=&do=` returns any span up to 93 days (days, articles,
weekdays, waiters, guests) — used to judge one evening, such as a daily offer.


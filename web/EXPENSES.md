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
   12 runs a day, 200 a month, 3 tries per receipt, a batch silent for 30
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

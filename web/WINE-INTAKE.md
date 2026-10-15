# Novo vino — Filho adds a wine himself

Owner, 2026-10-10: Filho photographs a bottle and types the price; Claude does
the rest by the house conventions; the owner keeps full visibility; it works
with the owner's laptop off; it must not be a way to spend his Claude
subscription or to reach anything else.

## The flow

```
/admin "Novo vino" (wine list)        /api/vina (this site, D1)           GitHub Actions (jsiljeg/list)
──────────────────────────────        ─────────────────────────           ───────────────────────────
1–3 photos (front + back),   ──POST─▶  wine_requests: queued
price, size, "my pick"                  pump(): brakes ok? ──dispatch(id)─▶ add-wine.yml
                                                                             job 1: Claude + add-wine skill,
                                                                                    no write credentials
                                                                             job 2: validate, push wine/<id>
question in Croatian         ◀───────  needs_info  ◀──────stanje──────────  "alcohol not legible"
answer / another photo       ──POST─▶  queued → pump() → dispatch again
preview of the card          ◀───────  ready (result, branch)  ◀──stanje──
"Objavi na karti"            ──POST─▶  publishing ──dispatch(id)─▶          publish-wine.yml: merge if valid
                                       published  ◀──stanje──────────────
```

## The brakes (functions/_lib/wines.js)

| Brake | Value | Why |
|---|---|---|
| `WINE_INTAKE_ENABLED` | must be `"1"` | the owner's off switch; without it requests wait |
| one at a time | — | a second request waits for the first |
| `DAILY_CAP` | 5 | owner's choice |
| `MONTHLY_CAP` | 60 | the subscription has no hard $ limit, so ours is the limit |
| `MAX_RUNS` per wine | 3 | first run + two rounds of questions |
| photos | ≤ 3 per post, ≤ 6 per wine, ≤ 1,5 MB | shrunk to 2000 px JPEG on the tablet |
| stale run | 40 min | a dead runner cannot block the queue |

Caps are counted from `wine_dispatches`, a log, never from request rows.

**Both Claude accounts at their limit** (2026-10-15). A run tries
`CLAUDE_CODE_OAUTH_TOKEN`, then `CLAUDE_CODE_OAUTH_TOKEN_2`. When both refuse,
the run reports `retry`: the wine goes back in line with that run and its
dispatch taken off MAX_RUNS and the daily cap (nothing was tried), held for
`RETRY_MIN` (30 min, an `updated_at` in the future that `pump()` skips), and
the owner gets one e-mail. That day it had instead failed twice in 2 seconds,
because the step ran claude under `bash -e` and never reached the second
account; `scripts/check-claude-runs.mjs` now fails any such workflow.

## Who can do what

- **Staff** (`STAFF_KEY`, the daily offer's key): create, answer, publish,
  cancel, retry. Cannot report run results.
- **Worker** (`WINE_WORKER_KEY`, only in the GitHub environment): read a
  request and its photos, report progress. Cannot create or publish.
- **Dispatch** (`GH_DISPATCH_TOKEN`, fine-grained, `jsiljeg/list`, Actions:
  read & write only): starts the two workflows. Cannot push code.
- The workflows have **only `workflow_dispatch`** as a trigger, and take the
  request id as their only input. Nothing Filho types reaches the dispatch;
  the run reads his remark and answers as data.
- CORS allows only the wine list's origin (and localhost for tests).

## Status

`queued → working → needs_info | ready | failed`, `ready → publishing →
published | failed`, any unpublished → `cancelled`, `failed → queued`
(retry, inside `MAX_RUNS`). Enforced in `api/vina/[id]/[action].js`.

## Local test

```
cd web
npx wrangler d1 execute theatrium --local --file=schema.sql
printf 'STAFF_KEY=…\nWINE_WORKER_KEY=…\nWINE_INTAKE_ENABLED=1\n' > .dev.vars   # gitignored
npx astro build && npx wrangler pages dev dist --port 8799
```

The admin page takes `window.WINE_API` to point at it.

## Progress, step by step (2026-10-11)

The request card shows what a run is doing while it does it. The write job
streams Claude's output (`--output-format stream-json`) through
`.github/wine-intake/progress.mjs`, which turns each tool call into a short
Croatian step ("Čita etiketu", "Istražuje · wittmann-weingut.com", "Bira jela
uz vino") and posts it as `{phase}` to `/stanje`; the commit job and the
publish workflow post their own steps with curl. Steps live in the side table
`wine_progress`, reset at the start of every run and every publish. The
worker key reaches progress.mjs only — Claude runs under `env -u WK`.

A phase-only report changes nothing but the list and is accepted only while
the request is `working` or `publishing`. Posting is best effort: a step that
fails to send is overtaken by the next, and cannot fail the run.

Two bugs fixed the same day, both on the first real publish: publish-wine.yml
wrote `req.json` into the workspace and `actions/checkout` then cleaned it
away (now in `$RUNNER_TEMP`); and add.py always wrote CRLF, so on the Linux
runner a 54-line card rewrote every line of both data files (add.py now keeps
the file's own ending, and both jobs strip CRs before committing).

## Robert Parker, in the cloud (2026-10-11)

The owner's subscription is **commercial**, which is what allows the scores
on the list at all (personal subscribers may not reproduce them; commercial
ones may, for wines they sell). Their agreement forbids robots "designed to
systematically download the Content"; one lookup per new wine is not that.

After the card is applied, the commit job runs `.github/wine-intake/parker.mjs`
— a fixed Playwright script, no AI — with `PARKER_USER` / `PARKER_PASS` from
the `wine-intake` environment. It logs in, searches by URL, picks the result
that is this wine and vintage by rule (producer present, the wine's own words
present, nothing extra, same vintage), reads the score from the wine's page,
and the job records it with `scripts/parker-add.py` + `rank-ratings.py`.
Outcomes on the preview: the score on the card; "Parker još nije ocijenio
ovu berbu" (re-checked daily by the pr-checkups sweep); or "Parker nije
provjeren" with the candidates in `flags` for the owner. Skipped when the card
already carries a Parker score. Titles and scores only are printed — never
review text, the repo and its logs being public.

Verified on 2026-10-11 against the hand-checked values: Wittmann Aulerde GG
2020 → 94, 2023 → 94. **No logout**: the logged-in header has no account
control the script can find, so each lookup ends by discarding the browser.
The subscription allows one device at a time; if the owner's own Chrome is
ever logged out, this is the likely cause. `parker-test.yml` runs a lookup
on its own, by hand.

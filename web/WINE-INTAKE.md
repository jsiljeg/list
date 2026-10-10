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

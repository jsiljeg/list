# scratch/

One-shot migration and analysis scripts, kept because the reasoning in their
comments is the record of *why* the data changed:

- `add-regions.py`, `add-maps.py`, `fix-maps.py` — the five new region cards
  and their maps, plus the second pass after looking at them rendered.
- `doc.py` — the CLAUDE.md sections for 2026-08-02.
- `analyse.mjs`, `why.mjs`, `subregions.mjs` — what the pairing vocabulary and
  the region coverage actually looked like before the fixes.
- `helper-sim.mjs` / `helper-sim2.mjs` — 400 passes over every dish × budget,
  before and after, to measure how concentrated the sommelier's suggestions are
  and how many bottles it never proposes. Re-run `helper-sim2.mjs` after any
  change to the scoring or the tags.

Nothing here ships; `.github/workflows/deploy.yml` deploys the repo root, so
these are served but unreferenced.

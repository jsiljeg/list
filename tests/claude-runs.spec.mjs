/* Two Claude accounts, and a usage limit on one of them (2026-10-15).

   Caught: GitHub runs steps under `bash -e` and claude exits 1 on a usage
   limit, so add-wine, the daily offer and the receipt reader all died on the
   first account — the second was never tried, and Filho's wines and receipts
   came back "nije pročitan" in 2-second runs. Guards:

   - scripts/check-claude-runs.mjs passes on this repo's workflows, and fails
     on a step that runs claude under bash -e (the shape that shipped);
   - when both accounts refuse, a wine goes back in line ("retry"), uncounted,
     instead of failing and eating Filho's five runs. */
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const script = join(process.cwd(), "scripts/check-claude-runs.mjs");

test("every Claude step here survives a usage limit on one account", () => {
  const out = execFileSync(process.execPath, [script], { encoding: "utf8" });
  expect(out).toMatch(/^OK/);
});

test("the guard fails a claude loop that runs under bash -e", () => {
  const dir = mkdtempSync(join(tmpdir(), "wf-"));
  mkdirSync(join(dir, ".github/workflows"), { recursive: true });
  writeFileSync(join(dir, ".github/workflows/x.yml"), `jobs:
  a:
    steps:
      - name: Read
        env:
          TOKEN_1: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          TOKEN_2: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN_2 }}
        run: |
          set -uo pipefail
          for T in "$TOKEN_1" "$TOKEN_2"; do
            CLAUDE_CODE_OAUTH_TOKEN="$T" claude -p "x" \\
              --output-format json > out.json
            jq -e '.result | test("usage limit reached")' out.json || break
          done
          jq -e '.is_error != true' out.json
`);
  let failed = "";
  try { execFileSync(process.execPath, [script], { cwd: dir, encoding: "utf8", stdio: "pipe" }); }
  catch (e) { failed = String(e.stderr); }
  expect(failed).toContain("bash -e");
});

test("a wine both accounts refused goes back in line, uncounted", () => {
  const wf = readFileSync(".github/workflows/add-wine.yml", "utf8");
  expect(wf).toContain('status: "retry"');
  const api = readFileSync("web/functions/api/vina/[id]/[action].js", "utf8");
  expect(api).toMatch(/b\.status === "retry"[\s\S]*requeueLater/);
  const lib = readFileSync("web/functions/_lib/wines.js", "utf8");
  expect(lib).toMatch(/runs = MAX\(0, runs - 1\)/);
  expect(lib).toMatch(/DELETE FROM wine_dispatches/);
  expect(lib).toMatch(/status = 'queued' AND updated_at <= \?1/);
});

/* 2026-10-19: a correction run (Testament, "is the vineyard Jadrtovac?")
   opened its progress with "Čita etiketu" and looked to the owner like the
   whole card starting over, and it repeated the Parker lookup the first run
   had already made. An edit run now says what it is correcting and skips
   Parker. */
test("a correction run says what it corrects and does not re-check Parker", () => {
  const wf = readFileSync(".github/workflows/add-wine.yml", "utf8");
  expect(wf).not.toMatch(/'\{"phase":"Čita etiketu"\}'/);
  expect(wf).toMatch(/second="Ispravlja: \$\{what:-karticu\}"/);
  expect(wf).toMatch(/if \[ "\$MODE" != edit \] && \[ -n "\$ref" \]/);
});

/* 2026-10-22: account 1 was refused with "Your organization has disabled
   Claude subscription access for Claude Code" (17:11 and 18:08 UTC). The loop
   moved to account 2 only on a *usage-limit* message, so it never tried it,
   and the owner got "both accounts at their limit" while the second account
   was nowhere near it. Any refusal to start — limit, policy or login — moves
   to the next account, in every workflow that runs Claude here. */
test("a refusal that is not a usage limit still tries the second account", () => {
  for (const f of [".github/workflows/add-wine.yml", ".github/workflows/daily-offer.yml"]) {
    const wf = readFileSync(f, "utf8");
    const loops = wf.match(/jq -e '\.is_error == true and[^\n]*/g) || [];
    expect(loops.length, f).toBeGreaterThan(0);
    for (const l of loops) {
      expect(l, f).toContain("usage limit reached");
      expect(l, f).toContain("disabled Claude subscription access");
      expect(l, f).toContain("please run /login");
    }
  }
});

/* 2026-10-23: the Parker lookup hung on robertparker.com, ran into the job's
   10 minutes, and a finished 199 € card failed with "Stalo kod: Provjerava
   ocjenu Roberta Parkera". The install and the lookup each carry a limit
   well inside the job's, so a stuck site costs the score, never the card. */
test("a stuck Parker lookup cannot take the card down with it", () => {
  const wf = readFileSync(".github/workflows/add-wine.yml", "utf8");
  expect(wf).toMatch(/timeout -k 10 150 env PARKER_USER="\$PU" PARKER_PASS="\$PP" node "\$RUNNER_TEMP\/rp\/parker\.mjs"/);
  expect(wf).toMatch(/timeout 180 npx --yes playwright@[\d.]+ install/);
});

/* 2026-10-23: with wines published while a card was being written, the
   card's patch no longer applied to main ("patch failed: library/wines.json")
   and a finished 179 € card failed at "Provjerava i sprema karticu". The card
   is saved onto the commit Claude read; publishing merges it forward. */
test("a card is saved onto the list it was written against, not today's main", () => {
  const wf = readFileSync(".github/workflows/add-wine.yml", "utf8");
  expect(wf).toMatch(/id: base\s+run: echo "sha=\$\(git rev-parse HEAD\)"/);
  expect(wf).toContain("base: ${{ steps.base.outputs.sha }}");
  expect(wf).toContain('BASE: ${{ needs.write.outputs.base }}');
  expect(wf).toContain('git checkout -B "$branch" "${BASE:-origin/main}"');
});

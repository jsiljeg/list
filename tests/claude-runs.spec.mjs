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

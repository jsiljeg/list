#!/usr/bin/env node
/* Every workflow that runs Claude must survive one account being at its usage
 * limit (owner, 2026-10-15: "I don't want these surprises any more").
 *
 * What went wrong that day: GitHub runs every step under `bash -e`, claude
 * exits 1 on a usage limit, and the step died on the first account — so the
 * second was never tried, and receipts and wines were reported as unreadable
 * in 2-second runs. The loop over the two accounts was there; it never ran.
 *
 * For each step that calls `claude -p`, this requires:
 *   - both tokens, CLAUDE_CODE_OAUTH_TOKEN and CLAUDE_CODE_OAUTH_TOKEN_2
 *   - a loop over them that stops only on a clean result — any failure
 *     tries the other account (2026-11-04)
 *   - exit-on-error off for the loop: `set +e` before it, or `|| true` on
 *     the claude command itself
 *   - something that reads the refusal after the loop, so a run where both
 *     accounts refused reports that, not a vague failure
 *
 *   node scripts/check-claude-runs.mjs [more workflow dirs…]
 * Checks .github/workflows here, plus any directory given (the private
 * receipts repo: ../theatrium-troskovi/.github/workflows). */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SUCCESS_BREAK = `'.is_error == false'`;
const dirs = [".github/workflows", ...process.argv.slice(2)];
const problems = [];
let steps = 0;

for (const dir of dirs) {
  if (!existsSync(dir)) { problems.push(`${dir}: no such directory`); continue; }
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
    const text = readFileSync(join(dir, f), "utf8").replace(/\r/g, "");
    /* a step = from one "- name:" to the next */
    const parts = text.split(/\n(?=\s*- name:)/);
    for (const step of parts) {
      if (!/claude -p\b/.test(step)) continue;
      steps++;
      const name = (step.match(/- name:\s*(.+)/) || [, "(unnamed)"])[1].trim();
      const where = `${join(dir, f)} › ${name}`;
      if (!/secrets\.CLAUDE_CODE_OAUTH_TOKEN\b/.test(step) || !/secrets\.CLAUDE_CODE_OAUTH_TOKEN_2\b/.test(step))
        problems.push(`${where}: does not carry both Claude tokens`);
      const loop = step.indexOf('for T in "$TOKEN_1" "$TOKEN_2"');
      if (loop < 0) { problems.push(`${where}: no loop over the two accounts`); continue; }
      const before = step.slice(0, loop), after = step.slice(loop);
      /* the claude command: its line and every continuation line after it */
      const lines = after.slice(after.indexOf("claude -p")).split("\n");
      let n = 0;
      while (n < lines.length - 1 && /\\\s*$/.test(lines[n])) n++;
      const command = lines.slice(0, n + 1).join("\n");
      const eOff = /\n\s*set \+e\b/.test(before) || /\|\|\s*true\s*$/.test(command);
      if (!eOff) problems.push(`${where}: claude runs under bash -e — a usage limit ends the step before the second account (add set +e before the loop)`);
      /* The loop stops only on a clean result; anything else tries the other
         account (owner, 2026-11-04). It used to move on only for a list of
         known wordings, and "Failed to authenticate: OAuth token revoked" was
         not on it, so the receipts stopped on account 1 and never tried 2. */
      const body = after.slice(0, after.search(/\n\s*done\b/));
      if (!body.includes(SUCCESS_BREAK)) problems.push(`${where}: the loop must stop only on success (${SUCCESS_BREAK}) and try the other account on any failure`);
      if (/\|\|\s*break\b/.test(body)) problems.push(`${where}: "|| break" — the loop gives up on a failure instead of trying the other account`);
    }
    /* the refusal must be read after the loop, somewhere in the same file */
    const loopAt = text.indexOf('for T in "$TOKEN_1" "$TOKEN_2"');
    const doneAt = loopAt < 0 ? -1 : text.slice(loopAt).search(/\n\s*done\s*\n/);
    if (loopAt >= 0 && (doneAt < 0 || !text.slice(loopAt + doneAt).includes("is_error")))
      problems.push(`${join(dir, f)}: nothing after the loop tells "both accounts refused" from a real failure`);
  }
}

if (problems.length) {
  console.error(`${problems.length} problem(s) in ${steps} Claude step(s):\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log(`OK — ${steps} Claude step(s), each survives a usage limit on one account`);

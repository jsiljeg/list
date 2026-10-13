#!/usr/bin/env node
/* Since when each wine has been on the list, from git history (owner,
 * 2026-10-14: "the wine list changed, so be reasonable about it").
 *
 * /admin's "Vinska karta i blagajna" calls a wine unsold only when it has been
 * on the list for the whole period it looks at; a wine added since is shown as
 * new, with what it has sold so far. The date is the start of its current,
 * unbroken stay: a ref that left the list and came back starts again. History
 * starts with lists/theatrium.json (2026-07-31); a wine already there then
 * carries that date, meaning "at least since".
 *
 *   node scripts/list-since.mjs > _site/data/list-since.json
 *
 * Needs the full history (the deploy checks out with fetch-depth: 0). On a
 * shallow clone it still writes valid JSON, just with later dates. */
import { execFileSync } from "node:child_process";

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 << 20 });
const commits = git("log", "--reverse", "--format=%H %cI", "--", "lists/theatrium.json").trim().split("\n").filter(Boolean)
  .map((l) => { const [h, d] = l.split(" "); return { h, d: d.slice(0, 10) }; });

const refsOf = (text) => {
  const out = new Set();
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    if (typeof o.ref === "string") out.add(o.ref);
    Object.values(o).forEach(walk);
  })(JSON.parse(text));
  return out;
};

const since = {};
for (const { h, d } of commits) {
  let refs;
  try { refs = refsOf(git("show", `${h}:lists/theatrium.json`)); } catch { continue; }
  for (const r of Object.keys(since)) if (!refs.has(r)) delete since[r];
  for (const r of refs) if (!since[r]) since[r] = d;
}
process.stdout.write(JSON.stringify({ from: commits.length ? commits[0].d : null, since }) + "\n");

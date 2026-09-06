/* Which critic a guest should read first — the one table, shared.

   scripts/rank-ratings.py writes the order into library/wines.json and
   scripts/validate.mjs checks it here, both from scripts/lib/critics.json, so
   there is exactly one place the ranking lives. The reasoning behind each rank
   is in that file's "why" block; the short version is that the order comes
   from five checkable properties of the publication — who pays for it, whether
   one named palate is accountable for the score, how wide it reaches, how long
   it has been comparable, and whether it moves the price — and never from
   whether we happen to like the number. */
import fs from "node:fs";

export const CRITICS = JSON.parse(
  fs.readFileSync(new URL("./critics.json", import.meta.url), "utf8")
);

/* A specialist is promoted in their own region: ahead of every generalist,
   behind the three global references, and still in rank order among
   themselves. Matched on the wine's country code or any rung of its region. */
export function criticRank(critic, wine) {
  const base = CRITICS.rank[critic];
  if (base === undefined) return null;
  const where = CRITICS.specialists[critic];
  if (where) {
    const ins = wine.insight || {};
    const rungs = String(ins.region || "").split(",").map((s) => s.trim());
    rungs.push(ins.country || "");
    if (where.some((w) => rungs.includes(w))) return CRITICS.specialistRank + base / 100;
  }
  return base;
}

/* The order the ratings should be stored in, as a list of critic names. */
export function rankRatings(ratings, wine) {
  return [...ratings].sort(
    (a, b) => criticRank(a.critic, wine) - criticRank(b.critic, wine)
  );
}

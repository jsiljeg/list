import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const PRIDE_MIN = 500;
const BUDGET = { b1: [0, 60], b2: [60, 120], b3: [120, Infinity], any: [PRIDE_MIN, Infinity] };
const bottles = [];
for (const s of list.sections) { if (!s.id.startsWith("bottle-")) continue;
  for (const c of s.categories) for (const g of c.groups) for (const i of g.items) if (i && i.insight) bottles.push(i); }
const score = (d, w) => {
  let s = (w.insight.pairings || []).filter((p) => (d.pairings || []).includes(p)).length * 3;
  if ((d.styles || []).includes(w.insight.style)) s += 3;
  if (w.recommended) s += 1;
  return s;
};
const key = (w) => `${w.producer} — ${w.name}`;

let tiedTotal = 0, combos = 0, distinctTotal = 0;
const tight = [];
for (const d of menu.dishes) for (const bk of Object.keys(BUDGET)) {
  const [lo, hi] = BUDGET[bk];
  const pool = bottles.filter((w) => w.price != null && w.price >= lo && w.price <= hi)
                      .map((w) => ({ w, s: score(d, w) })).filter((r) => r.s > 0);
  if (!pool.length) continue;
  combos++;
  const top = Math.max(...pool.map((r) => r.s));
  const tied = pool.filter((r) => r.s === top).length;
  tiedTotal += tied;
  /* 200 independent sessions: how many *different* wines can a table see? */
  const seen = new Set();
  for (let i = 0; i < 200; i++)
    pool.map((r) => ({ ...r, j: r.s + Math.random() * 0.4 })).sort((a, b) => b.j - a.j)
        .slice(0, 3).forEach((r) => seen.add(key(r.w)));
  distinctTotal += seen.size;
  if (seen.size <= 3) tight.push(`${d.name.en} @ ${bk}: only ${seen.size} (pool ${pool.length}, top score ${top} shared by ${tied})`);
}
console.log(`${combos} dish x budget combinations`);
console.log(`wines tied at the top score, on average: ${(tiedTotal / combos).toFixed(1)}`);
console.log(`different wines a table can see across 200 sessions, on average: ${(distinctTotal / combos).toFixed(1)}`);
console.log(`\ncombinations where the answer is ALWAYS the same 3 wines: ${tight.length}`);
for (const t of tight) console.log("   " + t);

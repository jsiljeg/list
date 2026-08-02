import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const PRIDE_MIN = 500;
const BUDGET = { b1: [0, 60], b2: [60, 120], b3: [120, Infinity], any: [PRIDE_MIN, Infinity] };

const bottles = [], glassPours = [];
for (const sec of list.sections) {
  const g = sec.id === "glass";
  if (!g && !sec.id.startsWith("bottle-")) continue;
  for (const cat of sec.categories) for (const grp of cat.groups) for (const it of grp.items)
    if (it && it.insight) (g ? glassPours : bottles).push(it);
}
const key = (w) => `${w.producer} — ${w.name}`;
const score = (d, w) => {
  let s = (w.insight.pairings || []).filter((p) => (d.pairings || []).includes(p)).length * 3;
  if ((d.styles || []).includes(w.insight.style)) s += 3;
  if (w.recommended) s += 1;
  return s;
};
function suggest(dish, bk) {
  const [lo, hi] = BUDGET[bk];
  const pick = (pool, filter) => pool.map((w) => ({ w, s: score(dish, w) }))
    .filter((r) => r.s > 0 && (!filter || (r.w.price != null && r.w.price >= lo && r.w.price <= hi)))
    .map((r) => ({ ...r, s: r.s + Math.random() * 0.4 }))
    .sort((a, b) => b.s - a.s);
  const gl = pick(glassPours, false).slice(0, 2);
  const on = new Set(gl.map((r) => key(r.w)));
  const bo = pick(bottles, true).filter((r) => !on.has(key(r.w))).slice(0, 3);
  return gl.concat(bo).map((r) => r.w);
}

const RUNS = 400, hits = new Map();
let empty = 0;
for (let r = 0; r < RUNS; r++)
  for (const d of menu.dishes) for (const bk of Object.keys(BUDGET)) {
    const t = suggest(d, bk);
    if (!t.length) empty++;
    for (const w of t) hits.set(key(w), (hits.get(key(w)) || 0) + 1);
  }
const combos = menu.dishes.length * 4;
const pool = bottles.concat(glassPours);
const never = pool.filter((w) => !hits.has(key(w)));
console.log(`pool: ${bottles.length} bottles + ${glassPours.length} by the glass`);
console.log(`empty combinations: ${(empty / RUNS).toFixed(1)} of ${combos}`);
console.log(`never proposed: ${never.length} of ${pool.length} (${(never.length / pool.length * 100).toFixed(0)}%)`);
const ranked = [...hits].map(([k, n]) => ({ k, per: n / RUNS })).sort((a, b) => b.per - a.per);
console.log(`\ntop 12 (appearances per full pass over ${combos} combinations):`);
for (const r of ranked.slice(0, 12)) console.log(`  ${r.per.toFixed(1).padStart(5)}  ${r.k}`);
console.log(`\nthe 10 busiest take ${(ranked.slice(0, 10).reduce((a, b) => a + b.per, 0) / (combos * 5) * 100).toFixed(0)}% of all ${combos * 5} slots`);
const recs = pool.filter((w) => w.recommended).length;
console.log(`\nFilho's picks in the pool: ${recs}`);
console.log(`picks among the never-proposed: ${never.filter((w) => w.recommended).length}`);

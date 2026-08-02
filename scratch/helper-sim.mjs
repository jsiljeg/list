import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const PRIDE_MIN = 500;
const BUDGET = { b1: [0, 60], b2: [60, 120], b3: [120, Infinity], any: [PRIDE_MIN, Infinity] };

const bottles = [];
for (const sec of list.sections) {
  if (!sec.id.startsWith("bottle-")) continue;
  for (const cat of sec.categories) for (const g of cat.groups) for (const it of g.items)
    if (it && it.insight) bottles.push(it);
}
const key = (w) => `${w.producer} — ${w.name}`;

function top3(dish, bk) {
  const [lo, hi] = BUDGET[bk];
  const scored = [];
  for (const w of bottles) {
    if (w.price == null || w.price < lo || w.price > hi) continue;
    let s = (w.insight.pairings || []).filter((p) => (dish.pairings || []).includes(p)).length * 3;
    if ((dish.styles || []).includes(w.insight.style)) s += 3;
    if (w.recommended) s += 1;
    if (s <= 0) continue;
    scored.push({ s: s + Math.random() * 0.4, w });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, 3).map((r) => r.w);
}

const RUNS = 400;
const hits = new Map();
let empty = 0, slots = 0;
const emptyCombos = new Map();
for (let r = 0; r < RUNS; r++)
  for (const d of menu.dishes)
    for (const bk of Object.keys(BUDGET)) {
      const t = top3(d, bk);
      slots++;
      if (!t.length) { empty++; emptyCombos.set(`${d.name.en} @ ${bk}`, (emptyCombos.get(`${d.name.en} @ ${bk}`)||0)+1); }
      for (const w of t) hits.set(key(w), (hits.get(key(w)) || 0) + 1);
    }

const combos = menu.dishes.length * 4;
console.log(`${bottles.length} bottles, ${menu.dishes.length} dishes x 4 budgets = ${combos} combinations, ${RUNS} runs`);
console.log(`combinations that return NOTHING: ${(empty / RUNS).toFixed(1)} of ${combos}`);
for (const [c, n] of [...emptyCombos].sort((a,b)=>b[1]-a[1])) console.log(`   empty: ${c}  (${(n/RUNS*100).toFixed(0)}% of runs)`);

const never = bottles.filter((w) => !hits.has(key(w)));
console.log(`\nbottles NEVER proposed by the helper: ${never.length} of ${bottles.length} (${(never.length/bottles.length*100).toFixed(0)}%)`);

const ranked = [...hits].map(([k, n]) => ({ k, per: n / RUNS })).sort((a, b) => b.per - a.per);
console.log(`\ntop 20 most-proposed (average appearances per full pass over ${combos} combinations):`);
for (const r of ranked.slice(0, 20)) console.log(`  ${r.per.toFixed(1).padStart(5)}  ${r.k}`);
console.log(`\nbottles proposed in fewer than 1 combination on average: ${ranked.filter(r=>r.per<1).length}`);
console.log(`the 10 busiest bottles take ${(ranked.slice(0,10).reduce((a,b)=>a+b.per,0) / (combos*3) * 100).toFixed(0)}% of all ${combos*3} recommendation slots`);

fs.writeFileSync("scratch/never.txt", never.map(key).sort().join("\n"), "utf8");

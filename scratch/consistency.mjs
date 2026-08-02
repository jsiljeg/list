import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const BUDGET = { b1: [0, 60], b2: [60, 120], b3: [120, Infinity], any: [500, Infinity] };
const bottles = [], glasses = [];
for (const s of list.sections) {
  const g = s.id === "glass";
  if (!g && !s.id.startsWith("bottle-")) continue;
  for (const c of s.categories) for (const gr of c.groups) for (const i of gr.items)
    if (i && i.insight) (g ? glasses : bottles).push(i);
}
const shared = (d, w) => (w.insight.pairings || []).filter((p) => (d.pairings || []).includes(p));
const score = (d, w) => {
  let s = shared(d, w).length * 3;
  if ((d.styles || []).includes(w.insight.style)) s += 3;
  if (w.recommended) s += 1;
  return s;
};
const key = (w) => `${w.producer} — ${w.name}`;

// 1. How often does a *proposed* wine share no food at all with the dish?
let slots = 0, mismatched = 0;
const RUNS = 200;
const worst = new Map();
for (let r = 0; r < RUNS; r++)
  for (const d of menu.dishes) for (const bk of Object.keys(BUDGET)) {
    const [lo, hi] = BUDGET[bk];
    const pool = bottles.filter((w) => w.price != null && w.price >= lo && w.price <= hi)
      .map((w) => ({ w, s: score(d, w) })).filter((x) => x.s > 0);
    const top = pool.map((x) => ({ ...x, j: x.s + Math.random() * 3 }))
      .sort((a, b) => b.j - a.j).slice(0, 3);
    for (const x of top) {
      slots++;
      if (!shared(d, x.w).length) {
        mismatched++;
        const k = `${d.name.en} @ ${bk}`;
        worst.set(k, (worst.get(k) || 0) + 1);
      }
    }
  }
console.log(`suggestion slots: ${slots}`);
console.log(`proposed on style alone, no shared food: ${mismatched} (${(mismatched / slots * 100).toFixed(1)}%)`);
console.log("\nworst offenders (share of that combination's slots):");
for (const [k, n] of [...worst].sort((a, b) => b[1] - a[1]).slice(0, 12))
  console.log(`   ${(n / (RUNS * 3) * 100).toFixed(0).padStart(3)}%  ${k}`);

// 2. If we required at least one shared food, would every combination still answer?
console.log("\n--- if a shared food were required ---");
const thin = [];
for (const d of menu.dishes) for (const bk of Object.keys(BUDGET)) {
  const [lo, hi] = BUDGET[bk];
  const ok = bottles.filter((w) => w.price != null && w.price >= lo && w.price <= hi)
                    .filter((w) => shared(d, w).length).length;
  if (ok < 3) thin.push(`${d.name.en} @ ${bk}: ${ok}`);
}
console.log(`combinations that could not fill three bottles: ${thin.length} of 120`);
for (const t of thin) console.log("   " + t);
const gthin = [];
for (const d of menu.dishes) {
  const ok = glasses.filter((w) => shared(d, w).length).length;
  if (ok < 3) gthin.push(`${d.name.en}: ${ok}`);
}
console.log(`\ndishes that could not fill three glasses: ${gthin.length} of ${menu.dishes.length}`);
for (const t of gthin) console.log("   " + t);

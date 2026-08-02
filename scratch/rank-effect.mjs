import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const BUDGET = { b1: [0, 60], b2: [60, 120], b3: [120, Infinity], any: [500, Infinity] };
const bottles = [];
for (const s of list.sections) { if (!s.id.startsWith("bottle-")) continue;
  for (const c of s.categories) for (const g of c.groups) for (const i of g.items) if (i && i.insight) bottles.push(i); }
const score = (d, w) => {
  let s = 0;
  (w.insight.pairings || []).forEach((p, i) => { if ((d.pairings || []).includes(p)) s += Math.max(1, 4 - i); });
  if ((d.styles || []).includes(w.insight.style)) s += 3;
  if (w.recommended) s += 1;
  return s;
};
const bestIdx = (d, w) => {
  let best = 99;
  (w.insight.pairings || []).forEach((p, i) => { if ((d.pairings || []).includes(p)) best = Math.min(best, i); });
  return best;
};
const shares = (d, w) => bestIdx(d, w) < 99;
const key = (w) => `${w.producer} — ${w.name}`;
for (const jitter of [2, 3, 4, 5, 6]) {
  let pos = 0, n = 0, distinct = 0, combos = 0, locked = 0;
  const ever = new Set();
  for (const d of menu.dishes) for (const bk of Object.keys(BUDGET)) {
    const [lo, hi] = BUDGET[bk];
    const pool = bottles.filter((w) => w.price != null && w.price >= lo && w.price <= hi)
      .map((w) => ({ w, s: score(d, w) })).filter((x) => x.s > 0);
    if (!pool.length) continue;
    combos++;
    const seen = new Set();
    for (let r = 0; r < 200; r++) {
      const yes = pool.filter((x) => shares(d, x.w));
      const use = yes.length ? yes : pool;
      const three = use.map((x) => ({ ...x, j: x.s + Math.random() * jitter })).sort((a, b) => b.j - a.j).slice(0, 3);
      for (const x of three) { seen.add(key(x.w)); ever.add(key(x.w)); const b = bestIdx(d, x.w); if (b < 99) { pos += b; n++; } }
    }
    distinct += seen.size; if (seen.size <= 3) locked++;
  }
  console.log(`jitter ${jitter}: suggested wines list the dish's food at position ${(pos / n).toFixed(2)} on average (0 = the wine's best food) · distinct/combo ${(distinct / combos).toFixed(1)} · locked ${locked}/${combos} · reachable ${ever.size}/${bottles.length}`);
}

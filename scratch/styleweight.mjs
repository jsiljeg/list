import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const BUDGET = { b1: [0, 60], b2: [60, 120], b3: [120, Infinity], any: [500, Infinity] };
const bottles = [];
for (const s of list.sections) { if (!s.id.startsWith("bottle-")) continue;
  for (const c of s.categories) for (const g of c.groups) for (const i of g.items) if (i && i.insight) bottles.push(i); }
const shares = (d, w) => (w.insight.pairings || []).some((p) => (d.pairings || []).includes(p));
for (const SW of [3, 4, 5]) {
  const score = (d, w) => {
    let s = 0;
    (w.insight.pairings || []).forEach((p, i) => { if ((d.pairings || []).includes(p)) s += Math.max(1, 4 - i); });
    if ((d.styles || []).includes(w.insight.style)) s += SW;
    if (w.recommended) s += 1;
    return s;
  };
  let slots = 0, onStyle = 0, pos = 0, n = 0; const ever = new Set();
  for (const d of menu.dishes) for (const bk of Object.keys(BUDGET)) {
    const [lo, hi] = BUDGET[bk];
    const pool = bottles.filter((w) => w.price != null && w.price >= lo && w.price <= hi)
      .map((w) => ({ w, s: score(d, w) })).filter((x) => x.s > 0);
    if (!pool.length) continue;
    for (let r = 0; r < 200; r++) {
      const yes = pool.filter((x) => shares(d, x.w));
      const use = yes.length ? yes : pool;
      for (const x of use.map((y) => ({ ...y, j: y.s + Math.random() * 4 })).sort((a, b) => b.j - a.j).slice(0, 3)) {
        slots++; ever.add(`${x.w.producer}|${x.w.name}`);
        if ((d.styles || []).includes(x.w.insight.style)) onStyle++;
        const i = (x.w.insight.pairings || []).findIndex((p) => (d.pairings || []).includes(p));
        if (i >= 0) { pos += i; n++; }
      }
    }
  }
  console.log(`style weight ${SW}: suggestions in one of the dish's own styles ${(onStyle / slots * 100).toFixed(1)}%  ·  dish's food at position ${(pos / n).toFixed(2)}  ·  reachable ${ever.size}/${bottles.length}`);
}

import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const BUDGET = { b1: [0, 60], b2: [60, 120], b3: [120, Infinity], any: [500, Infinity] };
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

function run(jitter, label) {
  let distinct = 0, locked = 0, combos = 0, quality = 0, worst = 0;
  const everSeen = new Set();
  for (const d of menu.dishes) for (const bk of Object.keys(BUDGET)) {
    const [lo, hi] = BUDGET[bk];
    const pool = bottles.filter((w) => w.price != null && w.price >= lo && w.price <= hi)
                        .map((w) => ({ w, s: score(d, w) })).filter((r) => r.s > 0);
    if (!pool.length) continue;
    combos++;
    const top = Math.max(...pool.map((r) => r.s));
    const seen = new Set();
    let qsum = 0, n = 0;
    for (let i = 0; i < 200; i++) {
      const three = pool.map((r) => ({ ...r, j: r.s + Math.random() * jitter }))
                        .sort((a, b) => b.j - a.j).slice(0, 3);
      for (const r of three) { seen.add(key(r.w)); everSeen.add(key(r.w)); qsum += top - r.s; n++; worst = Math.max(worst, top - r.s); }
    }
    distinct += seen.size;
    if (seen.size <= 3) locked++;
    quality += qsum / n;
  }
  console.log(`${label.padEnd(22)} distinct/combo ${(distinct/combos).toFixed(1).padStart(5)}   locked ${String(locked).padStart(3)}/${combos}   avg points below best ${(quality/combos).toFixed(2)}   worst ${worst}   bottles ever proposed ${everSeen.size}/${bottles.length}`);
}
run(0.4, "jitter 0.4 (today)");
run(1.5, "jitter 1.5");
run(3.0, "jitter 3.0");
run(4.0, "jitter 4.0");

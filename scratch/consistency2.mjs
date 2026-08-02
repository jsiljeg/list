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
const shares = (d, w) => (w.insight.pairings || []).some((p) => (d.pairings || []).includes(p));
const score = (d, w) => {
  let s = (w.insight.pairings || []).filter((p) => (d.pairings || []).includes(p)).length * 3;
  if ((d.styles || []).includes(w.insight.style)) s += 3;
  if (w.recommended) s += 1;
  return s;
};
const foodFirst = (d, rows) => { const y = rows.filter((r) => shares(d, r.w)); return y.length ? y : rows; };
let slots = 0, bad = 0; const counts = {1:0,2:0,3:0,0:0}; const fell = new Set();
for (let r = 0; r < 200; r++)
  for (const d of menu.dishes) for (const bk of Object.keys(BUDGET)) {
    const [lo, hi] = BUDGET[bk];
    const pool = bottles.filter((w) => w.price != null && w.price >= lo && w.price <= hi)
      .map((w) => ({ w, s: score(d, w) })).filter((x) => x.s > 0)
      .map((x) => ({ ...x, j: x.s + Math.random() * 3 })).sort((a, b) => b.j - a.j);
    const picked = foodFirst(d, pool).slice(0, 3);
    counts[picked.length]++;
    for (const x of picked) { slots++; if (!shares(d, x.w)) { bad++; fell.add(`${d.name.en} @ ${bk}`); } }
  }
console.log(`suggestion slots: ${slots}`);
console.log(`proposed with no shared food: ${bad} (${(bad / slots * 100).toFixed(1)}%)`);
console.log(`rows shown per answer:`, Object.entries(counts).map(([k,v])=>`${k}→${(v/200).toFixed(0)}`).join("  "), "(of 120 combinations)");
console.log(`combinations still falling back to style-only: ${fell.size}`);
for (const f of fell) console.log("   " + f);

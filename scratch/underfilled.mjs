import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const BUDGET = { b1: ["do 60 €", 0, 60], b2: ["60–120 €", 60, 120], b3: ["iznad 120 €", 120, Infinity], any: ["Bez ograničenja", 500, Infinity] };
const bottles = [];
for (const s of list.sections) { if (!s.id.startsWith("bottle-")) continue;
  for (const c of s.categories) for (const g of c.groups) for (const i of g.items) if (i && i.insight) bottles.push(i); }
const shares = (d, w) => (w.insight.pairings || []).some((p) => (d.pairings || []).includes(p));
const rows = [];
for (const d of menu.dishes) for (const [bk, [label, lo, hi]] of Object.entries(BUDGET)) {
  const band = bottles.filter((w) => w.price != null && w.price >= lo && w.price <= hi);
  const matching = band.filter((w) => shares(d, w));
  const n = matching.length ? Math.min(3, matching.length) : Math.min(3, band.filter((w) => (d.styles || []).includes(w.insight.style)).length);
  if (n < 3) rows.push({ dish: d.name.hr, label, band: band.length, matching: matching.length, n,
                         who: matching.map((w) => `${w.producer} ${w.name} (${w.price}€)`).join(" · "),
                         asks: (d.pairings || []).join(",") });
}
console.log(`${rows.length} of 120 combinations cannot fill three\n`);
for (const r of rows.sort((a, b) => a.n - b.n))
  console.log(`${String(r.n)} of 3 — ${r.dish} @ ${r.label}\n     dish asks: ${r.asks}   ·   ${r.band} bottles in the band, ${r.matching} share a food\n     ${r.who || "(none — falls back to style)"}\n`);

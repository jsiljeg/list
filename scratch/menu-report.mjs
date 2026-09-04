/* What the sommelier will actually answer, dish by dish and band by band.
   Replicates dishScore() and the food-first filter exactly, minus the random
   tie-break: the app rotates among wines within 3 points of the leader, so this
   prints every wine that can be offered, best first, with its score. */
import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const BANDS = [["do 60 EUR", 0, 60], ["60-120 EUR", 60, 120], ["iznad 120 EUR", 120, Infinity], ["Bez ogranicenja (Ikone)", 500, Infinity]];

const bottles = [], glasses = [];
for (const s of list.sections) {
  const g = s.id === "glass";
  if (!g && !s.id.startsWith("bottle-")) continue;
  for (const c of s.categories) for (const gr of c.groups) for (const i of gr.items)
    if (i && i.insight && !i.insight.kind) (g ? glasses : bottles).push(i);
}
const score = (d, i) => {
  let sc = 0;
  (i.insight.pairings || []).forEach((p, n) => { if ((d.pairings || []).includes(p)) sc += Math.max(1, 4 - n); });
  if ((d.styles || []).includes(i.insight.style)) sc += 3;
  if (i.recommended) sc += 1;
  return sc;
};
const shares = (d, i) => (i.insight.pairings || []).some((p) => (d.pairings || []).includes(p));
const pick = (d, pool) => {
  const s = pool.map((i) => ({ i, sc: score(d, i) })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
  const yes = s.filter((x) => shares(d, x.i));
  return (yes.length ? yes : s);
};
const only = process.argv[2] === "new";
const NEWONLY = process.argv[2] === "new";
const NEW = new Set(["Jakobove kapice","Burrata i rajčice","Kozice u panko mrvicama","Carpaccio od bifteka",
  "Juha od kukuruza","Juha od rajčice","Rižoto s morskim plodovima","Cacio e pepe",
  "Kotlet od crne slavonske svinje","Čoko kugla","Šljiva","File svježe jadranske ribe na buzaru"]);
for (const d of menu.dishes.filter((x) => !x.off)) {
  if (only && !NEW.has(d.name.hr)) continue;
  console.log(`\n${"=".repeat(78)}\n${d.name.hr}   [${d.course}]`);
  console.log(`   uz jela: ${(d.pairings || []).join(", ")}`);
  console.log(`   stilovi: ${(d.styles || []).join(", ")}`);
  const gl = pick(d, glasses).slice(0, 3);
  console.log(`   NA CASU (${gl.length ? "" : "NISTA"})`);
  for (const x of gl) console.log(`      ${String(x.sc).padStart(2)}  ${x.i.price} EUR  ${x.i.producer} — ${x.i.name}${shares(d, x.i) ? "" : "   [samo stil]"}`);
  for (const [label, lo, hi] of BANDS) {
    const band = bottles.filter((b) => b.price != null && b.price >= lo && b.price <= hi);
    const p = pick(d, band).slice(0, 3);
    const flag = p.length < 3 ? `   <<< SAMO ${p.length}` : "";
    console.log(`   ${label}${flag}`);
    if (!p.length) { console.log("      —"); continue; }
    for (const x of p) console.log(`      ${String(x.sc).padStart(2)}  ${x.i.price} EUR  ${x.i.producer} — ${x.i.name}${shares(d, x.i) ? "" : "   [samo stil]"}`);
  }
}

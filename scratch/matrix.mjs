import { joinList } from "../scripts/lib/list.mjs";
const { list } = joinList();
const wines = [];
for (const s of list.sections) for (const c of s.categories) for (const g of c.groups) for (const i of g.items)
  if (i && i.insight && !i.insight.kind) wines.push(i);
const seen = new Map();          // style -> pairing -> [wines]
for (const w of wines) {
  const st = w.insight.style;
  if (!seen.has(st)) seen.set(st, new Map());
  for (const p of w.insight.pairings || []) {
    if (!seen.get(st).has(p)) seen.get(st).set(p, []);
    seen.get(st).get(p).push(`${w.producer} ${w.name}`);
  }
}
const order = ["sparkling","sparkling_rose","champagne","champagne_bdb","champagne_bdn","champagne_rose",
  "champagne_prestige","white_fresh","white_aromatic","white_mineral","white_rich","orange","rose",
  "red_light","red_medium","red_full","red_mature","sweet"];
for (const st of order) {
  const m = seen.get(st);
  if (!m) continue;
  const n = wines.filter((w) => w.insight.style === st).length;
  console.log(`\n=== ${st}  (${n} wines)`);
  for (const [p, ws] of [...m].sort((a, b) => b[1].length - a[1].length))
    console.log(`   ${String(ws.length).padStart(3)}  ${p.padEnd(18)} ${ws.length <= 2 ? ws.join(" / ") : ""}`);
}

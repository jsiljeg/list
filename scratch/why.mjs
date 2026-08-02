import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const bottles = [];
for (const sec of list.sections) {
  if (!sec.id.startsWith("bottle-")) continue;
  for (const cat of sec.categories) for (const g of cat.groups) for (const it of g.items)
    if (it && it.insight) bottles.push(it);
}
const never = new Set(fs.readFileSync("scratch/never.txt", "utf8").split("\n"));
const key = (w) => `${w.producer} — ${w.name}`;

// what a dish can ask for
const dishPair = new Map();
for (const d of menu.dishes) for (const p of d.pairings || []) dishPair.set(p, (dishPair.get(p)||0)+1);
const dishStyle = new Map();
for (const d of menu.dishes) for (const s of d.styles || []) dishStyle.set(s, (dishStyle.get(s)||0)+1);

console.log("--- pairing keys the MENU asks for, and how many bottles carry each ---");
for (const [p, dn] of [...dishPair].sort((a,b)=>b[1]-a[1])) {
  const n = bottles.filter((w) => (w.insight.pairings||[]).includes(p)).length;
  console.log(`  ${p.padEnd(18)} asked by ${String(dn).padStart(2)} dishes, carried by ${String(n).padStart(3)} bottles`);
}
console.log("\n--- pairing keys on WINES that no dish ever asks for (dead weight in the helper) ---");
const winePair = new Map();
for (const w of bottles) for (const p of w.insight.pairings || []) winePair.set(p, (winePair.get(p)||0)+1);
for (const [p, n] of [...winePair].sort((a,b)=>b[1]-a[1])) if (!dishPair.has(p)) console.log(`  ${p.padEnd(22)} on ${String(n).padStart(3)} bottles`);

console.log("\n--- styles the MENU asks for vs bottles carrying them ---");
const allStyles = new Set(bottles.map((w) => w.insight.style));
for (const s of [...allStyles].sort()) {
  const n = bottles.filter((w) => w.insight.style === s).length;
  console.log(`  ${s.padEnd(22)} asked by ${String(dishStyle.get(s)||0).padStart(2)} dishes, ${String(n).padStart(3)} bottles`);
}

console.log("\n--- how many menu-relevant pairing tags each bottle has ---");
const menuKeys = new Set(dishPair.keys());
const buckets = new Map();
for (const w of bottles) {
  const n = (w.insight.pairings||[]).filter((p) => menuKeys.has(p)).length;
  buckets.set(n, (buckets.get(n)||0)+1);
}
for (const [n, c] of [...buckets].sort((a,b)=>a[0]-b[0])) console.log(`  ${n} menu-relevant tag(s): ${c} bottles`);

console.log("\n--- the never-proposed 73: why? ---");
const nev = bottles.filter((w) => never.has(key(w)));
const byStyle = new Map(), byTagCount = new Map(), byPrice = new Map();
for (const w of nev) {
  byStyle.set(w.insight.style, (byStyle.get(w.insight.style)||0)+1);
  const n = (w.insight.pairings||[]).filter((p) => menuKeys.has(p)).length;
  byTagCount.set(n, (byTagCount.get(n)||0)+1);
  const b = w.price < 60 ? "<60" : w.price < 120 ? "60-120" : w.price < 500 ? "120-500" : "500+";
  byPrice.set(b, (byPrice.get(b)||0)+1);
}
console.log("  by style:", [...byStyle].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join("  "));
console.log("  by menu-relevant tag count:", [...byTagCount].sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}tags:${v}`).join("  "));
console.log("  by price band:", [...byPrice].map(([k,v])=>`${k}:${v}`).join("  "));
console.log("\n  a sample:");
for (const w of nev.slice(0, 12))
  console.log(`    ${String(w.price).padStart(4)}€  ${w.insight.style.padEnd(16)} [${(w.insight.pairings||[]).join(",")}]  ${key(w)}`);

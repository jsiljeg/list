import { joinList } from "../scripts/lib/list.mjs";
const wines = joinList().list;
const bottles = [];
for (const s of wines.sections) {
  if (!s.id.startsWith("bottle-")) continue;
  for (const c of s.categories) for (const g of c.groups) for (const it of g.items)
    if (it.insight) bottles.push(it);
}
console.log("sweet / champagne under 60 € (foie gras candidates):");
for (const w of bottles.filter((w) => w.price < 60 && ["sweet", "champagne", "champagne_bdb", "white_aromatic"].includes(w.insight.style)))
  console.log(`  ${String(w.price).padStart(3)} €  ${w.insight.style.padEnd(15)} ${(w.producer + " — " + w.name).slice(0, 44).padEnd(46)} ${(w.insight.pairings || []).join(", ")}`);

console.log("\nreds under 60 € that could take beef/stews/pasticada:");
for (const w of bottles.filter((w) => w.price < 60 && (w.insight.style || "").startsWith("red")))
  console.log(`  ${String(w.price).padStart(3)} €  ${(w.insight.grape || "").slice(0, 22).padEnd(24)} ${(w.producer + " — " + w.name).slice(0, 40).padEnd(42)} ${(w.insight.pairings || []).join(", ")}`);

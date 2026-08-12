/* Which dishes cannot fill three by-the-glass suggestions, and what is on that
   shelf that might legitimately take the missing food. */
import { joinList } from "../scripts/lib/list.mjs";
import { readFileSync } from "node:fs";
const wines = joinList().list;
const menu = JSON.parse(readFileSync("data/menu.json", "utf8"));

const glass = [];
for (const s of wines.sections) {
  if (s.id !== "glass") continue;
  for (const c of s.categories) for (const g of c.groups) for (const it of g.items)
    if (it.insight) glass.push(it);
}
console.log(`by the glass: ${glass.length} wines\n`);
for (const w of glass)
  console.log(`  ${String(w.price).padStart(3)} €  ${(w.insight.style || "").padEnd(15)} ${(w.producer + " — " + w.name).slice(0, 52).padEnd(54)} ${(w.insight.pairings || []).join(", ")}`);

console.log("\ndishes with fewer than three by-the-glass matches:");
for (const d of menu.dishes) {
  const hits = glass.filter((w) => (w.insight.pairings || []).some((p) => (d.pairings || []).includes(p)));
  if (hits.length >= 3) continue;
  const styleOnly = glass.filter((w) => (d.styles || []).includes(w.insight.style) && !hits.includes(w));
  console.log(`\n  ${d.name.hr}  [${(d.pairings || []).join(", ")}]  styles: ${(d.styles || []).join(", ")}`);
  console.log(`     matches (${hits.length}): ${hits.map((w) => w.producer + " " + w.name).join(" | ") || "—"}`);
  console.log(`     right style, no shared food (${styleOnly.length}): ${styleOnly.map((w) => `${w.producer} ${w.name} [${(w.insight.pairings||[]).join(",")}]`).join(" | ") || "—"}`);
}

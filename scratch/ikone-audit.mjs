import { joinList } from "../scripts/lib/list.mjs";
const wines = joinList().list;
const PRIDE = 500;
const rows = [];
for (const s of wines.sections) {
  if (!s.id.startsWith("bottle-")) continue;
  for (const c of s.categories) for (const g of c.groups) for (const it of g.items)
    if (it.insight && it.price >= PRIDE) rows.push(it);
}
rows.sort((a, b) => a.price - b.price);
console.log(`Ikone shelf (${PRIDE} €+): ${rows.length} bottles\n`);
for (const w of rows)
  console.log(`  ${String(w.price).padStart(4)} €  ${(w.insight.style || "").padEnd(17)} ${(w.producer + " — " + w.name).slice(0, 46).padEnd(48)} ${(w.insight.pairings || []).join(", ")}`);

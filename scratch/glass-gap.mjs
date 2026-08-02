import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const glasses = [];
for (const s of list.sections) { if (s.id !== "glass") continue;
  for (const c of s.categories) for (const g of c.groups) for (const i of g.items) if (i && i.insight) glasses.push(i); }
console.log(`${glasses.length} wines by the glass\n`);
const thin = [];
for (const d of menu.dishes) {
  const ok = glasses.filter((w) => (w.insight.pairings || []).some((p) => (d.pairings || []).includes(p)));
  if (ok.length < 3) thin.push([d.name.hr, ok.length, ok.map((w) => `${w.producer} ${w.name}`).join(" · ")]);
}
console.log(`dishes with fewer than three by-the-glass food matches: ${thin.length} of ${menu.dishes.length}`);
for (const [n, c, who] of thin) console.log(`   ${String(c)}  ${n.padEnd(38)} ${who}`);
const use = new Map();
for (const w of glasses) for (const p of w.insight.pairings || []) use.set(p, (use.get(p) || 0) + 1);
const asked = new Set(menu.dishes.flatMap((d) => d.pairings || []));
console.log(`\nfoods the menu asks for, and how many of the 32 pours carry them:`);
for (const p of [...asked].sort()) console.log(`   ${String(use.get(p) || 0).padStart(2)}  ${p}`);

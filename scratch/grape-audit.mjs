import { joinList } from "../scripts/lib/list.mjs";
import { classicFoods, missingFoods, unsupportedFoods } from "../scripts/lib/grape-foods.mjs";
const { list } = joinList();
const seen = new Set(); const wines = [];
for (const s of list.sections) for (const c of s.categories) for (const g of c.groups) for (const i of g.items) {
  if (!i || !i.insight || i.insight.kind) continue;
  const k = `${i.producer}|${i.name}`;
  if (seen.has(k)) continue; seen.add(k); wines.push(i);
}
let noRef = 0;
const missTally = new Map(), unsupTally = new Map();
for (const w of wines) {
  if (!classicFoods(w.insight).length) { noRef++; continue; }
  for (const f of missingFoods(w.insight)) missTally.set(f, (missTally.get(f) || 0) + 1);
  for (const f of unsupportedFoods(w.insight)) unsupTally.set(f, (unsupTally.get(f) || 0) + 1);
}
console.log(`${wines.length} distinct wines; ${noRef} have no grape reference yet\n`);
console.log("CLASSIC FOODS THE WINE DOES NOT CLAIM (candidates to add):");
for (const [f, n] of [...missTally].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}  ${f}`);
console.log("\nTAGS NOT CLASSIC FOR THE GRAPE (candidates to review):");
for (const [f, n] of [...unsupTally].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}  ${f}`);

import { joinList } from "../scripts/lib/list.mjs";
import { rankPairings, STYLE_ORDER } from "../scripts/lib/pairing-rank.mjs";
const { list } = joinList();
const wines = [];
for (const s of list.sections) for (const c of s.categories) for (const g of c.groups) for (const i of g.items)
  if (i && i.insight && !i.insight.kind) wines.push(i);
let moved = 0, unlisted = new Set();
const samples = [];
for (const w of wines) {
  const before = (w.insight.pairings || []).join(",");
  const after = rankPairings(w.insight).join(",");
  for (const p of w.insight.pairings || [])
    if (!(STYLE_ORDER[w.insight.style] || []).includes(p)) unlisted.add(`${w.insight.style}: ${p}`);
  if (before !== after) { moved++; if (samples.length < 22) samples.push([w, before, after]); }
}
console.log(`${wines.length} wines; ${moved} would have their pairings reordered\n`);
for (const [w, b, a] of samples)
  console.log(`${(w.producer + " " + w.name).slice(0, 42).padEnd(43)}${w.insight.style.padEnd(19)}\n    was ${b}\n    now ${a}`);
console.log(`\npairings not in their style's order table (would sort last): ${unlisted.size}`);
for (const u of [...unlisted].sort()) console.log("   " + u);

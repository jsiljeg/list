/* What would a dry Riesling by the glass actually add? Counts by-the-glass
   matches per dish now, and again with a hypothetical dry Riesling carrying
   the foods dry Riesling is classically poured for. */
import { joinList } from "../scripts/lib/list.mjs";
import { readFileSync } from "node:fs";
const wines = joinList().list;
const menu = JSON.parse(readFileSync("data/menu.json", "utf8"));
const glass = [];
for (const s of wines.sections) if (s.id === "glass")
  for (const c of s.categories) for (const g of c.groups) for (const it of g.items)
    if (it.insight) glass.push(it);

const HYPO = { insight: { style: "white_mineral",
  pairings: ["pork", "asian", "spicy", "smoked_fish", "white_meat"] } };

const count = (d, pool) => pool.filter((w) =>
  (w.insight.pairings || []).some((p) => (d.pairings || []).includes(p))).length;

console.log("dish                                  now  with a dry Riesling");
let helped = 0;
for (const d of menu.dishes) {
  const a = count(d, glass), b = count(d, [...glass, HYPO]);
  if (b > a) helped++;
  const mark = b > a ? (a < 3 ? "  <= fills a gap" : "") : "";
  if (b > a || a < 3) console.log(`  ${d.name.hr.slice(0, 34).padEnd(36)} ${String(a).padStart(2)}   ${String(b).padStart(2)}${mark}`);
}
console.log(`\na dry Riesling would add a match to ${helped} of ${menu.dishes.length} dishes`);
/* And what dry Riesling we already own, by the bottle. */
console.log("\ndry Riesling on the bottle list:");
const walk = (n) => {
  if (!n || typeof n !== "object") return;
  if (n.insight && /riesling|rizling/i.test(n.insight.grape || "") &&
      ["dry", "off_dry"].includes(n.insight.sweetness))
    console.log(`  ${String(n.price).padStart(3)} €  ${n.insight.sweetness.padEnd(7)} ${n.producer} — ${n.name}`);
  for (const v of Object.values(n)) walk(v);
};
for (const s of wines.sections) if (s.id.startsWith("bottle-")) walk(s);

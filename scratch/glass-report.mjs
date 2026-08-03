import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();
const glass = [];
for (const s of list.sections) { if (s.id !== "glass") continue;
  for (const c of s.categories) for (const g of c.groups) for (const i of g.items) if (i && i.insight) glass.push(i); }

const STYLES = ["sparkling", "sparkling_rose", "champagne", "champagne_bdb", "champagne_rose",
  "champagne_prestige", "white_fresh", "white_aromatic", "white_mineral", "white_rich", "orange",
  "rose", "red_light", "red_medium", "red_full", "red_mature", "sweet"];

for (const st of STYLES) {
  const dishes = menu.dishes.filter((d) => (d.styles || []).includes(st));
  const pours = glass.filter((w) => w.insight.style === st);
  if (!dishes.length && !pours.length) continue;
  console.log(`\n### ${st}   — ${dishes.length} dish(es) ask for it, ${pours.length} poured by the glass`);
  console.log(`    dishes: ${dishes.map((d) => d.name.hr).join(" · ") || "—"}`);
  console.log(`    pours:  ${pours.map((w) => `${w.producer} ${w.name} (${w.price}€)`).join(" · ") || "— NONE —"}`);
}

/* Bubbles are one shelf to a guest, whatever the style key says. */
const bubbly = (s) => /^(sparkling|champagne)/.test(s);
const bDishes = menu.dishes.filter((d) => (d.styles || []).some(bubbly));
const bPours = glass.filter((w) => bubbly(w.insight.style));
console.log(`\n=== ALL BUBBLES together — ${bDishes.length} dishes, ${bPours.length} pours`);
console.log(`    ${bPours.map((w) => `${w.producer} ${w.name} (${w.insight.style}, ${w.price}€)`).join("\n    ")}`);

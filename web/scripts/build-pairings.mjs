/* Dish → wine, computed at build time.

   This is the point of the new site. The list app scores wines against dishes
   in the browser, which means the answer exists only after JavaScript runs and
   is therefore invisible to a crawler — the same reason the app's own HTML has
   none of its 393 wine names in it. Running the identical scoring here emits
   real HTML instead, and "which wine goes with X" is a question guests type.

   Read-only and one-directional: this imports the wine list's own library and
   list files and never writes to them. If this build breaks, the restaurant's
   tablets do not notice.

   The scoring is a port of dishScore() in js/app.js — four points for the
   wine's best-matching food, then three, two, one, plus three for a style
   match and one for being a Filho pick. Keep the two in step; the weights were
   tuned against published sources and are documented in CLAUDE.md. */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { joinList, ROOT } from "../../scripts/lib/list.mjs";
import { FOOD } from "../src/lib/food.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "..", "src", "data", "generated");

/* Same folding as the wine list's refs: đ has no NFKD decomposition, so it
   needs the explicit map or Croatian dishes collide on slug. */
const FOLD = { đ: "d", Đ: "d", ß: "ss" };
const slug = (s) =>
  s.replace(/[đĐß]/g, (c) => FOLD[c])
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* dishScore(), ported verbatim in behaviour from js/app.js */
function dishScore(dish, item) {
  const ins = item.insight;
  if (!ins) return 0;
  let score = 0;
  (ins.pairings || []).forEach((p, i) => {
    if ((dish.pairings || []).includes(p)) score += Math.max(1, 4 - i);
  });
  if ((dish.styles || []).includes(ins.style)) score += 3;
  if (item.recommended) score += 1;
  return score;
}

const { list, missing } = joinList();
if (missing.length) {
  console.error("unresolved refs in the wine list:", missing.slice(0, 5));
  process.exit(1);
}

/* Wines only. A spirit has insight.kind === "spirit"; water and soft drinks
   have no insight at all. Same single switch the app's openDetail() reads. */
const wines = [];
for (const sec of list.sections)
  for (const cat of sec.categories)
    for (const g of cat.groups)
      for (const it of g.items)
        if (it && it.insight && !it.insight.kind)
          wines.push({ ...it, section: sec.key || sec.id || "", bySection: sec });

/* One entry per wine, cheapest listing wins — a wine poured by the glass and
   sold by the bottle is one wine listed twice, and the dish page wants the wine. */
const byRef = new Map();
for (const w of wines) {
  const key = `${w.producer}|${w.name}`;
  const prev = byRef.get(key);
  if (!prev || (w.price ?? Infinity) < (prev.price ?? Infinity)) byRef.set(key, w);
}
const unique = [...byRef.values()];

const menu = JSON.parse(readFileSync(resolve(ROOT, "data/menu.json"), "utf8"));

/* Parked dishes are seasonal and must never reach a guest — menuDishes() in
   js/app.js filters them and so must this. */
const live = menu.dishes.filter((d) => !d.off);

const out = live.map((dish) => {
  const scored = unique
    .map((w) => ({ w, score: dishScore(dish, w) }))
    .filter((x) => x.score > 0);

  /* foodFirst(): a wine that shares an actual food with the dish beats one
     matching on style alone, and we never pad the list with style-only wines
     just to reach a count. A suggestion must name the food on its own card. */
  const shares = (w) =>
    (w.insight.pairings || []).some((p) => (dish.pairings || []).includes(p));
  const strong = scored.filter((x) => shares(x.w));
  const pool = strong.length ? strong : scored;

  pool.sort((a, b) => b.score - a.score || (a.w.price ?? 0) - (b.w.price ?? 0));

  return {
    slug: slug(dish.name.hr),
    course: dish.course,
    name: dish.name,
    pairings: dish.pairings || [],
    styles: dish.styles || [],
    styleOnly: strong.length === 0,
    wines: pool.slice(0, 4).map(({ w, score }) => ({
      name: w.name,
      producer: w.producer,
      price: w.price ?? null,
      score,
      grape: w.insight.grape || "",
      region: w.insight.region || "",
      country: w.insight.country || "",
      style: w.insight.style || "",
      pairings: w.insight.pairings || [],
      shared: (w.insight.pairings || []).filter((p) => (dish.pairings || []).includes(p)),
    })),
  };
});

/* Every tag that will be printed must have a word. Without this a new pairing
   key reaches a Croatian page as its raw English tag — which is how `steak`
   got there once. Fail the build, do not print the key. */
const printed = new Set();
for (const d of out) {
  d.pairings.forEach((p) => printed.add(p));
  d.wines.forEach((w) => w.shared.forEach((p) => printed.add(p)));
}
const noWord = [...printed].filter((p) => !FOOD[p]).sort();
if (noWord.length) {
  console.error(`no word in src/lib/food.mjs for: ${noWord.join(", ")}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, "dishes.json"), JSON.stringify(out, null, 1) + "\n", "utf8");

const thin = out.filter((d) => d.wines.length < 3);
console.log(`dishes.json — ${out.length} live dishes, ${unique.length} wines considered`);
if (thin.length) {
  console.log(`  ${thin.length} dish(es) with fewer than 3 matches:`);
  for (const d of thin) console.log(`    ${d.slug} (${d.wines.length})`);
}
const styleOnly = out.filter((d) => d.styleOnly);
if (styleOnly.length) console.log(`  ${styleOnly.length} matching on style alone — thin tagging, not a code bug`);

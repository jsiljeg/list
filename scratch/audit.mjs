import { joinList } from "../scripts/lib/list.mjs";
const { list } = joinList();
const wines = [];
for (const s of list.sections) for (const c of s.categories) for (const g of c.groups) for (const i of g.items)
  if (i && i.insight && !i.insight.kind) wines.push(i);

/* Foods grouped by what they demand of a wine. */
const DESSERT   = ["desserts", "fruit_desserts", "dark_chocolate"];
const RED_MEAT  = ["beef", "steak", "lamb", "game", "bbq", "stews", "pasticada"];
const DELICATE  = ["oysters", "caviar", "sushi", "white_fish", "shellfish", "seafood", "grilled_fish", "light_starters", "aperitif"];

const BUBBLES = /^(sparkling|champagne)/;
const WHITE   = /^white/;
const BIGRED  = /^(red_full|red_mature)/;

const rules = [
  ["a dry wine served with dessert tastes thin and sour — the sugar in the food must not exceed the sugar in the glass",
   (w, p) => w.insight.sweetness !== "sweet" && w.insight.sweetness !== "semi_sweet" && DESSERT.includes(p)],
  ["a sweet wine with a savoury main is a clash of purpose, not of flavour",
   (w, p) => w.insight.style === "sweet" && [...RED_MEAT, ...DELICATE, "poultry", "veal", "pork", "white_meat", "pasta", "risotto", "pizza"].includes(p)],
  ["tannin plus iodine reads metallic — a big red ruins oysters, caviar and raw fish, and they ruin it back",
   (w, p) => BIGRED.test(w.insight.style) && ["oysters", "caviar", "sushi", "white_fish", "grilled_fish", "shellfish"].includes(p)],
  ["a white or a sparkling has no weight for red meat or game",
   (w, p) => (BUBBLES.test(w.insight.style) || WHITE.test(w.insight.style)) && RED_MEAT.includes(p)],
  ["dark chocolate needs residual sugar and body; it strips a dry sparkling wine bare",
   (w, p) => BUBBLES.test(w.insight.style) && p === "dark_chocolate"],
];

const hits = [];
for (const w of wines) for (const p of w.insight.pairings || [])
  for (const [why, test] of rules) if (test(w, p))
    hits.push({ w: `${w.producer} — ${w.name}`, style: w.insight.style, sweet: w.insight.sweetness, p, why });

console.log(`${wines.length} wines, ${wines.reduce((n, w) => n + (w.insight.pairings || []).length, 0)} pairing tags\n`);
if (!hits.length) console.log("no incompatible pairings found");
const byWhy = new Map();
for (const h of hits) { if (!byWhy.has(h.why)) byWhy.set(h.why, []); byWhy.get(h.why).push(h); }
for (const [why, list] of byWhy) {
  console.log(`\n### ${list.length}×  ${why}`);
  for (const h of list) console.log(`   ${h.w.padEnd(52)} ${h.style.padEnd(18)} ${String(h.sweet).padEnd(10)} → ${h.p}`);
}

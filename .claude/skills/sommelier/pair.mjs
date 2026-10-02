#!/usr/bin/env node
/* The sommelier's bench: run the house pairing model against the real list.
 *
 *   node .claude/skills/sommelier/pair.mjs --foods white_fish,seafood --styles white_mineral,white_fresh
 *   node .claude/skills/sommelier/pair.mjs --dish "tartar"            a dish from data/menu.json
 *   node .claude/skills/sommelier/pair.mjs --wine "dingač"            which live dishes suit a wine
 *   node .claude/skills/sommelier/pair.mjs --vocab                    every food tag and style, with counts
 *
 * Options: --glass (by-the-glass pours only)  --budget 0-60 (bottle price)
 *          --n 10  --live (read the published list instead of the working tree)
 *
 * It uses web/src/lib/pairing.mjs — the same scoring, foodFirst rule and
 * clash rules as the wine list and the daily offer — so what it prints is
 * what a guest's tablet would suggest, ordered deterministically. Read-only. */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { wineRows, suggest, dishScore, clash, sharedFoods, foodVocabulary, STYLE_HR } =
  await import(new URL(`file:///${resolve(ROOT, "web/src/lib/pairing.mjs").replace(/\\/g, "/")}`));
const { FOOD } = await import(new URL(`file:///${resolve(ROOT, "web/src/lib/food.mjs").replace(/\\/g, "/")}`));

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i === -1 ? null : (args[i + 1] ?? ""); };
const has = (k) => args.includes(`--${k}`);
const list = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
const fold = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

async function load() {
  if (has("live")) {
    const o = "https://theatrium.list.devinos.hr";
    const get = (p) => fetch(o + p).then((r) => r.json());
    return [await get("/library/wines.json"), await get("/lists/theatrium.json"), await get("/data/unavailable.json"), await get("/data/menu.json")];
  }
  const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));
  return [read("library/wines.json"), read("lists/theatrium.json"), read("data/unavailable.json"), read("data/menu.json")];
}

const [lib, lst, unavailable, menu] = await load();
const rows = wineRows(lib, lst, unavailable);
const word = (k) => FOOD[k] ? `${k} (${FOOD[k]})` : `${k} (?? no Croatian word in web/src/lib/food.mjs)`;
const eur = (n) => (n == null ? "—" : `${n} €`);

if (has("vocab")) {
  console.log("FOOD TAGS on the shelf tonight (tag, wines carrying it):");
  for (const { k, count } of foodVocabulary(rows)) console.log(`  ${String(count).padStart(3)}  ${word(k)}`);
  const st = new Map();
  for (const r of rows) st.set(r.insight.style, (st.get(r.insight.style) || 0) + 1);
  console.log("\nSTYLES (listings):");
  for (const [k, n] of [...st].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k} — ${STYLE_HR[k] || "?"}`);
  process.exit(0);
}

if (opt("wine") != null) {
  const q = fold(opt("wine"));
  const hits = [...new Map(rows.filter((r) => fold(`${r.producer} ${r.name}`).includes(q)).map((r) => [r.ref, r])).values()];
  if (!hits.length) { console.log("no wine on tonight's list matches"); process.exit(1); }
  for (const w of hits.slice(0, 3)) {
    console.log(`\n${w.producer} — ${w.name}  [${w.ref}]`);
    console.log(`  style ${w.insight.style} · ${w.insight.grape || "?"} · ${w.insight.sweetness || "dry"}`);
    console.log(`  pairings (best first): ${(w.insight.pairings || []).join(", ")}`);
    const live = menu.dishes.filter((d) => !d.off)
      .map((d) => ({ d, s: dishScore(d, w), c: clash(w.insight, d.pairings), sh: sharedFoods(d, w) }))
      .filter((x) => x.s > 0 && !x.c).sort((a, b) => b.s - a.s).slice(0, 6);
    console.log("  suits on tonight's menu:");
    for (const { d, s, sh } of live) console.log(`    ${String(s).padStart(2)}  ${d.name.hr}${sh.length ? `  — shares ${sh.join(", ")}` : "  — style only"}`);
  }
  process.exit(0);
}

let dish;
if (opt("dish") != null) {
  const q = fold(opt("dish"));
  dish = menu.dishes.find((d) => Object.values(d.name).some((n) => fold(n).includes(q)));
  if (!dish) { console.log("no dish in data/menu.json matches"); process.exit(1); }
  console.log(`${dish.name.hr}${dish.off ? "  (PARKED — off the card)" : ""}`);
} else {
  dish = { pairings: list(opt("foods")), styles: list(opt("styles")) };
  if (!dish.pairings.length && !dish.styles.length) {
    console.log("give --foods and/or --styles, --dish, --wine or --vocab (see the header of this file)");
    process.exit(1);
  }
}
const unknown = dish.pairings.filter((k) => !rows.some((r) => (r.insight.pairings || []).includes(k)));
console.log(`foods:  ${dish.pairings.map(word).join(", ") || "—"}`);
console.log(`styles: ${dish.styles.join(", ") || "—"}`);
if (unknown.length) console.log(`!! no wine on the list carries: ${unknown.join(", ")} — that tag cannot find anything`);

const [lo, hi] = (opt("budget") || "0-").split("-").map((x) => (x === "" ? Infinity : Number(x)));
const n = Number(opt("n")) || 8;
const show = (title, xs) => {
  console.log(`\n${title}`);
  if (!xs.length) return console.log("  (nothing)");
  if (xs[0].styleOnly) console.log("  !! nothing shares a food with the dish — these match on STYLE ONLY");
  for (const w of xs)
    console.log(`  ${String(w.score).padStart(2)}  ${w.producer} — ${w.name}${w.recommended ? " ★" : ""}\n` +
      `      ${w.style} · ${w.grape} · shares: ${w.shared.join(", ") || "—"} · bottle ${eur(w.price)}${w.glassPrice != null ? ` · glass ${eur(w.glassPrice)}` : ""}\n` +
      `      ref ${w.ref}`);
};
if (!has("glass")) show(`BY THE BOTTLE${hi < Infinity || lo > 0 ? ` (${lo}–${hi} €)` : ""}`, suggest(dish, rows, { n, lo: lo || 0, hi }));
show("BY THE GLASS", suggest(dish, rows, { n: Math.min(n, 6), glassOnly: true }).map((w) => ({ ...w, glassPrice: w.price, price: null })));

const clashed = [...new Map(rows.map((r) => [r.ref, r])).values()]
  .map((r) => ({ r, c: clash(r.insight, dish.pairings) })).filter((x) => x.c);
if (clashed.length) {
  const by = new Map();
  for (const { c } of clashed) by.set(c.why, (by.get(c.why) || 0) + 1);
  console.log(`\nwines whose style clashes with one of these foods: ${clashed.length}`);
  console.log("  (enforced only on style-only matches — a wine that shares a food already passed");
  console.log("   validate.mjs; use this as the sanity check on any wine you pick by hand)");
  for (const [why, k] of by) console.log(`  ${k} × ${why}`);
}

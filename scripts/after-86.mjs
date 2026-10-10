/* Run after wines are hidden or brought back (owner, 2026-10-10: "if added,
   reconsider the pairings; if removed, reconsider the pairings again").

     node scripts/after-86.mjs             tonight's list, 86s applied
     node scripts/after-86.mjs --no-hide   the full list, for comparison

   The code already does the hiding: the tablet's "Pomozi mi odabrati" and the
   website's daily offer both read data/unavailable.json, so an 86'd wine is
   never offered, and the website tops a lost pick up with the next best
   bottle (dishWines() in web/functions/_lib/daily.js). What the code cannot
   do is judge the result, which is what this prints:

   1. Coverage — for every live dish, every bottle band and the glass list,
      how many wines share a food with the dish. Under 3 is listed. The Ikone
      band is thin by design (CLAUDE.md); anything else under 3 is a gap to
      fix with tags or a wine, never with a weaker rule.
   2. Text pointing at a producer that has nothing left on the list — a note
      or winery story saying "X is on this list" while every X is hidden.
      Hides are usually for a night, so rewrite only text that claims the
      other wine is *here*; a story that merely mentions the house is fine. */
import { readFileSync } from "node:fs";
import { wineRows, suggest } from "../web/src/lib/pairing.mjs";

const rd = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const lib = rd("library/wines.json"), list = rd("lists/theatrium.json");
const unav = process.argv.includes("--no-hide") ? { hidden: [] } : rd("data/unavailable.json");
const rows = wineRows(lib, list, unav);
const menu = rd("data/menu.json");
const dishes = (Array.isArray(menu) ? menu : menu.dishes || Object.values(menu)).filter((d) => !d.off);

const BANDS = [["do 60", 0, 60], ["60-120", 60, 120], ["120+", 120, Infinity], ["Ikone 500+", 500, Infinity]];
const short = [];
for (const d of dishes) {
  const name = d.name?.hr || d.name;
  const cells = [];
  const check = (label, s) => {
    const food = s.filter((x) => !x.styleOnly);
    cells.push(`${label}: ${food.length}`);
    if (food.length < 3) short.push(`  ${name} [${label}] ${food.length} sharing a food${s.length && s[0].styleOnly ? `, style-only fallback ${s.length}` : ""}: ${s.slice(0, 3).map((x) => `${x.producer} ${x.name}`).join("; ") || "nothing"}`);
  };
  for (const [label, lo, hi] of BANDS) check(label, suggest(d, rows, { lo, hi, n: 99 }));
  check("čaša", suggest(d, rows, { glassOnly: true, n: 99 }));
  console.log(`${String(name).padEnd(45)} ${cells.join(" | ")}`);
}
console.log(`\n${dishes.length} live dishes; ${short.length} dish x band combinations under 3:`);
for (const s of short) console.log(s);

/* 2. "on this list" text pointing at a producer with nothing live */
/* Spirits are not pairing rows, so "live" is read off the list itself: a
   listing is gone only when a rule with no `where` hides it everywhere. */
const hiddenAll = new Set((unav.hidden || []).filter((h) => !h.where).map((h) => `${h.producer}|${h.name}`));
const listed = new Set(), liveProducers = new Set();
(function walk(n) {
  if (Array.isArray(n)) return n.forEach(walk);
  if (n && typeof n === "object") {
    const w = n.ref && lib.wines[n.ref];
    if (w) { listed.add(w.producer); if (!hiddenAll.has(`${w.producer}|${w.name}`)) liveProducers.add(w.producer); }
    Object.values(n).forEach(walk);
  }
})(list);
const noteOf = Object.entries(lib.wines).filter(([, w]) => liveProducers.has(w.producer));
const gone = [...listed].filter((p) => !liveProducers.has(p));
const HERE = /on this list|this list too|right next to|beside it on/i;
const stale = [];
const producers = rd("data/producers.json").producers;
for (const g of gone) {
  const toks = [g, g.split(" ").pop()].filter((t) => t.length > 4);
  for (const [ref, w] of noteOf) {
    const en = (w.note && w.note.en) || "";
    if (w.producer !== g && HERE.test(en) && toks.some((t) => en.includes(t))) stale.push(`  note ${ref} -> ${g}`);
  }
  for (const [pk, pv] of Object.entries(producers)) {
    const en = (pv.blurb && pv.blurb.en) || "";
    if (pk !== g && liveProducers.has(pk) && HERE.test(en) && toks.some((t) => en.includes(t))) stale.push(`  blurb ${pk} -> ${g}`);
  }
}
console.log(`\nProducers with nothing on the list tonight: ${gone.join(", ") || "none"}`);
console.log(stale.length ? `Text saying they are here:\n${[...new Set(stale)].join("\n")}` : "No text claims any of them is on the list.");

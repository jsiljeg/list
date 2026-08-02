import fs from "node:fs";
import vm from "node:vm";
import { joinList } from "../scripts/lib/list.mjs";

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("js/i18n.js", "utf8") + "\nthis.I18N=I18N;this.LANGS=LANGS;", ctx);
const { I18N, LANGS } = ctx;
const menu = JSON.parse(fs.readFileSync("data/menu.json", "utf8"));
const { list } = joinList();

const items = [];
const walk = (n, sec, cat, g) => {};
for (const sec of list.sections)
  for (const cat of sec.categories)
    for (const grp of cat.groups)
      for (const it of grp.items) if (it) items.push({ ...it, _sec: sec.id, _cat: cat.id });

const wines = items.filter((i) => i.insight && !i.insight.kind);
console.log(`wines on the list: ${wines.length}  (glass: ${wines.filter(w=>w._sec==="glass").length}, bottle: ${wines.filter(w=>w._sec.startsWith("bottle-")).length})`);

// ---- 1. dish pairing keys vs wine pairing keys vs i18n ----
const winePair = new Set();
for (const w of wines) for (const p of w.insight.pairings || []) winePair.add(p);
const dishPair = new Set();
for (const d of menu.dishes) for (const p of d.pairings || []) dishPair.add(p);
const i18nPair = new Set(Object.keys(I18N.hr.pairings || {}));

console.log("\n--- dish pairing keys that NO wine carries (score 0 forever) ---");
for (const p of [...dishPair].sort()) if (!winePair.has(p)) console.log("  " + p + (i18nPair.has(p) ? "" : "   [also missing from i18n]"));
console.log("\n--- dish pairing keys missing from i18n ---");
for (const p of [...dishPair].sort()) if (!i18nPair.has(p)) console.log("  " + p);
console.log("\n--- wine pairing keys missing from i18n (would render raw) ---");
for (const p of [...winePair].sort()) if (!i18nPair.has(p)) console.log("  " + p);

// ---- 2. how many wines each dish can actually reach ----
console.log("\n--- reach per dish (bottle sections only, as the helper does) ---");
const bottles = wines.filter((w) => w._sec.startsWith("bottle-"));
const rows = [];
for (const d of menu.dishes) {
  let byPair = 0, byStyle = 0, any = 0, top = 0;
  for (const w of bottles) {
    const p = (w.insight.pairings || []).filter((x) => (d.pairings || []).includes(x)).length;
    const s = (d.styles || []).includes(w.insight.style) ? 1 : 0;
    if (p) byPair++;
    if (s) byStyle++;
    const score = p * 3 + s * 3 + (w.recommended ? 1 : 0);
    if (score > 0) any++;
    if (score >= 6) top++;
  }
  rows.push({ dish: d.name.en, byPair, byStyle, any, top, pairs: (d.pairings||[]).join(","), styles: (d.styles||[]).join(",") });
}
rows.sort((a, b) => a.top - b.top);
for (const r of rows) console.log(`  top6+:${String(r.top).padStart(3)}  pairhits:${String(r.byPair).padStart(3)}  stylehits:${String(r.byStyle).padStart(3)}  any:${String(r.any).padStart(3)}  ${r.dish}`);

// ---- 3. recommendations ----
const rec = items.filter((i) => i.recommended);
console.log(`\n--- recommendations ---`);
console.log(`recommended listings: ${rec.length} of ${items.length} (${(rec.length/items.length*100).toFixed(1)}%)`);
const recWines = rec.filter((i) => i.insight && !i.insight.kind);
console.log(`  of which wines: ${recWines.length} of ${wines.length} (${(recWines.length/wines.length*100).toFixed(1)}%)`);
const bySec = {};
for (const i of items) {
  bySec[i._sec] ||= { n: 0, r: 0 };
  bySec[i._sec].n++;
  if (i.recommended) bySec[i._sec].r++;
}
for (const [k, v] of Object.entries(bySec)) console.log(`  ${k.padEnd(18)} ${String(v.r).padStart(3)} / ${String(v.n).padStart(3)}  ${(v.r/v.n*100).toFixed(0)}%`);

#!/usr/bin/env node
/* Where a Dodaj vino card actually put the wine, read from the files.
 *
 *   node scripts/card-placement.mjs                 in the run: intake/request.json,
 *                                                   intake/result.json, base = HEAD
 *   node scripts/card-placement.mjs --base <git-rev> --request <json> [--result <json>]
 *
 * Found 2026-11-20 (El Molar 2021): Filho gave a bottle price only; the run
 * wrote "Crna vina po boci → Španjolska, iza Casa Rojo CL98" into the
 * preview, and then inserted the listing after the *glass* CL98 — CL98 is
 * poured by the glass too. The preview said bottle, the card said glass, and
 * nothing compared the two, so the wine went live at 75 € a glass.
 *
 * So the placement Filho reads is no longer the model's sentence: this
 * writes it from the list (result.placement), and fails when the listings
 * the card added do not match the prices Filho gave — a glass listing needs
 * a glass price, a bottle listing a bottle price, and each price a listing
 * (unless the wine was already listed that way). Exit 1 on a mismatch. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const isGlass = (sid) => sid === "glass";

/** Every listing of `ref`: [{sid, cat, idx, items, it}] in list order. */
export function listingsOf(list, ref) {
  const out = [];
  for (const sec of list.sections) for (const cat of sec.categories) for (const g of cat.groups)
    g.items.forEach((it, idx) => { if (it.ref === ref) out.push({ sid: sec.id, cat: cat.id, country: g.country, idx, items: g.items, it }); });
  return out;
}

const sig = (l) => `${l.sid}|${l.cat}|${l.it.vol ?? 0.75}`;

/** Listings in `list` that `base` did not have (by shelf, category and size). */
export function added(base, list, ref) {
  const before = {};
  for (const l of listingsOf(base, ref)) before[sig(l)] = (before[sig(l)] || 0) + 1;
  return listingsOf(list, ref).filter((l) => !(before[sig(l)]-- > 0));
}

/** Pure. [] when the card's listings agree with Filho's prices. */
export function placementProblems({ base, list, ref, priceBottle, priceGlass }) {
  const had = listingsOf(base, ref), now = added(base, list, ref);
  const p = [];
  const glassNew = now.filter((l) => isGlass(l.sid)), bottleNew = now.filter((l) => !isGlass(l.sid));
  if (glassNew.length && priceGlass == null) p.push("vino je stavljeno na čašu, a cijena čaše nije zadana");
  if (bottleNew.length && priceBottle == null) p.push("vino je stavljeno među boce, a cijena boce nije zadana");
  const hasGlass = (xs) => xs.some((l) => isGlass(l.sid)), hasBottle = (xs) => xs.some((l) => !isGlass(l.sid));
  if (priceGlass != null && !hasGlass(now) && !hasGlass(had)) p.push("zadana je cijena čaše, a vino nije na čaši");
  if (priceBottle != null && !hasBottle(now) && !hasBottle(had)) p.push("zadana je cijena boce, a vino nije među bocama");
  return p;
}

const SHELF = { glass: "Vina na čašu", "bottle-sparkling": "Pjenušci po boci", "bottle-white": "Bijela vina po boci",
  "bottle-rose": "Rosé po boci", "bottle-red": "Crna vina po boci", "bottle-dessert": "Desertna vina po boci" };
const CAT = { sparkling: "pjenušci", champagne: "champagne", white: "bijela", red: "crna", rose: "rosé", dessert: "desertna" };

/** Croatian, one line per new listing: shelf → group, beside which wine, price. */
export function describe(base, list, ref, library = {}, countries = {}) {
  const name = (r) => { const w = library[r]; return w ? `${w.producer} ${w.name}` : r; };
  const eur = (n) => `${String(n).replace(".", ",")} €`;
  return added(base, list, ref).map((l) => {
    const where = isGlass(l.sid) ? `${SHELF.glass} → ${CAT[l.cat] || l.cat}` : `${SHELF[l.sid] || l.sid}${l.country ? ` → ${countries[l.country] || l.country}` : ""}`;
    const prev = l.items[l.idx - 1], next = l.items[l.idx + 1];
    const beside = [prev && `iza ${name(prev.ref)}`, next && `ispred ${name(next.ref)}`].filter(Boolean).join(", ");
    const size = isGlass(l.sid) ? "čaša" : `boca ${String(l.it.vol ?? 0.75).replace(".", ",")} l`;
    return `${where}${beside ? `, ${beside}` : ""}: ${l.it.price != null ? eur(l.it.price) : "bez cijene"}, ${size}.`;
  }).join(" ");
}

function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const reqPath = arg("--request", "intake/request.json"), resPath = arg("--result", "intake/result.json");
  const rev = arg("--base", "HEAD");
  const req = JSON.parse(fs.readFileSync(reqPath, "utf8"));
  const item = req.item || req;                     /* the inbox's {item} or the run's request.json */
  const res = fs.existsSync(resPath) ? JSON.parse(fs.readFileSync(resPath, "utf8")) : {};
  const ref = arg("--ref", res.ref || item.ref);
  if (!ref) { console.log("no ref: nothing to check"); return 0; }
  const base = JSON.parse(execFileSync("git", ["show", `${rev}:lists/theatrium.json`], { encoding: "utf8", maxBuffer: 1 << 26 }));
  const list = JSON.parse(fs.readFileSync("lists/theatrium.json", "utf8"));
  const library = JSON.parse(fs.readFileSync("library/wines.json", "utf8")).wines;
  const problems = placementProblems({ base, list, ref, priceBottle: item.price_bottle ?? null, priceGlass: item.price_glass ?? null });
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync("js/i18n.js", "utf8") + "\nthis.I18N = I18N;", ctx);
  const line = describe(base, list, ref, library, ctx.I18N.hr.countries || {});
  if (fs.existsSync(resPath) && line && process.argv.includes("--write")) {
    res.placement = line;
    fs.writeFileSync(resPath, JSON.stringify(res, null, 1) + "\n");
  }
  console.log(line || "(no new listing)");
  for (const p of problems) console.log("PROBLEM: " + p);
  return problems.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) process.exit(main());

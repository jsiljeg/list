/* The bazna cijena: one place that knows what the frozen base price of a
   listing is, so validate.mjs, the cjenik, the apply script and the tests
   cannot disagree about it.

   Law: Zakon o zaštiti potrošača čl. 7 (NN 59/2026) and the Pravilnik o
   isticanju bazne cijene proizvoda (NN 132/2026-1583), in force 17.11.2026.
   Čl. 3: for food and drink the base price is the retail price charged on
   2.5.2025., or — for an item first offered later — the price on the day it
   was first offered. Owner, 2026-11-17: go with 2.5.2025.; Filho decides the
   figures and their dates, row by row.

   Two warrants can exist, and the newer wins:

     data/source/bazna-cijena.json           per listing: price AND date,
                                             written by scripts/bazna-cijena.mjs
                                             from Filho's decisions
     data/source/anchor-prices-2026-09-10.json  the old "sidrena cijena" seed,
                                             one date for everything

   A listing carries `anchor` (the figure) and, under the new warrant,
   `anchorDate` (ISO day). Neither is ever edited by hand or by /admin: the
   price moves, the base price does not. */
import fs from "node:fs";
import path from "node:path";

export const BAZNA_FILE = "data/source/bazna-cijena.json";
export const LEGACY_FILE = "data/source/anchor-prices-2026-09-10.json";
export const FOOD_DRINK_DAY = "2025-05-02";

/** The shelf a listing sits on — what makes its price its own. A glass pour
 *  and a bottle of the same wine have two prices; which bottle category the
 *  venue files it under does not change the price. */
export const shelf = (sectionId) =>
  sectionId === "glass" ? "glass" : sectionId.startsWith("bottle-") ? "bottle" : sectionId;

export const key = (shelfId, ref, vol) => [shelfId, ref, vol == null ? "" : String(vol)].join("|");

/** The warrant in force: {kind, file, byKey: Map(key -> {price, date})}. */
export function loadWarrant(root = ".") {
  const p = (f) => path.join(root, f);
  if (fs.existsSync(p(BAZNA_FILE))) {
    const w = JSON.parse(fs.readFileSync(p(BAZNA_FILE), "utf8"));
    return { kind: "bazna", file: BAZNA_FILE,
             byKey: new Map(w.prices.map((x) => [key(x.shelf, x.ref, x.vol), { price: x.price, date: x.date }])) };
  }
  const w = JSON.parse(fs.readFileSync(p(LEGACY_FILE), "utf8"));
  return { kind: "legacy", file: LEGACY_FILE,
           byKey: new Map(w.prices.map((x) => [key(x.shelf, x.ref, x.vol), { price: x.price, date: w.date }])) };
}

/** Every problem a listing's base price can have against the warrant, as
 *  strings. Empty means it agrees. */
export function checkListing(warrant, sectionId, it) {
  const was = warrant.byKey.get(key(shelf(sectionId), it.ref, it.vol));
  const at = `${sectionId}: "${it.ref}"`;
  const out = [];
  if (it.anchor === undefined) {
    if (was) out.push(`${at}: lost its bazna cijena — it is ${was.price} € (${was.date}) in ${warrant.file}. Restore "anchor": ${was.price}`);
    return out;
  }
  if (typeof it.anchor !== "number") out.push(`${at}: anchor must be a number (no quotes, no €)`);
  else if (!was) out.push(`${at}: has a bazna cijena that ${warrant.file} does not hold — drop the field, or record it through scripts/bazna-cijena.mjs`);
  else if (it.anchor !== was.price) out.push(`${at}: anchor says ${it.anchor} € but ${warrant.file} says ${was.price} €. The base price never changes — edit "price" and put this one back`);
  if (warrant.kind === "bazna" && was) {
    if (it.anchorDate !== was.date) out.push(`${at}: anchorDate says ${it.anchorDate} but ${warrant.file} says ${was.date}`);
  } else if (it.anchorDate !== undefined) {
    out.push(`${at}: anchorDate exists only under ${BAZNA_FILE}`);
  }
  return out;
}

/** "2.5.2025." / "02.05.2025" / "2025-05-02" -> "2025-05-02"; "" -> null. */
export function isoDay(s) {
  const t = String(s || "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})\.?$/);
  if (!m) return undefined;
  const d = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return Number.isNaN(Date.parse(d)) ? undefined : d;
}

#!/usr/bin/env node
/* Give every listing that has no bazna cijena one — run by every deploy.

   Owner, 2026-11-24: the bazna cijena of everything on the list that day is
   its price that day, dated 10.9.2026. Anything listed after that (a new wine
   from Dodaj vino, a "+ čaša", a new size) has, by NN 132/2026-1583 čl. 3, the
   price and the day it was FIRST offered. Nobody should have to remember
   that, so the deploy stamps it: a listing with a price and no `anchor` gets
   `anchor` = its price and `anchorDate` = today (Zagreb), and a row in the
   warrant data/source/bazna-cijena.json. A listing that comes back after
   being taken off keeps the row it already had in the warrant.

     node scripts/bazna-new.mjs           # stamp, print what was stamped
     node scripts/bazna-new.mjs --check   # print only, exit 1 if anything is owed */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/list.mjs";
import { shelf, key, BAZNA_FILE } from "./lib/bazna.mjs";

export const zagrebDay = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(d);   /* YYYY-MM-DD */

/** Pure. Mutates list + warrant; returns the stamped listings. */
export function stamp(list, warrant, day) {
  const by = new Map(warrant.prices.map((x) => [key(x.shelf, x.ref, x.vol), x]));
  const done = [];
  for (const sec of list.sections) for (const cat of sec.categories) for (const g of cat.groups)
    g.items = g.items.map((it) => {
      if (it.price == null || it.anchor !== undefined) return it;
      const k = key(shelf(sec.id), it.ref, it.vol);
      let row = by.get(k);
      if (!row) {
        row = { shelf: shelf(sec.id), ref: it.ref, vol: it.vol ?? null, price: it.price, date: day,
                source: "prvi dan na listi (upisao deploy)" };
        warrant.prices.push(row); by.set(k, row);
      }
      done.push(`${sec.id} ${it.ref}${it.vol ? " " + it.vol : ""}: ${row.price} € od ${row.date}`);
      const out = {};
      for (const [f, v] of Object.entries(it)) { out[f] = v; if (f === "price") { out.anchor = row.price; out.anchorDate = row.date; } }
      return out;
    });
  warrant.prices.sort((a, b) => (a.shelf + a.ref + (a.vol ?? "")).localeCompare(b.shelf + b.ref + (b.vol ?? "")));
  return done;
}

function main() {
  const lp = path.join(ROOT, "lists/theatrium.json"), wp = path.join(ROOT, BAZNA_FILE);
  if (!fs.existsSync(wp)) { console.log("bazna: no warrant yet, nothing to stamp"); return 0; }
  const list = JSON.parse(fs.readFileSync(lp, "utf8"));
  const warrant = JSON.parse(fs.readFileSync(wp, "utf8"));
  const done = stamp(list, warrant, zagrebDay());
  for (const d of done) console.log("bazna: " + d);
  if (!done.length) { console.log("bazna: every listing has one"); return 0; }
  if (process.argv.includes("--check")) return 1;
  const dump = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 1) + "\n");
  dump(lp, list); dump(wp, warrant);
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) process.exit(main());

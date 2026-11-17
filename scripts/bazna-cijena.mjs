/* Write Filho's decided base prices (bazna cijena) onto the list.

   Owner, 2026-11-17: "He will decide on prices what we follow and with which
   date." The figures do not come from this script. They come from:

     the proposal   data/source/bazna-prijedlog-2026-11-17.json — what the
                    till charged on 2.5.2025. (or on the first day an item was
                    sold), per listing; read from D1 by till-price-history.yml
     the decisions  Filho's answers on the review page (a claude.ai artifact),
                    exported as one JSON file per listing:
                      {"s": "ok"}                      take the proposal
                      {"s": "fix", "cijena": "45",     his own figure and day
                       "datum": "2.5.2025.", "napomena": "…"}

   A listing with no decision gets NO base price: nothing is ever invented
   here, and validate.mjs then refuses an `anchor` the warrant does not hold.
   An empty "datum" on a fix means 2.5.2025.

   It writes `anchor` + `anchorDate` on every decided listing of
   lists/theatrium.json, drops them from every undecided one, and writes the
   warrant data/source/bazna-cijena.json, which validate.mjs holds the list to
   from then on. Re-running it with more decisions is safe: it rebuilds both
   from the proposal and the decisions every time.

     node scripts/bazna-cijena.mjs <decisions-dir>           # report only
     node scripts/bazna-cijena.mjs <decisions-dir> --write   # write both files
*/
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/list.mjs";
import { shelf, BAZNA_FILE, FOOD_DRINK_DAY, isoDay } from "./lib/bazna.mjs";

const PROPOSAL = "data/source/bazna-prijedlog-2026-11-17.json";

/** The review page's id for a listing — section, ref, stored vol. */
export const listingId = (sectionId, ref, vol) =>
  `${sectionId}~${ref}~${vol ?? ""}`.replace(/[^A-Za-z0-9_.~:@+-]/g, "-");

/** Pure: decide every listing. Returns {rows, decided, pending, problems}. */
export function decide(list, proposal, decisions) {
  const byId = new Map(proposal.prices.map((p) => [p.id, p]));
  const rows = [], pending = [], problems = [];
  for (const sec of list.sections)
    for (const cat of sec.categories)
      for (const g of cat.groups)
        for (const it of g.items) {
          if (it.price == null) continue;
          const id = listingId(sec.id, it.ref, it.vol);
          const d = decisions[id], p = byId.get(id);
          let price, date, source;
          if (d && d.s === "ok" && p) { price = p.price; date = p.date; source = "blagajna, odobrio Filho"; }
          else if (d && d.s === "ok") { problems.push(`${id}: "U redu" without a till proposal — needs a figure`); }
          else if (d && d.s === "fix" && d.cijena != null && String(d.cijena).trim() !== "") {
            price = Number(String(d.cijena).replace(",", "."));
            date = isoDay(d.datum) ?? (String(d.datum || "").trim() ? undefined : FOOD_DRINK_DAY);
            source = "upisao Filho" + (d.napomena ? `: ${d.napomena}` : "");
            if (!Number.isFinite(price) || price <= 0 || Math.round(price * 100) !== price * 100) { problems.push(`${id}: "${d.cijena}" is not a price`); price = undefined; }
            if (date === undefined) { problems.push(`${id}: "${d.datum}" is not a date`); price = undefined; }
          }
          if (price === undefined) { pending.push(id); continue; }
          rows.push({ id, sec: sec.id, it, shelf: shelf(sec.id), ref: it.ref, vol: it.vol ?? null, price, date, source });
        }
  return { rows, decided: rows.length, pending, problems };
}

/** Pure: put `anchor` + `anchorDate` right under `price` where decided, and
 *  take both off everywhere else. Mutates and returns `list`. */
export function applyToList(list, rows) {
  const by = new Map(rows.map((r) => [r.id, r]));
  for (const sec of list.sections)
    for (const cat of sec.categories)
      for (const g of cat.groups)
        g.items = g.items.map((it) => {
          const r = by.get(listingId(sec.id, it.ref, it.vol));
          const out = {};
          for (const [k, v] of Object.entries(it)) {
            if (k === "anchor" || k === "anchorDate") continue;
            out[k] = v;
            if (k === "price" && r) { out.anchor = r.price; out.anchorDate = r.date; }
          }
          return out;
        });
  return list;
}

const dump = (p, data) =>
  fs.writeFileSync(p, JSON.stringify(data, null, 1) + "\n");   /* LF, as the repo stores it */

function readDecisions(dir) {
  const out = {};
  const walk = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith(".json")) {
        const j = JSON.parse(fs.readFileSync(p, "utf8"));
        out[f.name.replace(/\.json$/, "")] = j.data ?? j;   /* an export may wrap the body */
      }
    }
  };
  walk(dir);
  return out;
}

function main() {
  const [dir] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!dir) { console.error("usage: node scripts/bazna-cijena.mjs <decisions-dir> [--write]"); return 2; }
  const listPath = path.join(ROOT, "lists/theatrium.json");
  const list = JSON.parse(fs.readFileSync(listPath, "utf8"));
  const proposal = JSON.parse(fs.readFileSync(path.join(ROOT, PROPOSAL), "utf8"));
  const res = decide(list, proposal, readDecisions(dir));
  console.log(`${res.decided} listings decided, ${res.pending.length} still waiting on Filho`);
  for (const p of res.problems) console.log("  problem: " + p);
  if (res.problems.length) { console.error("refusing to write while a decision is unreadable"); return 1; }
  if (!process.argv.includes("--write")) { console.log("dry run; pass --write"); return 0; }
  dump(listPath, applyToList(list, res.rows));
  dump(path.join(ROOT, BAZNA_FILE), {
    note: "Bazna cijena po stavci, kako ju je odobrio Filho (NN 132/2026-1583, čl. 3). " +
          "Ne uređivati rukom: piše ju scripts/bazna-cijena.mjs, a validate.mjs drži listu uz nju.",
    currency: list.currency || "EUR",
    prices: res.rows.map(({ shelf, ref, vol, price, date, source }) => ({ shelf, ref, vol, price, date, source }))
      .sort((a, b) => (a.shelf + a.ref + (a.vol ?? "")).localeCompare(b.shelf + b.ref + (b.vol ?? ""))),
  });
  console.log(`wrote lists/theatrium.json and ${BAZNA_FILE}`);
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) process.exit(main());

/* Does the till charge what the list says?

   Found 2026-11-17: Filho raised 30 prices in /admin on 20–23.10. and the
   till (Remaris) was never told, so for four weeks guests were charged the
   old price — two wines were charged MORE than the list says. Remaris has no
   API we can write to, so keeping the two in step stays a person's job; this
   makes it a job somebody is told about the next morning, instead of one a
   bazna-cijena audit stumbles on a month later.

   Input: the JSON till-price-history.yml writes ({span, prices: [{name,
   price, first, last, n}]}). For every till article data/till-map.json ties
   to a listing, the price it was last charged — if that was within the
   window — is compared with the list:

     PREPLATA      the till charges more than the list (fix first)
     STARA CIJENA  the till charges less, usually a price changed only on the list
     VELIČINA      a glass article charging a bottle's price
     BERBA         the article's name carries another vintage than the card

   Exit 1 when anything is found, so the scheduled run fails and GitHub mails
   the repository owner; the Croatian table is written to the job summary.

     node scripts/till-check.mjs <history.json> [--since YYYY-MM-DD]
*/
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/list.mjs";

const year = (s) => (String(s).match(/\b(19|20)\d\d\b/) || [])[0];

/** Pure. Returns [{kind, wine, size, art, till, list, last, note}]. */
export function tillProblems({ history, tillMap, list, library, since }) {
  const byArt = {};
  for (const p of history.prices) (byArt[p.name] ??= []).push(p);
  const art4 = {};
  for (const [n, a] of Object.entries(tillMap.articles || {})) if (a.ref && !a.ask) (art4[a.ref + "|" + a.vol] ??= []).push(n);
  const out = [];
  for (const sec of list.sections) for (const cat of sec.categories) for (const g of cat.groups) for (const it of g.items) {
    if (it.price == null) continue;
    const w = library[it.ref] || {};
    const glass = sec.id === "glass";
    const vol = glass ? 0.1 : (it.vol ?? 0.75);
    const wine = [w.producer, w.name].filter(Boolean).join(" ") || it.ref;
    const size = glass ? "čaša" : `${String(vol).replace(".", ",")} l`;
    for (const n of art4[it.ref + "|" + vol] || []) {
      const t = (byArt[n] || []).slice().sort((a, b) => (a.last < b.last ? 1 : -1))[0];
      if (!t || t.last < since) continue;
      const base = { wine, size, art: n, till: t.price, list: it.price, last: t.last };
      if (glass && t.price > 40) out.push({ ...base, kind: "VELIČINA", note: `artikl za čašu ima cijenu boce; postaviti ${it.price} €` });
      else if (t.price > it.price) out.push({ ...base, kind: "PREPLATA", note: `gost plaća ${t.price - it.price} € više nego što piše na karti` });
      else if (t.price < it.price) out.push({ ...base, kind: "STARA CIJENA", note: `na blagajni postaviti ${it.price} €` });
      const y1 = year(n), y2 = year(w.name);
      if (y1 && y2 && y1 !== y2) out.push({ ...base, kind: "BERBA", note: `preimenovati artikl: na karti je berba ${y2}, ne ${y1}` });
    }
  }
  const order = { PREPLATA: 0, "VELIČINA": 1, "STARA CIJENA": 2, BERBA: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.wine.localeCompare(b.wine, "hr"));
}

export function markdown(problems, since) {
  if (!problems.length) return `**Blagajna i karta se slažu** (naplate od ${since}).\n`;
  return [`**Blagajna (Remaris) se ne slaže s kartom: ${problems.length}** (naplate od ${since})`, "",
    "| Vrsta | Vino | Artikl na blagajni | Blagajna | Karta | Zadnja naplata | Što napraviti |",
    "|---|---|---|---|---|---|---|",
    ...problems.map((p) => `| ${p.kind} | ${p.wine} (${p.size}) | \`${p.art}\` | ${p.till} € | ${p.list} € | ${p.last} | ${p.note} |`), ""].join("\n");
}

function main() {
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const si = process.argv.indexOf("--since");
  const since = si > 0 ? process.argv[si + 1] : new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
  const problems = tillProblems({
    history: JSON.parse(fs.readFileSync(file, "utf8")),
    tillMap: rd("data/till-map.json"), list: rd("lists/theatrium.json"),
    library: rd("library/wines.json").wines, since,
  });
  const md = markdown(problems, since);
  process.stdout.write(md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  return problems.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) process.exit(main());

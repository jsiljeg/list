/* The price list as a machine can read it — /cjenik/ on the site.

   From 01.10.2026 a Croatian business with a website must publish its price
   list there in a format fit for automatic processing (XML or CSV), a service
   provider must refresh it as soon as anything changes, and every published
   version has to stay reachable for at least 30 days.

   So this writes four things into cjenik/:

     cjenik.xml / cjenik.csv              the current list, at a stable URL
     cjenik-YYYY-MM-DD.xml / .csv         the archive, one pair per change
     index.html                           the human page that links them

   A dated pair is written only when the *content* changes. Nothing was
   published on a day the prices did not move, so there is nothing to retain
   for it, and an archive that grew a duplicate on every deploy would bury the
   three days that matter.

   The two formats are not the same artefact and are not tuned the same way.
   The XML is for a machine: ISO dates, dot decimals, one element per item.
   The CSV is for whoever opens it in Excel in an office in Zagreb, so it is
   semicolon-separated with a BOM, which is what Croatian Excel expects; its
   numbers stay dot-decimal so a parser pointed at either file reads the same
   values.

   `sazetak` on the XML root is a digest of the rows alone — not of the publish
   date — and scripts/validate.mjs recomputes it from the live data on every
   deploy. That is what makes "immediately after every change" enforceable
   rather than remembered: change a price without regenerating, and the deploy
   stops.

     node scripts/make-cjenik.mjs          # write, if anything changed
     node scripts/make-cjenik.mjs --check  # say what would change, write nothing
*/
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createHash } from "node:crypto";
import { joinList, ROOT } from "./lib/list.mjs";

const OUT = path.join(ROOT, "cjenik");
const ANCHOR_DATE = "2026-09-10";

/* Who is publishing. The OIB belongs here — a cjenik identifies its issuer —
   but nobody has given us one, so the attribute is left off rather than
   emitted empty. Ask the owner and fill it in. */
const ISSUER = {
  obveznik: "Apelacija d.o.o.",
  objekt: "Restoran Theatrium by Filho",
  adresa: "Teslina 7, 10000 Zagreb",
  oib: "",
};

function hrStrings() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/i18n.js"), "utf8") + "\nthis.I18N = I18N;", ctx);
  return ctx.I18N.hr;                       /* a Croatian filing, in Croatian */
}

const hrNum = (n) => n.toLocaleString("hr-HR");

/** The measure a price is quoted per. Never guessed: a glass pour is on the
 *  category, a bottle format on the item (absent means the ordinary 0,75), and
 *  a spirit's pour is in neither — the data has never held it, so the field
 *  stays empty rather than inventing a 0,03 l nobody agreed to. */
function measure(sec, cat, item) {
  if (cat.serving) return cat.serving;
  if (item.vol) return hrNum(item.vol) + " l";
  return sec.id.startsWith("bottle-") ? "0,75 l" : "";
}

/** One row per listing, in list order, with the ref as its code.

 *  `ref` never reaches the app — mergeList() deletes it on the way in — so the
 *  codes are read off the list file and zipped onto the joined rows, which walk
 *  the same tree in the same order. */
export function rows() {
  const t = hrStrings();
  const joined = joinList().list;
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "lists/theatrium.json"), "utf8"));
  const refs = [];
  for (const sec of raw.sections)
    for (const cat of sec.categories)
      for (const g of cat.groups)
        for (const it of g.items) refs.push(it.ref);

  const out = [];
  for (const sec of joined.sections)
    for (const cat of sec.categories)
      for (const g of cat.groups)
        for (const item of g.items)
          out.push({
            sifra: refs[out.length] || "",
            naziv: item.name || "",
            proizvodjac: item.producer || "",
            skupina: t.sections[sec.id] || sec.id,
            kategorija: t.categories[cat.id] || cat.id,
            mjera: measure(sec, cat, item),
            cijena: item.price,
            sidrena_cijena: item.anchor == null ? null : item.anchor,
          });
  return out;
}

export const digest = (r) =>
  "sha256:" + createHash("sha256").update(JSON.stringify(r)).digest("hex").slice(0, 32);

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => (n == null ? "" : n.toFixed(2));

export function xml(r, today) {
  const attrs = Object.entries(ISSUER).filter(([, v]) => v)
    .map(([k, v]) => k + '="' + esc(v) + '"').join(" ");
  const body = r.map((x) => [
    '  <stavka sifra="' + esc(x.sifra) + '">',
    "    <naziv>" + esc(x.naziv) + "</naziv>",
    "    <proizvodjac>" + esc(x.proizvodjac) + "</proizvodjac>",
    "    <skupina>" + esc(x.skupina) + "</skupina>",
    "    <kategorija>" + esc(x.kategorija) + "</kategorija>",
    "    <mjera>" + esc(x.mjera) + "</mjera>",
    '    <cijena valuta="EUR">' + money(x.cijena) + "</cijena>",
    ...(x.sidrena_cijena == null ? []
      : ['    <sidrena_cijena valuta="EUR" datum="' + ANCHOR_DATE + '">'
         + money(x.sidrena_cijena) + "</sidrena_cijena>"]),
    "  </stavka>",
  ].join("\n")).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!-- Cjenik ugostiteljskog objekta. Cijene su u eurima, PDV uracunat.",
    '     "sidrena_cijena" je redovna cijena stavke na dan ' + ANCHOR_DATE + ". -->",
    "<cjenik " + attrs + ' valuta="EUR" pdv_ukljucen="da" datum_objave="' + today + '"',
    '        datum_sidrene_cijene="' + ANCHOR_DATE + '" broj_stavki="' + r.length + '"',
    '        sazetak="' + digest(r) + '">',
    body,
    "</cjenik>",
    "",
  ].join("\n");
}

const COLS = ["sifra", "naziv", "proizvodjac", "skupina", "kategorija", "mjera",
              "cijena", "sidrena_cijena"];
const cell = (v) => (v == null ? ""
  : /[";\r\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));

export function csv(r) {
  const head = ["sifra", "naziv", "proizvodjac", "skupina", "kategorija", "mjera",
                "cijena_eur", "sidrena_cijena_eur_" + ANCHOR_DATE].join(";");
  const lines = r.map((x) => COLS.map((c) =>
    cell(c === "cijena" || c === "sidrena_cijena" ? money(x[c]) : x[c])).join(";"));
  /* BOM and CRLF: this file is opened in Excel more often than it is parsed. */
  return "﻿" + [head, ...lines].join("\r\n") + "\r\n";
}

function indexHtml(archive, today) {
  const items = archive.map((d) =>
    "    <li><time>" + d + '</time> — <a href="cjenik-' + d + '.xml">XML</a> · '
    + '<a href="cjenik-' + d + '.csv">CSV</a></li>').join("\n");
  return `<!DOCTYPE html>
<html lang="hr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cjenik — Theatrium by Filho</title>
<style>
  body { margin:0; background:#161513; color:#e8e2d6; padding:2.5rem 1.25rem;
         font:16px/1.6 system-ui, -apple-system, sans-serif; }
  main { max-width:44rem; margin:0 auto; }
  h1 { font-weight:500; letter-spacing:.04em; margin:0 0 .3rem; }
  p.sub { color:#a89f8f; margin:0 0 2rem; }
  h2 { font-size:.95rem; letter-spacing:.1em; text-transform:uppercase;
       color:#c9a86a; margin:2rem 0 .6rem; }
  a { color:#c9a86a; }
  ul { list-style:none; padding:0; margin:0; }
  li { padding:.4rem 0; border-bottom:1px solid rgba(168,159,143,.18); }
  time { color:#a89f8f; font-variant-numeric:tabular-nums; }
  footer { color:#6f685c; font-size:.85rem; margin-top:2.5rem; }
</style>
</head>
<body>
<main>
  <h1>Cjenik</h1>
  <p class="sub">${esc(ISSUER.objekt)} · ${esc(ISSUER.adresa)}</p>

  <h2>Važeći cjenik</h2>
  <ul>
    <li><a href="cjenik.xml">cjenik.xml</a> — strojno čitljiv (XML)</li>
    <li><a href="cjenik.csv">cjenik.csv</a> — tablica (CSV, razdvojeno znakom ;)</li>
  </ul>

  <h2>Arhiva objava</h2>
  <ul>
${items}
  </ul>

  <footer>
    Cijene su u eurima, PDV uračunat. Uz svaku cijenu navedena je i sidrena
    cijena — redovna cijena te stavke na dan ${ANCHOR_DATE}. Nova se verzija
    objavljuje čim se cjenik promijeni, a svaka objava ostaje dostupna najmanje
    30 dana. Zadnja objava: ${today}.
    <br>Vinska karta za goste: <a href="../index.html">theatrium.list.devinos.hr</a>
  </footer>
</main>
</body>
</html>
`;
}

function main() {
  const check = process.argv.includes("--check");
  const today = new Date().toISOString().slice(0, 10);
  const r = rows();
  const currentPath = path.join(OUT, "cjenik.xml");
  const current = fs.existsSync(currentPath) ? fs.readFileSync(currentPath, "utf8") : "";
  const was = (current.match(/sazetak="([^"]+)"/) || [])[1] || "";
  const now = digest(r);

  if (was === now) {
    console.log("cjenik unchanged (" + r.length + " stavki, " + now + ")");
    return 0;
  }
  console.log("cjenik changed: " + (was || "(none)") + " -> " + now + " (" + r.length + " stavki)");
  if (check) {
    console.log("--check: nothing written; run `npm run cjenik` and commit cjenik/");
    return 1;
  }

  fs.mkdirSync(OUT, { recursive: true });
  const x = xml(r, today), c = csv(r);
  for (const [name, text] of [["cjenik.xml", x], ["cjenik.csv", c],
                              ["cjenik-" + today + ".xml", x], ["cjenik-" + today + ".csv", c]])
    fs.writeFileSync(path.join(OUT, name), text);

  const archive = fs.readdirSync(OUT)
    .map((f) => (f.match(/^cjenik-(\d{4}-\d{2}-\d{2})\.xml$/) || [])[1])
    .filter(Boolean).sort().reverse();
  fs.writeFileSync(path.join(OUT, "index.html"), indexHtml(archive, today));
  console.log("wrote cjenik/ — " + archive.length + " objava u arhivi");
  return 0;
}

if (import.meta.url.startsWith("file:") && process.argv[1]
    && import.meta.url.endsWith(path.basename(process.argv[1]))) process.exit(main());

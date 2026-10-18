#!/usr/bin/env node
/* The demo /admin's data (owner, 2026-10-18): admin.html?demo shows the whole
 * staff side — the 86 board, Dodaj vino, Troškovi, Prihodi, Ponuda — to a
 * venue that is not Theatrium, with NOTHING real in it.
 *
 * The data is not written by hand. This fills a throwaway SQLite database
 * (web/schema.sql) with invented bills, receipts, companies and waiters, runs
 * the real /api handlers in web/functions against it, and saves what they
 * answer. So the demo can never drift from the real admin: the shapes are the
 * server's own, and a new field arrives in the demo the next time this runs.
 *
 * Nothing comes from Theatrium's books. The wine list, the menu, the till
 * map and the purchase map are public files in this repository (names and
 * sizes, no prices paid); every amount, every bill, every receipt and every
 * name below is invented, from a fixed seed, so two runs agree.
 *
 *   node scripts/make-demo.mjs <out-dir>     # writes <out-dir>/demo/*.json
 * Run by site-files.sh on every deploy, so the dates are always recent. */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(process.argv[2] || "_site", "demo");
const R = (p) => pathToFileURL(path.join(ROOT, p)).href;
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

/* ---------- a fixed seed ---------- */
let seed = 20261018;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const r2 = (x) => Math.round(x * 100) / 100;

/* ---------- the database, as D1 sees it ---------- */
const db = new DatabaseSync(":memory:");
db.exec(fs.readFileSync(path.join(ROOT, "web/schema.sql"), "utf8"));
for (const c of ["source TEXT", "dup_of TEXT", "due_date TEXT", "paid_at TEXT"]) {
  try { db.exec(`ALTER TABLE expense_receipts ADD COLUMN ${c}`); } catch { /* already there */ }
}
try { db.exec("ALTER TABLE sales_bills ADD COLUMN h TEXT"); } catch { /* already there */ }
const D1 = { prepare(sql) { const st = db.prepare(sql); let a = []; const o = {
  bind(...x) { a = x.map((v) => (v === undefined ? null : v)); return o; },
  all: async () => ({ results: st.all(...a) }), first: async () => st.get(...a) ?? null, run: async () => ({ meta: { changes: st.run(...a).changes } }) };
  return o; }, batch: async (xs) => Promise.all(xs.map((x) => x.run())) };
const STAFF = "demo-staff-key";
const env = { DB: D1, STAFF_KEY: STAFF, WINE_INTAKE_ENABLED: "1" };
/* the server reads the list and the till map from the wine list's site: here, the files */
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const m = String(u).match(/\/(data\/till-map\.json|lists\/theatrium\.json|library\/wines\.json)/);
  if (m) return new Response(fs.readFileSync(path.join(ROOT, m[1]), "utf8"), { headers: { "content-type": "application/json" } });
  if (/api\.github\.com|ntfy|alerts/.test(String(u))) return new Response("{}", { status: 204 });
  return realFetch(u, o);
};

/* ---------- what the venue sells: the public list and menu ---------- */
const lib = read("library/wines.json").wines, list = read("lists/theatrium.json"), menu = read("data/menu.json");
const till = read("data/till-map.json").articles, buy = read("data/buy-map.json").articles;
const listing = new Map();       /* ref|glass → {price, cat, country} */
for (const sec of list.sections) for (const c of sec.categories) for (const g of c.groups) for (const it of g.items) {
  const w = lib[it.ref];
  if (!w || !w.insight || w.insight.kind || it.price == null) continue;
  const k = `${it.ref}|${sec.id === "glass" ? "g" : "b"}`;
  if (!listing.has(k)) listing.set(k, { price: it.price, cat: c.id, country: w.insight.country || "" });
}
const GRP = (cat, country, glass) => glass ? "Vina na čaše"
  : cat === "champagne" ? "Šampanjci" : cat === "sparkling" ? "Pjenušci" : cat === "dessert" ? "Desertna vina"
  : `${cat === "red" ? "Crvena" : cat === "rose" ? "Rosé" : "Bijela"} vina ${["HR", "SI"].includes(country) ? "HR/SLO" : ["DE", "AT"].includes(country) ? "DE/AUT" : country === "FR" ? "FRA" : "ITA/ES"}`;
const wines = Object.entries(till).filter(([, a]) => a.ref && !a.ask && listing.has(`${a.ref}|${a.vol <= 0.15 ? "g" : "b"}`))
  .map(([name, a]) => { const l = listing.get(`${a.ref}|${a.vol <= 0.15 ? "g" : "b"}`); return { name, glass: a.vol <= 0.15, price: l.price, grp: GRP(l.cat, l.country, a.vol <= 0.15) }; })
  .filter((w) => w.price < 400);
const glassW = wines.filter((w) => w.glass), bottleW = wines.filter((w) => !w.glass);
/* two till names nobody has mapped yet, so "Za povezati" has something to show */
const unmapped = [{ name: "DEMO VINARIJA, NOVO BIJELO 2024 0,75L", glass: false, price: 42, grp: "Bijela vina HR/SLO" },
  { name: "DEMO VINARIJA, NOVO BIJELO 2024 0,1L", glass: true, price: 7, grp: "Vina na čaše" }];
const COURSE = { starters: ["Predjela", [12, 19]], soups: ["Juhe", [8, 11]], mains: ["Glavna jela", [24, 42]], desserts: ["Deserti", [9, 13]] };
const dishes = menu.dishes.filter((d) => !d.off && COURSE[d.course]).map((d) => ({ name: d.name.hr.toUpperCase(), grp: COURSE[d.course][0], price: int(...COURSE[d.course][1]) }));
const by = (g) => dishes.filter((d) => d.grp === g);
const H = "H (HRANA IZLAZ 13%)", P = "P (PIĆE IZLAZ)";
const DRINKS = [["ESPRESSO", "Kava", 2.5], ["CAPPUCCINO", "Kava", 3], ["JAMNICA 0,75L", "Voda", 5], ["ACQUA PANNA 0,75L", "Voda", 6],
  ["CEDEVITA", "Sokovi", 4], ["SOK OD NARANČE", "Sokovi", 4.5]];
const SPIRITS = [["APEROL SPRITZ", "Kokteli", 9], ["NEGRONI", "Kokteli", 11], ["GIN TONIK", "Kokteli", 10], ["TRAVARICA", "Rakije", 5], ["GRAPPA", "Rakije", 7]];

/* ---------- people, invented ---------- */
const WAITERS = ["Ana Kovač", "Marko Babić", "Ivana Perić", "Luka Novak", "Petra Jurić"];
const COMPANIES = [["Lipa Savjetovanje d.o.o.", 9], ["Kvadrat Softver d.o.o.", 7], ["Sjeverni Most d.d.", 5], ["Studio Okvir d.o.o.", 4],
  ["Zlatna Grana Konzalting d.o.o.", 3], ["Plava Linija Logistika d.o.o.", 3], ["Atrij Pravo d.o.o.", 2], ["Mozaik Mediji d.o.o.", 2],
  ["Bijeli Toranj Investicije d.o.o.", 1], ["Lanterna Događaji d.o.o.", 1], ["Hrast Inženjering d.o.o.", 1], ["Vrh Analitika d.o.o.", 1]]
  .map(([n, w], i) => ({ name: n, oib: String(10000000000 + i * 7919).padStart(11, "0").replace(/^1/, "0"), w }));

/* ---------- 13 months of bills ---------- */
const today = new Date(); today.setUTCHours(12, 0, 0, 0);
const iso = (d) => d.toISOString().slice(0, 10);
const insB = db.prepare("INSERT INTO sales_bills (id,no,day,at,pay,waiter,cust,oib,total,vat,pnp,jir) VALUES (?,?,?,?,?,?,?,?,?,?,0,'')");
const insL = db.prepare("INSERT INTO sales_lines (bill_id,n,code,name,grp,tax,qty,price,disc,net,total) VALUES (?,?,'',?,?,?,?,?,?,?,?)");
let billNo = 0;
db.exec("BEGIN");
for (let back = 400; back >= 0; back--) {
  const d = new Date(today - back * 86400000), day = iso(d), wd = d.getUTCDay();
  if (wd === 0) continue;                                      /* closed on Sunday */
  const season = 1 + 0.25 * Math.cos(((d.getUTCMonth() - 11) / 12) * 2 * Math.PI);   /* December busiest */
  const parts = wd === 6 ? [["13", 9]] : [["13", 7], ["20", wd >= 4 ? 10 : 7]];
  /* an event: a company books the house for an evening, now and then */
  const event = back % 23 === 5 && wd !== 6 ? COMPANIES[9 + (back % 3)] : null;
  for (const [hh, base] of parts) {
    const n = Math.round(base * season * (0.75 + rnd() * 0.5)) + (back === 0 && hh === "20" ? -99 : 0);
    for (let j = 0; j < n; j++) {
      const lunch = hh === "13", g = lunch ? int(1, 4) : int(2, 6);
      const comp = !event && rnd() < 0.07 ? (() => { let t = rnd() * COMPANIES.reduce((a, c) => a + c.w, 0); return COMPANIES.find((c) => (t -= c.w) <= 0) || COMPANIES[0]; })() : null;
      const lines = [["COUVERT", "Couvert", H, g, 3]];
      for (let k = 0; k < g; k++) {
        if (rnd() < (lunch ? 0.35 : 0.6)) { const s = pick(by(rnd() < 0.3 && by("Juhe").length ? "Juhe" : "Predjela")); lines.push([s.name, s.grp, H, 1, s.price]); }
        const m = pick(by("Glavna jela")); lines.push([m.name, m.grp, H, 1, m.price]);
        if (rnd() < (lunch ? 0.2 : 0.4)) { const s = pick(by("Deserti")); lines.push([s.name, s.grp, H, 1, s.price]); }
        if (rnd() < 0.5) { const x = pick(DRINKS); lines.push([x[0], x[1], P, 1, x[2]]); }
        if (rnd() < 0.25) { const x = pick(SPIRITS); lines.push([x[0], x[1], P, 1, x[2]]); }
        if (rnd() < (lunch ? 0.45 : 0.55)) { const w = back < 20 && rnd() < 0.03 ? unmapped[1] : pick(glassW); lines.push([w.name, w.grp, P, int(1, 2), w.price]); }
      }
      if (g >= 2 && rnd() < (lunch ? 0.3 : 0.55)) { const w = back < 20 && rnd() < 0.03 ? unmapped[0] : pick(bottleW); lines.push([w.name, w.grp, P, 1, w.price]); }
      const id = `${day.slice(0, 4)}/${++billNo}/P1/1`, mm = String(int(lunch ? 0 : 0, 59)).padStart(2, "0");
      const at = `${day}T${lunch ? String(int(12, 15)) : String(int(19, 23))}:${mm}:00`;
      const total = r2(lines.reduce((a, l) => a + l[3] * l[4], 0));
      const vat = r2(lines.reduce((a, l) => a + l[3] * l[4] * (l[2] === H ? 0.13 / 1.13 : 0.2), 0));
      insB.run(id, `${billNo}/P1/1`, day, at, comp ? "Virman" : pick(["Visa", "Visa", "Master", "Master", "Gotovina", "Amex"]),
        pick(WAITERS), comp ? comp.name : null, comp ? comp.oib : null, total, vat);
      lines.forEach((l, i) => insL.run(id, i, l[0], l[1], l[2], l[3], l[4], 0, r2(l[3] * l[4] / (l[2] === H ? 1.13 : 1.25)), r2(l[3] * l[4])));
    }
  }
  if (event) {
    const id = `${day.slice(0, 4)}/${++billNo}/P1/1`, g = int(18, 30), m = 65;
    const total = g * (3 + m + 14);
    insB.run(id, `${billNo}/P1/1`, day, `${day}T21:30:00`, "Virman", WAITERS[0], event.name, event.oib, total, r2(total * 0.16));
    insL.run(id, 0, "COUVERT", "Couvert", H, g, 3, 0, r2(g * 3 / 1.13), g * 3);
    insL.run(id, 1, "REPERTOIRE MENU", "Repertoire", H, g, m, 0, r2(g * m / 1.13), g * m);
    insL.run(id, 2, pick(bottleW).name, "Bijela vina HR/SLO", P, Math.ceil(g / 4), 14 * 4, 0, r2(g * 14 / 1.25), g * 14);
  }
}
db.exec("COMMIT");
const nowIso = new Date().toISOString();
db.prepare("INSERT OR REPLACE INTO sales_state (k, v) VALUES ('last_ok', ?), ('last_range', ?), ('error', '')").run(nowIso, `${iso(new Date(today - 3 * 86400000))}..${iso(today)}`);
db.prepare("INSERT OR REPLACE INTO sales_companies (oib, note, updated_at) VALUES (?, ?, ?)").run(COMPANIES[0].oib, "Zovu za četvrtak; vole Pošip i kratki ručak.", nowIso);

/* ---------- 4 months of receipts, invented vendors and prices ---------- */
const VENDORS = [
  ["Mesnica Primjer d.o.o.", "meso", [["Junetina, but", "kg", 22], ["Svinjski file", "kg", 11], ["Pileća prsa", "kg", 8.5], ["Teleći obrazi", "kg", 18]], 3],
  ["Ribarnica Primjer", "riba", [["Brancin", "kg", 19], ["Hobotnica", "kg", 16], ["Kozice", "kg", 24]], 2],
  ["Tržnica Primjer obrt", "povrce", [["Rajčica", "kg", 2.4], ["Krumpir", "kg", 0.9], ["Šparoge", "kg", 9], ["Začinsko bilje", "kom", 1.5]], 3],
  ["Mljekara Primjer d.o.o.", "mlijecno", [["Vrhnje za kuhanje", "l", 3.1], ["Maslac", "kg", 9.8], ["Parmigiano", "kg", 21]], 1],
  ["Pekara Primjer", "pekara", [["Kruh od kiselog tijesta", "kom", 1.9], ["Brioche", "kom", 1.2]], 4],
  ["Veletrgovina Primjer d.o.o.", "suha", [["Maslinovo ulje", "l", 11], ["Riža za rižoto", "kg", 3.6], ["Brašno", "kg", 0.8]], 1],
  ["Napitci Primjer d.o.o.", "pivo_sokovi", [["Mineralna voda 0,75", "kom", 0.9], ["Sok od naranče", "l", 2.1]], 1],
  ["Kava Primjer d.o.o.", "kava", [["Kava u zrnu", "kg", 19]], 0.3],
  ["Čistoća Primjer d.o.o.", "ciscenje", [["Deterdžent za suđe", "l", 4], ["Ubrusi", "pak", 6]], 0.3],
];
const wineBuys = Object.entries(buy).filter(([, a]) => a.ref && !a.ask && listing.has(`${a.ref}|b`)).slice(0, 60);
const insR = db.prepare(`INSERT INTO expense_receipts (id, created_at, updated_at, created_by, status, runs, vendor, vendor_oib, doc_date, doc_no,
  total, vat, payment, items, note, error, source, dup_of, due_date, paid_at) VALUES (?,?,?,?, 'done', 1, ?,?,?,?, ?,?,?,?, '', '', ?, '', ?, ?)`);
let rid = 0;
const receipt = (day, vendor, oib, cat, lines, pay, source) => {
  /* price is with PDV, as on a receipt; an e-invoice line also carries its own net figures (doc_*) */
  const items = lines.map(([name, unit, price, qty, key, category]) => { const vr = (category || cat) === "vino" ? 25 : 13, net = r2(price / (1 + vr / 100));
    return { name, key: key || name, qty, unit, unit_price: price, total: r2(qty * price), category: category || cat, vat_rate: vr,
      doc_qty: qty, doc_unit: unit, doc_price: net, doc_total: r2(qty * net) }; });
  const total = r2(items.reduce((a, i) => a + i.total, 0)), id = `${day.replace(/-/g, "")}-demo${String(++rid).padStart(6, "0")}`;
  const due = pay === "virman" ? iso(new Date(Date.parse(day) + 15 * 86400000)) : "";
  const paid = pay !== "virman" ? "" : Date.parse(due) < Date.parse(iso(today)) - 3 * 86400000 || rnd() < 0.5 ? due : "";
  insR.run(id, `${day}T09:${String(int(0, 59)).padStart(2, "0")}:00Z`, nowIso, source === "mer" ? "MER" : "Demo", vendor, oib, day, `${int(100, 9999)}-1-1`,
    total, r2(total * (cat === "vino" ? 0.2 : 0.115)), pay, JSON.stringify(items), source, due, paid);
};
for (let back = 120; back >= 0; back--) {
  const d = new Date(today - back * 86400000), day = iso(d);
  if (d.getUTCDay() === 0) continue;
  for (const [vendor, cat, goods, perWeek] of VENDORS) {
    if (rnd() > perWeek / 6) continue;
    const lines = goods.filter(() => rnd() < 0.7).map(([n, u, p]) => [n, u, r2(p * (0.95 + rnd() * 0.1)), u === "kom" ? int(10, 40) : int(2, 15)]);
    if (lines.length) receipt(day, vendor, `0${int(1000000000, 9999999999)}`, cat, lines, cat === "meso" || cat === "riba" ? "virman" : pick(["kartica", "gotovina"]), cat === "meso" ? "mer" : "foto");
  }
  if (d.getUTCDay() === 2) {    /* wine, weekly, by e-invoice: the purchase map's names, invented prices */
    const lines = [0, 1, 2, 3].map(() => pick(wineBuys)).map(([key, a]) => [key, "kom", r2(listing.get(`${a.ref}|b`).price * (0.27 + rnd() * 0.08)), int(3, 12), key, "vino"]);
    receipt(day, "Vinoteka Primjer d.o.o.", "09876543210", "vino", lines, "virman", "mer");
  }
  if (d.getUTCDate() === 10) {  /* salaries, rent and utilities, monthly */
    receipt(day, "Plaće — obračun", "", "place", [["Plaće zaposlenika (bruto 2)", "kom", 26500, 1]], "virman", "foto");
    receipt(day, "Najam Primjer d.o.o.", "01234567890", "rezije", [["Najam prostora", "kom", 4200, 1]], "virman", "foto");
    receipt(day, "Elektra Primjer", "01112223334", "rezije", [["Električna energija", "kom", int(900, 1400), 1]], "virman", "mer");
  }
}
/* one receipt being read right now, so the queue is visible */
db.prepare(`INSERT INTO expense_receipts (id, created_at, updated_at, created_by, status, runs, items, source) VALUES (?, ?, ?, 'Demo', 'working', 1, '[]', 'foto')`)
  .run(`${iso(today).replace(/-/g, "")}-demo999999`, nowIso, nowIso);
db.prepare("INSERT INTO expense_photos (receipt_id, n, mime, bytes, created_at) SELECT id, 1, 'image/svg+xml', x'00', created_at FROM expense_receipts WHERE source = 'foto'").run();
db.prepare("INSERT OR REPLACE INTO expense_mer_state (k, v) VALUES ('last_ok', ?), ('imported', '64')").run(nowIso);

/* ---------- Dodaj vino: one card ready to publish, one waiting for an answer ---------- */
const demoWine = lib["petrac--enigma-2019"] || Object.values(lib).find((w) => w.insight && !w.insight.kind);
const result = { draft: { wine: { ...demoWine, name: demoWine.name.replace(/\d{4}/, "2020") }, listings: [] }, glass: "bordeaux",
  placement: "Crna vina na bocu, među hrvatskim crnima.", gaps: ["Alkohol za berbu 2020 nije nigdje objavljen — pročitajte s etikete."],
  pairings_hr: [], notes: "", flags: [], novo: true, novo_reason: "", producer_status: "known", producer_known: true, producer_note: "",
  parker: { status: "none" } };
const insW = db.prepare(`INSERT INTO wine_requests (id, created_at, updated_at, status, price_bottle, price_glass, runs, questions, answers, result, branch, error, usage)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?, '[]', ?, ?, '', '{}')`);
insW.run(`${iso(today).replace(/-/g, "")}-demo00000001`, nowIso, nowIso, "ready", 85, 12, "[]", JSON.stringify(result), "wine/demo");
insW.run(`${iso(today).replace(/-/g, "")}-demo00000002`, nowIso, nowIso, "needs_info", 60, null,
  JSON.stringify(["Je li ovo boca od 0,75 l ili magnum (1,5 l)? Na etiketi se ne vidi.", "Koliko alkohola piše na etiketi?"]), null, "");

/* ---------- ask the real handlers ---------- */
const get = async (mod, url, extra = {}) => {
  const m = await import(R(mod));
  const res = await m.onRequestGet({ request: new Request(url, { headers: { authorization: `Bearer ${STAFF}`, origin: "https://theatrium.list.devinos.hr" } }), env, ...extra });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
  return res.json();
};
fs.mkdirSync(OUT, { recursive: true });
const write = (name, o) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(o));
const B = "https://theatrium.devinos.hr/api";
const all = [];
for (let off = 0; ; off += 150) {
  const p = await get("web/functions/api/troskovi/index.js", `${B}/troskovi?offset=${off}&limit=150`);
  all.push(...p.items);
  if (!p.more) break;
}
const head = await get("web/functions/api/troskovi/index.js", `${B}/troskovi?limit=1`);
write("troskovi.json", { items: all, limits: head.limits, mer: { state: "ok", last_ok: nowIso, last_try: nowIso, error: "", imported: 64 } });
const months = [];
for (let i = 13; i >= 0; i--) { const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1)); months.push(d.toISOString().slice(0, 7)); }
const prihodi = {};
for (const m of months) prihodi[m] = await get("web/functions/api/prihodi/index.js", `${B}/prihodi?mjesec=${m}`);
write("prihodi.json", prihodi);
write("tvrtke.json", await get("web/functions/api/prihodi/tvrtke.js", `${B}/prihodi/tvrtke`));
write("vina.json", await get("web/functions/api/vina/index.js", `${B}/vina`));
write("povijest.json", await get("web/functions/api/troskovi/povijest.js", `${B}/troskovi/povijest`).catch(() => ({ events: [] })));
/* the purchase map (names and sizes, no prices) is not on the site; the demo needs it for Marža po vinu */
fs.copyFileSync(path.join(ROOT, "data/buy-map.json"), path.join(OUT, "buy-map.json"));
const sizes = fs.readdirSync(OUT).map((f) => `${f} ${Math.round(fs.statSync(path.join(OUT, f)).size / 1024)} kB`);
console.log(`demo: ${billNo} bills, ${rid} receipts → ${OUT}\n  ${sizes.join("\n  ")}`);

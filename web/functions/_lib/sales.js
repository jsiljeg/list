/* Prihodi — every bill the till issued, from Remaris (owner, 2026-10-13: "the
 * counterpart of Kamo idu novci … income and expenses at the same admin
 * place"). Design: web/EXPENSES.md, "Prihodi".
 *
 * Remaris has no API. Its back office exports "Excel podaci → Računi" on
 * request, and a scheduled run in the private theatrium-troskovi repo does
 * exactly that every morning (remaris/sync.py), reads the workbook and posts
 * the bills here with EXPENSE_WORKER_KEY. Nothing is read by a model.
 *
 * A bill is keyed by year + fiscal number ("2026/4179/P3/1"): the number
 * restarts every January. Each import covers whole accounting days and is the
 * truth for them — a bill gone from Remaris since (never, unless it was a
 * test) is deleted, a changed one (payment method, customer) is replaced. A
 * storno is its own bill with a negative total, so sums are right as they are.
 *
 * Writes are the scarce thing (2026-10-13: the January–October backfill used
 * 85% of the free plan's 100.000 rows a day — D1 counts every index entry). A
 * bill is therefore written only when its content hash `h` differs from the
 * stored one; the morning run re-sends 4 days and writes only what changed. */
import { reply, isStaffAsync } from "./wines.js";
import { wineListOrigin } from "./daily.js";
import { isExpenseWorker } from "./expenses.js";

export { reply, isStaffAsync, isExpenseWorker };

const num = (v) => (typeof v === "number" && isFinite(v) ? Math.round(v * 10000) / 10000 : 0);
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const isDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const isTime = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(d);

/* One bill as remaris/sync.py sends it → the row, or null when it is not one. */
export function cleanBill(b) {
  if (!b || typeof b !== "object") return null;
  const no = str(b.no, 40);
  if (!/^\d+\/[\w-]+\/\d+$/.test(no) || !isDay(b.day) || !isTime(b.at)) return null;
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 400).map((l) => ({
    code: str(l.code, 20), name: str(l.name, 120), grp: str(l.grp, 60), tax: str(l.tax, 40),
    qty: num(l.qty), price: num(l.price), disc: num(l.disc), net: num(l.net), total: num(l.total),
  }));
  return {
    id: `${b.at.slice(0, 4)}/${no}`, no, day: b.day, at: b.at.slice(0, 19),
    pay: str(b.pay, 40), waiter: str(b.waiter, 80), cust: str(b.cust, 120), oib: str(b.oib, 20),
    total: num(b.total), vat: num(b.vat), pnp: num(b.pnp), jir: str(b.jir, 60), lines,
  };
}

async function hashOf(r) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(r)));
  return [...new Uint8Array(d).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* Bills in, inside one D1 batch. `from`..`to` is the range the export covered. */
export async function importBills(env, { from, to, bills, last }) {
  const rows = bills.map(cleanBill).filter(Boolean);
  for (const r of rows) r.h = await hashOf(r);
  const have = new Map();
  if (rows.length) {
    const { results } = await env.DB.prepare(`SELECT id, h FROM sales_bills WHERE id IN (${rows.map((_, i) => "?" + (i + 1)).join(",")})`)
      .bind(...rows.map((r) => r.id)).all();
    for (const x of results || []) have.set(x.id, x.h);
  }
  const st = [];
  let same = 0;
  for (const r of rows) {
    if (have.get(r.id) === r.h) { same += 1; continue; }
    st.push(env.DB.prepare("DELETE FROM sales_lines WHERE bill_id = ?1").bind(r.id));
    st.push(env.DB.prepare(
      `INSERT OR REPLACE INTO sales_bills (id, no, day, at, pay, waiter, cust, oib, total, vat, pnp, jir, h)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`)
      .bind(r.id, r.no, r.day, r.at, r.pay, r.waiter, r.cust || null, r.oib || null, r.total, r.vat, r.pnp, r.jir || null, r.h));
    r.lines.forEach((l, n) => st.push(env.DB.prepare(
      `INSERT INTO sales_lines (bill_id, n, code, name, grp, tax, qty, price, disc, net, total)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`)
      .bind(r.id, n, l.code, l.name, l.grp, l.tax, l.qty, l.price, l.disc, l.net, l.total)));
  }
  let removed = 0;
  if (last && Array.isArray(last.keep)) {
    /* whatever the range held that this export no longer has */
    const keep = new Set(last.keep.map(String));
    const { results } = await env.DB.prepare("SELECT id FROM sales_bills WHERE day BETWEEN ?1 AND ?2").bind(from, to).all();
    for (const { id } of results || []) {
      if (keep.has(id)) continue;
      removed += 1;
      st.push(env.DB.prepare("DELETE FROM sales_lines WHERE bill_id = ?1").bind(id));
      st.push(env.DB.prepare("DELETE FROM sales_bills WHERE id = ?1").bind(id));
    }
    st.push(env.DB.prepare("INSERT OR REPLACE INTO sales_state (k, v) VALUES ('last_ok', ?1), ('last_range', ?2)")
      .bind(new Date().toISOString(), `${from}..${to}`));
  }
  for (let i = 0; i < st.length; i += 400) await env.DB.batch(st.slice(i, i + 400));
  return { bills: rows.length, written: rows.length - same, rejected: bills.length - rows.length, removed };
}

export async function setState(env, k, v) {
  await env.DB.prepare("INSERT OR REPLACE INTO sales_state (k, v) VALUES (?1, ?2)").bind(k, v).run();
}

/* One month for /admin, summed by the database. */
export async function monthSummary(env, month) {
  const lo = `${month}-01`, hi = `${month}-31`;
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).all().then((r) => r.results || []);
  const [months, days, pays, groups, taxes, custs, state] = await Promise.all([
    q(`SELECT substr(day, 1, 7) AS m, COUNT(*) AS n, SUM(total) AS total, SUM(vat) AS vat
       FROM sales_bills GROUP BY m ORDER BY m DESC LIMIT 24`),
    q(`SELECT day, COUNT(*) AS n, SUM(total) AS total FROM sales_bills WHERE day BETWEEN ?1 AND ?2 GROUP BY day ORDER BY day`, lo, hi),
    q(`SELECT pay, COUNT(*) AS n, SUM(total) AS total FROM sales_bills WHERE day BETWEEN ?1 AND ?2 GROUP BY pay ORDER BY total DESC`, lo, hi),
    q(`SELECT l.grp AS grp, l.tax AS tax, SUM(l.total) AS total, SUM(l.net) AS net, SUM(l.qty) AS qty FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id
       WHERE b.day BETWEEN ?1 AND ?2 GROUP BY l.grp, l.tax ORDER BY total DESC`, lo, hi),
    q(`SELECT l.tax AS tax, SUM(l.total) AS total, SUM(l.net) AS net FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id
       WHERE b.day BETWEEN ?1 AND ?2 GROUP BY l.tax ORDER BY total DESC`, lo, hi),
    q(`SELECT cust, oib, COUNT(*) AS n, SUM(total) AS total, SUM(CASE WHEN pay = 'Virman' THEN total ELSE 0 END) AS virman
       FROM sales_bills WHERE day BETWEEN ?1 AND ?2 AND cust IS NOT NULL GROUP BY oib ORDER BY total DESC LIMIT 30`, lo, hi),
    q("SELECT k, v FROM sales_state"),
  ]);
  const more = await monthDetail(env, lo, hi);
  return { month, months, days, pays, groups, taxes, custs, ...more, state: Object.fromEntries(state.map((s) => [s.k, s.v])) };
}

/* What the owner can act on (2026-10-14: "useful data … to drive him to the
   right direction"): every article sold, the shape of the week and the day,
   what leaked (storno, discounts, free items), and each waiter's bills and
   wine. Summed here so the browser only ranks it. A storno bill counts against
   the waiter who issued the original (Remaris puts it on them). */
export async function monthDetail(env, lo, hi) {
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).all().then((r) => r.results || []);
  const WINE = "(l.grp LIKE '%vin%' OR l.grp LIKE '%ampanj%' OR l.grp LIKE '%jenu%')";
  const [items, weekdays, dayparts, leaks, waiters] = await Promise.all([
    q(`SELECT l.name AS name, l.grp AS grp, l.tax AS tax, SUM(l.qty) AS qty, SUM(l.total) AS total, SUM(l.net) AS net
       FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id WHERE b.day BETWEEN ?1 AND ?2
       GROUP BY l.name ORDER BY total DESC LIMIT 400`, lo, hi),
    q(`SELECT CAST(strftime('%w', day) AS INTEGER) AS wd, COUNT(DISTINCT day) AS days, COUNT(*) AS n, SUM(total) AS total
       FROM sales_bills WHERE day BETWEEN ?1 AND ?2 GROUP BY wd`, lo, hi),
    q(`SELECT CASE WHEN substr(at, 12, 2) < '16' THEN 'rucak' ELSE 'vecera' END AS part, COUNT(*) AS n, SUM(total) AS total
       FROM sales_bills WHERE day BETWEEN ?1 AND ?2 AND total > 0 GROUP BY part`, lo, hi),
    q(`SELECT b.waiter AS waiter,
         SUM(CASE WHEN b.total < 0 AND l.n = 0 THEN 1 ELSE 0 END) AS storno_n,
         SUM(CASE WHEN b.total < 0 THEN -l.total ELSE 0 END) AS storno,
         SUM(CASE WHEN b.total >= 0 THEN l.disc ELSE 0 END) AS disc,
         SUM(CASE WHEN b.total >= 0 AND l.qty > 0 AND l.price > 0 AND l.total = 0 THEN l.qty ELSE 0 END) AS free_n,
         SUM(CASE WHEN b.total >= 0 AND l.qty > 0 AND l.price > 0 AND l.total = 0 THEN l.qty * l.price ELSE 0 END) AS free
       FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id WHERE b.day BETWEEN ?1 AND ?2 GROUP BY b.waiter`, lo, hi),
    q(`SELECT b.waiter AS waiter, COUNT(DISTINCT b.id) AS n, SUM(l.total) AS total,
         SUM(CASE WHEN ${WINE} THEN l.total ELSE 0 END) AS wine,
         COUNT(DISTINCT CASE WHEN ${WINE} THEN b.id END) AS wine_bills
       FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id WHERE b.day BETWEEN ?1 AND ?2 AND b.total > 0
         AND b.id NOT IN (${OWN_TABLE}) GROUP BY b.waiter`, lo, hi),
  ]);
  const [st, guests] = await Promise.all([staffData(env, lo, hi), guestData(env, lo, hi)]);
  return { items, weekdays, dayparts, leaks, waiters, staff: st.waiters, staffBy: st.catBy, ownTable: st.ownTable, guests };
}

/* Any span of days, not only a month (2026-10-14: "how did the past two
   daily offers go" is a question about one evening against its weekdays). */
export async function rangeSummary(env, lo, hi) {
  const { results } = await env.DB.prepare(
    "SELECT day, COUNT(*) AS n, SUM(total) AS total FROM sales_bills WHERE day BETWEEN ?1 AND ?2 GROUP BY day ORDER BY day").bind(lo, hi).all();
  return { from: lo, to: hi, days: results || [], ...(await monthDetail(env, lo, hi)) };
}

/* ---------- Tvrtke (owner, 2026-10-14: "proactive approach to companies from
   the invoices … custom tailored approach for each of these companies when
   they arrive … habits directly in company info") ----------
   Every company that has had a bill made out to it, over everything the till
   holds: how often, how many, when, how much per guest, what they eat and
   drink, and what they never take; the house's own rates beside them so the
   advice is "less than the others", never a guess. Staff keep a note per
   company (sales_companies). */
const LINE_CAT = (cat) => `CASE WHEN l.tax LIKE 'H%' AND l.grp LIKE '%esert%' THEN 'desert' WHEN l.tax LIKE 'H%' THEN NULL ELSE ${cat} END`;
export async function companyData(env) {
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).all().then((r) => r.results || []);
  const { sql: CAT } = await staffCatFor(env);
  const HAS = "b.oib IS NOT NULL AND b.oib <> '' AND b.total > 0";
  const lo = "0000-00-00", hi = "9999-99-99";
  const [bills, lines, cats, house, houseCats, notes, guests] = await Promise.all([
    q(`SELECT b.oib AS oib, MAX(b.cust) AS cust, COUNT(*) AS n, SUM(b.total) AS total, MIN(b.day) AS first, MAX(b.day) AS last,
         COUNT(DISTINCT b.day) AS days, SUM(CASE WHEN ${PART} = 'rucak' THEN 1 ELSE 0 END) AS lunch,
         SUM(CASE WHEN b.pay = 'Virman' THEN 1 ELSE 0 END) AS virman,
         GROUP_CONCAT(CAST(strftime('%w', b.day) AS INTEGER)) AS wds
       FROM sales_bills b WHERE ${HAS} GROUP BY b.oib`),
    q(`SELECT b.oib AS oib, l.name AS name, l.grp AS grp, l.tax AS tax, SUM(l.qty) AS q, SUM(l.total) AS t
       FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id WHERE ${HAS} GROUP BY b.oib, l.name`),
    q(`SELECT b.oib AS oib, ${LINE_CAT(CAT)} AS c, COUNT(DISTINCT b.id) AS n FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id
       WHERE ${HAS} GROUP BY b.oib, c HAVING c IS NOT NULL`),
    q(`SELECT COUNT(DISTINCT b.id) AS n, SUM(CASE WHEN l.tax LIKE 'H%' THEN l.total ELSE 0 END) AS food,
         SUM(CASE WHEN ${WINE_SQL} THEN l.total ELSE 0 END) AS wine, SUM(l.total) AS total
       FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id WHERE b.total > 0 AND b.day >= date('now', '-365 day')`),
    q(`SELECT ${LINE_CAT(CAT)} AS c, COUNT(DISTINCT b.id) AS n FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id
       WHERE b.total > 0 AND b.day >= date('now', '-365 day') GROUP BY c HAVING c IS NOT NULL`),
    q("SELECT oib, note, updated_at FROM sales_companies").catch(() => []),
    guestData(env, lo, hi),
  ]);
  const g = guests.reduce((a, r) => ({ guests: a.guests + (r.guests || 0), total: a.total + (r.total || 0) }), { guests: 0, total: 0 });
  const h = house[0] || {};
  const base = {
    perGuest: g.guests ? g.total / g.guests : 0,
    wineShare: h.total ? h.wine / h.total : 0,
    rate: Object.fromEntries(houseCats.map((r) => [r.c, h.n ? r.n / h.n : 0])),
  };
  const noteBy = new Map(notes.map((x) => [x.oib, x]));
  const out = bills.map((b) => {
    const ls = lines.filter((l) => l.oib === b.oib);
    const sum = (f) => ls.filter(f).reduce((a, l) => a + (l.t || 0), 0);
    const cnt = (re) => ls.filter((l) => re.test(l.name || "")).reduce((a, l) => a + (l.q || 0), 0);
    const menuN = cnt(/repertoire|\bmen[iu]\b/i), guestsN = Math.max(cnt(/couvert/i), menuN);
    const food = sum((l) => /^H/.test(l.tax || "")), wine = sum((l) => /vin|ampanj|jenu/i.test(l.grp || ""));
    const top = (f) => ls.filter(f).filter((l) => !/couvert/i.test(l.name || "")).sort((a, c) => c.t - a.t).slice(0, 4).map((l) => ({ name: l.name, q: l.q, t: l.t }));
    const wd = {};
    for (const d of String(b.wds || "").split(",")) if (d !== "") wd[d] = (wd[d] || 0) + 1;
    const p = {
      oib: b.oib, cust: b.cust, n: b.n, days: b.days, total: b.total, first: b.first, last: b.last,
      lunch: b.n ? b.lunch / b.n : 0, virman: b.n ? b.virman / b.n : 0,
      guests: guestsN, menu: guestsN ? Math.min(1, menuN / guestsN) : 0, perGuest: guestsN ? b.total / guestsN : 0, size: guestsN && b.n ? guestsN / b.n : 0,
      food, wine, wineShare: b.total ? wine / b.total : 0,
      rate: Object.fromEntries(cats.filter((c) => c.oib === b.oib).map((c) => [c.c, b.n ? c.n / b.n : 0])),
      topFood: top((l) => /^H/.test(l.tax || "")), topWine: top((l) => /vin|ampanj|jenu/i.test(l.grp || "")),
      weekday: Object.entries(wd).sort((a, c) => c[1] - a[1])[0]?.[0] ?? null,
      note: noteBy.get(b.oib)?.note || "", noteAt: noteBy.get(b.oib)?.updated_at || null,
    };
    p.event = isEvent(p);
    p.advice = companyAdvice(p, base, new Date().toISOString().slice(0, 10));
    return p;
  }).sort((a, c) => c.total - a.total);
  return { house: base, companies: out };
}

/* What to do with a company, from its numbers against the house's. Croatian,
   for Filho and the waiters; each line says why. Pure. */
export const isEvent = (p) => p.days <= 2 && p.size >= 15;
const WEEKDAY = ["nedjeljom", "ponedjeljkom", "utorkom", "srijedom", "četvrtkom", "petkom", "subotom"];
export function companyAdvice(p, house, today) {
  const out = [], pc = (x) => `${Math.round((x || 0) * 100)}%`;
  const eur = (x) => `${Math.round(x || 0)} €`;
  const ago = today && p.last ? Math.round((Date.parse(today) - Date.parse(p.last)) / 86400000) : 0;
  /* a company seen on one or two days with a big table is an event, not a
     habit (owner, 2026-10-14, on Sintagma Media: "probably an outlier and
     special event … not frequent and typical") */
  if (isEvent(p)) out.push(`Događaj, ne redovit gost: ${p.days} ${p.days === 1 ? "dan" : "dana"}, oko ${Math.round(p.size)} osoba za stolom. Vrijedi im se javiti za sljedeći događaj, ali ne mjeriti kao stalnu tvrtku.`);
  else if (p.days >= 3 && ago > 60) out.push(`Nisu bili ${ago} dana (zadnji put ${p.last.slice(8, 10)}. ${p.last.slice(5, 7)}.), a dolazili su ${p.days} puta: javite se s ponudom — prije prosinca posebno.`);
  if (p.virman >= 0.5) out.push("Plaća firma (virman): ponudite im božićni domjenak, poslovne ručkove na račun i poklon-bonove za klijente.");
  if (p.size >= 8 && !isEvent(p)) out.push(`Dolaze kao grupa (oko ${Math.round(p.size)} osoba): unaprijed dogovoren meni s vinskom pratnjom po osobi — lakše njima, sigurniji prihod nama.`);
  if (p.lunch >= 0.7 && p.n >= 2) out.push("Dolaze na ručak: brza usluga, čaša umjesto boce, poslovni ručak s čašom vina u cijeni.");
  else if (p.weekday != null && p.n >= 3) out.push(`Najčešće dolaze ${WEEKDAY[p.weekday]}.`);
  if (p.wineShare < house.wineShare * 0.7 && p.total >= 200) out.push(`Malo vina: ${pc(p.wineShare)} računa, kuća ${pc(house.wineShare)}. Na dolasku čaša pjenušca ili šampanjca, uz glavno jelo predložite bocu za stol.`);
  const low = (c) => house.rate[c] >= 0.05 && (p.rate[c] || 0) < house.rate[c] * 0.6 && p.n >= 2;
  if (low("aperitiv") && low("sampanjac") && low("pjenusac")) out.push(`Rijetko aperitiv (${pc((p.rate.aperitiv || 0) + (p.rate.sampanjac || 0) + (p.rate.pjenusac || 0))} računa): ponudite ga čim sjednu.`);
  if (low("desert") && !(p.menu >= 0.5)) out.push(`Rijetko desert (${pc(p.rate.desert)} računa, kuća ${pc(house.rate.desert)}): desert za stol na dijeljenje, uz čašu desertnog vina.`);
  const title = (v) => { const t = String(v || ""); return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t; };
  const tw = p.topWine.slice(0, 2).map((w) => title(w.name));
  if (tw.length) out.push(`Piju: ${tw.join(", ")}. ${tw.length > 1 ? "Imajte ih spremne" : "Imajte ga spremnog"} i predložite jednu stepenicu više u istom stilu.`);
  if (house.perGuest && p.perGuest > house.perGuest * 1.25 && p.guests >= 4 && !isEvent(p)) out.push(`Troše više od prosjeka (${eur(p.perGuest)} po gostu, kuća ${eur(house.perGuest)}): neka Filho osobno dođe do stola.`);
  return out;
}

/* Potrošnja po gostu (owner, 2026-10-14: "average spendings per guest … map
   it with number of couverts"). A bill's guests are its couverts, or the
   persons on a group menu when that is more (a group may not be charged a
   couvert). A storno bill takes them back with its negative couvert. Bills
   with no guest on them — the bar, a coffee, the owner's table — are counted
   apart, so they do not pull the per-guest figure down and are not lost. */
export async function guestData(env, lo, hi) {
  const words = "(' ' || lower(replace(replace(COALESCE(l.grp, '') || ' ' || COALESCE(l.name, ''), ',', ' '), '.', ' ')) || ' ')";
  const MENU = `(${words} LIKE '%repertoire%' OR ${words} LIKE '% menu %' OR ${words} LIKE '% meni %')`;
  const { results } = await env.DB.prepare(
    `SELECT part, SUM(CASE WHEN g <> 0 THEN 1 ELSE 0 END) AS n, SUM(g) AS guests,
       SUM(CASE WHEN g <> 0 THEN t ELSE 0 END) AS total,
       SUM(CASE WHEN g = 0 THEN 1 ELSE 0 END) AS other_n, SUM(CASE WHEN g = 0 THEN t ELSE 0 END) AS other
     FROM (SELECT ${PART} AS part, b.total AS t,
             CASE WHEN b.total < 0 THEN MIN(c, m) ELSE MAX(c, m) END AS g
           FROM sales_bills b JOIN (
             SELECT l.bill_id AS id,
               SUM(CASE WHEN lower(l.name) LIKE '%couvert%' THEN l.qty ELSE 0 END) AS c,
               SUM(CASE WHEN ${MENU} THEN l.qty ELSE 0 END) AS m
             FROM sales_lines l JOIN sales_bills b2 ON b2.id = l.bill_id
             WHERE b2.day BETWEEN ?1 AND ?2 GROUP BY l.bill_id) x ON x.id = b.id)
     GROUP BY part`).bind(lo, hi).all();
  return results || [];
}

/* ---------- Konobari (Filho, 2026-10-14: "koji je konobar što prodao, i koji
   promet ima i što mu je palo … jer onda mogu upozorit i ispravit — dal mu
   fali aperitiv, dal više proda pjenušca a ne šampanjca") ----------
   Each waiter against the rest of the team, fairly: a lunch waiter is not
   expected to sell what a dinner waiter does, so his expected share of bills
   with, say, an aperitif is the team's share at lunch and at dinner, weighted
   by how many of his bills were lunches and how many dinners. */
export const STAFF_CAT = `CASE
  WHEN l.grp LIKE '%oktel%' OR l.grp LIKE '%peritiv%' THEN 'aperitiv'
  WHEN l.grp LIKE '%ampanj%' THEN 'sampanjac'
  WHEN l.grp LIKE '%jenu%' THEN 'pjenusac'
  WHEN l.grp LIKE '%na č%' OR l.grp LIKE '%na c%' THEN 'casa'
  WHEN l.grp LIKE '%esertn%' THEN 'desertno'
  WHEN l.grp LIKE '%vin%' THEN 'boca'
  WHEN l.grp LIKE '%redjel%' OR l.grp LIKE '%juh%' THEN 'predjelo'
  WHEN l.grp LIKE '%esert%' THEN 'desert'
  WHEN l.grp LIKE '%akij%' OR l.grp LIKE '%rapp%' OR l.grp LIKE '%odka%' OR l.grp LIKE '%hisk%' OR l.grp LIKE '%rum%' OR l.grp LIKE '%ognac%' THEN 'zestoko'
  ELSE NULL END`;
export const STAFF_LABEL = {
  aperitiv: "kokteli i aperitivi", sampanjac: "šampanjac", pjenusac: "pjenušac", casa: "vino na čašu",
  boca: "vino na bocu", desertno: "desertno vino", predjelo: "predjela i juhe", desert: "deserti", zestoko: "žestoko",
};
const PART = "CASE WHEN substr(b.at, 12, 2) < '16' THEN 'rucak' ELSE 'vecera' END";

/* Wine is counted by our map, not by the till's groups (owner, 2026-10-14:
   "we will not fix Remaris, just have it and count it right in our place").
   93 of 289 wine articles sit in the wrong group — a Champagne under "Bijela
   vina DE/AUT" is a bottle of white to the group rule, so a waiter who sold it
   was told he sells no Champagne. data/till-map.json says which wine and size
   each article is, lists/theatrium.json which shelf that wine is on. Bubbles
   are their own decision by the glass too (Filho: "više proda pjenušca a ne
   šampanjca" is the aperitif glass as much as the bottle), so a glass of
   Champagne is Champagne, a glass of sparkling is sparkling, a dessert pour
   is dessert wine and any other glass is "vino na čašu"; a bottle is
   Champagne, sparkling, dessert or a bottle of wine by its shelf. An article
   the map has never seen, or knows only as off the list, keeps the group
   rule, and so does everything that is not wine. Pure, so it is tested
   without D1. */
export function tillCats(till, list) {
  const shelf = new Map();                              /* "g|ref" / "b|ref" → category */
  const kind = (sec, cat) => {
    const g = sec === "glass";
    if (!g && !sec.startsWith("bottle-")) return null;
    if (cat === "champagne") return "sampanjac";
    if (cat === "sparkling") return "pjenusac";
    if (cat === "dessert") return "desertno";
    return g ? "casa" : "boca";
  };
  const walk = (o, sec, cat) => {
    if (Array.isArray(o)) return o.forEach((x) => walk(x, sec, cat));
    if (!o || typeof o !== "object") return;
    const k = `${sec === "glass" ? "g" : "b"}|${o.ref}`, c = o.ref && kind(sec, cat);
    if (c && !shelf.has(k)) shelf.set(k, c);
    for (const [key, v] of Object.entries(o)) if (key !== "ref") walk(v, sec, cat);
  };
  for (const sec of (list && list.sections) || []) for (const c of sec.categories || []) walk(c, sec.id, c.id);
  const out = { casa: [], sampanjac: [], pjenusac: [], desertno: [], boca: [], other: [] };
  for (const [name, a] of Object.entries((till && till.articles) || {})) {
    if (a.none === "nije vino") out.other.push(name);
    else if (a.ref && a.vol <= 0.15) {                  /* a pour not on the glass list: its bottle's shelf */
      const bt = shelf.get(`b|${a.ref}`);
      out[shelf.get(`g|${a.ref}`) || (bt && bt !== "boca" ? bt : "casa")].push(name);
    }
    else if (a.ref) out[shelf.get(`b|${a.ref}`) || "boca"].push(name);
  }
  return out;
}
const sqlIn = (names) => `l.name IN (${names.map((n) => `'${String(n).replace(/'/g, "''")}'`).join(", ")})`;
export function staffCatSql(cats) {
  const nonWine = STAFF_CAT.split("\n").filter((x) => !/ampanj|jenu|na č|esertn|'%vin%'/.test(x)).join("\n");
  const when = ["casa", "sampanjac", "pjenusac", "desertno", "boca"].filter((c) => cats[c].length).map((c) => `WHEN ${sqlIn(cats[c])} THEN '${c}'`);
  if (!when.length) return STAFF_CAT;
  return `CASE ${when.join(" ")}${cats.other.length ? ` WHEN ${sqlIn(cats.other)} THEN (${nonWine})` : ""} ELSE ${STAFF_CAT} END`;
}
/* the map and the list from the published wine list, five minutes at the
   edge; if either cannot be read, the group rule as before */
async function staffCatFor(env) {
  try {
    const get = (p) => fetch(`${wineListOrigin(env)}/${p}`, { cf: { cacheTtl: 300, cacheEverything: true } }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
    const [till, list] = await Promise.all([get("data/till-map.json"), get("lists/theatrium.json")]);
    return { sql: staffCatSql(tillCats(till, list)), by: "karta" };
  } catch (e) { return { sql: STAFF_CAT, by: `grupe (${String((e && e.message) || e).slice(0, 80)})` }; }
}

/* Three corrections from Filho (2026-10-14), each a reason a waiter's numbers
   were not theirs:
   - "Manuela je radila 7× moj stol … po 500 € vina, nema hrane": the owner's
     own table. A bill with no food and 300 €+ of wine is set apart
     (`OWN_TABLE`), kept out of every waiter comparison and shown as its own
     line, so it inflates nobody.
   - "Filip Horvat" is the owner ringing bills for others ("pustim druge da
     otkucaju"): listed, never compared, never part of the others' baseline.
   - "Bilo je dosta dana bez deserta": a category is judged only on days
     someone sold it at all — a day the kitchen had no dessert is nobody's
     missed dessert. */
export const OWNER_WAITERS = ["Filip Horvat"];
const WINE_SQL = "(l.grp LIKE '%vin%' OR l.grp LIKE '%ampanj%' OR l.grp LIKE '%jenu%')";
export const OWN_TABLE = `SELECT b.id FROM sales_bills b JOIN sales_lines l ON l.bill_id = b.id
  WHERE b.day BETWEEN ?1 AND ?2 GROUP BY b.id
  HAVING SUM(CASE WHEN l.tax LIKE 'H%' THEN 1 ELSE 0 END) = 0 AND SUM(CASE WHEN ${WINE_SQL} THEN l.total ELSE 0 END) >= 300`;

export async function staffData(env, lo, hi) {
  const q = (sql) => env.DB.prepare(sql).bind(lo, hi).all().then((r) => r.results || []);
  const { sql: CAT, by } = await staffCatFor(env);
  const [bills, cats, own, wines] = await Promise.all([
    q(`SELECT b.waiter AS w, b.day AS d, ${PART} AS p, COUNT(*) AS n, SUM(b.total) AS t FROM sales_bills b
       WHERE b.day BETWEEN ?1 AND ?2 AND b.total > 0 AND b.id NOT IN (${OWN_TABLE}) GROUP BY w, d, p`),
    q(`SELECT b.waiter AS w, b.day AS d, ${PART} AS p, ${CAT} AS c, COUNT(DISTINCT b.id) AS n, SUM(l.total) AS t
       FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id
       WHERE b.day BETWEEN ?1 AND ?2 AND b.total > 0 AND b.id NOT IN (${OWN_TABLE}) GROUP BY w, d, p, c HAVING c IS NOT NULL`),
    q(`SELECT b.waiter AS w, COUNT(*) AS n, SUM(b.total) AS t FROM sales_bills b WHERE b.id IN (${OWN_TABLE}) GROUP BY w`),
    q(`SELECT b.waiter AS w, l.name AS name, SUM(l.qty) AS q, SUM(l.total) AS t FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id
       WHERE b.day BETWEEN ?1 AND ?2 AND b.total > 0 AND ${WINE_SQL} AND b.id NOT IN (${OWN_TABLE})
       GROUP BY w, l.name ORDER BY t DESC LIMIT 300`),
  ]);
  const report = staffReport(bills, cats);
  for (const r of report) r.topWines = wines.filter((x) => (x.w || "—") === r.waiter).slice(0, 3).map((x) => ({ name: x.name, q: x.q, t: x.t }));
  return { catBy: by, waiters: report, ownTable: own.map((x) => ({ waiter: x.w || "—", n: x.n, total: x.t })) };
}

/* Pure. bills: {w, d, p, n, t}; cats: {w, d, p, c, n, t}. Per waiter: n, total,
   avg, lunch, rate[c], exp[c] (both over the days c was on sale), champ,
   champTeam, flags. The owner is listed but neither compared nor compared to. */
export function staffReport(bills, cats) {
  const key = (r) => r.w || "—";
  const owner = (w) => OWNER_WAITERS.includes(w);
  const who = [...new Set(bills.map(key))];
  const onSale = {};                                   /* c → days anyone sold it */
  for (const r of cats) (onSale[r.c] = onSale[r.c] || new Set()).add(r.d);
  const sumB = (f) => bills.filter(f).reduce((a, r) => a + r.n, 0);
  const sumC = (f, k = "n") => cats.filter(f).reduce((a, r) => a + (r[k] || 0), 0);
  const out = [];
  for (const w of who) {
    const n = sumB((r) => key(r) === w);
    if (!n) continue;
    const total = bills.filter((r) => key(r) === w).reduce((a, r) => a + r.t, 0);
    const rate = {}, exp = {}, flags = [];
    const others = (r) => key(r) !== w && !owner(key(r));
    for (const c of Object.keys(STAFF_LABEL)) {
      const days = onSale[c] || new Set(), open = (r) => days.has(r.d);
      const nw = sumB((r) => key(r) === w && open(r));
      rate[c] = nw ? sumC((r) => key(r) === w && r.c === c) / nw : 0;
      let e = 0;
      for (const p of ["rucak", "vecera"]) {
        const on = sumB((r) => others(r) && r.p === p && open(r)), oc = sumC((r) => others(r) && r.p === p && r.c === c);
        e += nw && on ? (sumB((r) => key(r) === w && r.p === p && open(r)) / nw) * (oc / on) : 0;
      }
      exp[c] = e;
      if (!owner(w) && nw >= 15 && e >= 0.05 && rate[c] < e * 0.7 && e - rate[c] >= 0.05) flags.push({ c, rate: rate[c], exp: e });
    }
    const champ = sumC((r) => key(r) === w && r.c === "sampanjac", "t"), pj = sumC((r) => key(r) === w && r.c === "pjenusac", "t");
    const oc = sumC((r) => others(r) && r.c === "sampanjac", "t"), op = sumC((r) => others(r) && r.c === "pjenusac", "t");
    const share = champ + pj ? champ / (champ + pj) : null, team = oc + op ? oc / (oc + op) : null;
    const bub = sumC((r) => key(r) === w && (r.c === "sampanjac" || r.c === "pjenusac")), oChampN = sumC((r) => others(r) && r.c === "sampanjac");
    if (!owner(w) && share != null && team != null && bub >= 5 && oChampN >= 4 && share < team * 0.6) flags.push({ c: "mjehurici", rate: share, exp: team });
    flags.sort((a, b) => (a.rate - a.exp) - (b.rate - b.exp));
    out.push({ waiter: w, owner: owner(w), n, total, avg: total / n, lunch: sumB((r) => key(r) === w && r.p === "rucak"), rate, exp, champ: share, champTeam: team, flags });
  }
  return out.sort((a, b) => (a.owner - b.owner) || b.total - a.total);
}

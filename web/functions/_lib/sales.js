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
       FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id WHERE b.day BETWEEN ?1 AND ?2 AND b.total > 0 GROUP BY b.waiter`, lo, hi),
  ]);
  return { items, weekdays, dayparts, leaks, waiters, staff: await staffData(env, lo, hi) };
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

export async function staffData(env, lo, hi) {
  const q = (sql) => env.DB.prepare(sql).bind(lo, hi).all().then((r) => r.results || []);
  const [bills, cats] = await Promise.all([
    q(`SELECT b.waiter AS w, ${PART} AS p, COUNT(*) AS n, SUM(b.total) AS t FROM sales_bills b
       WHERE b.day BETWEEN ?1 AND ?2 AND b.total > 0 GROUP BY w, p`),
    q(`SELECT b.waiter AS w, ${PART} AS p, ${STAFF_CAT} AS c, COUNT(DISTINCT b.id) AS n, SUM(l.total) AS t
       FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id
       WHERE b.day BETWEEN ?1 AND ?2 AND b.total > 0 GROUP BY w, p, c HAVING c IS NOT NULL`),
  ]);
  return staffReport(bills, cats);
}

/* Pure: rows → per waiter {n, total, avg, rate[c], exp[c], champ, champTeam, flags}. */
export function staffReport(bills, cats) {
  const who = [...new Set(bills.map((r) => r.w || "—"))];
  const nOf = (w, p) => bills.filter((r) => (r.w || "—") === w && (!p || r.p === p)).reduce((a, r) => a + r.n, 0);
  const cOf = (w, p, c, k = "n") => cats.filter((r) => (r.w || "—") === w && (!p || r.p === p) && r.c === c).reduce((a, r) => a + (r[k] || 0), 0);
  const out = [];
  for (const w of who) {
    const n = nOf(w);
    if (!n) continue;
    const others = who.filter((x) => x !== w);
    const total = bills.filter((r) => (r.w || "—") === w).reduce((a, r) => a + r.t, 0);
    const rate = {}, exp = {}, flags = [];
    for (const c of Object.keys(STAFF_LABEL)) {
      rate[c] = cOf(w, null, c) / n;
      /* expected: the others' share at lunch and at dinner, in his mix */
      let e = 0;
      for (const p of ["rucak", "vecera"]) {
        const on = others.reduce((a, o) => a + nOf(o, p), 0), oc = others.reduce((a, o) => a + cOf(o, p, c), 0);
        e += on ? (nOf(w, p) / n) * (oc / on) : 0;
      }
      exp[c] = e;
      if (n >= 15 && e >= 0.05 && rate[c] < e * 0.7 && e - rate[c] >= 0.05) flags.push({ c, rate: rate[c], exp: e });
    }
    /* bubbles: of what he sold in bubbles, how much was champagne */
    const champ = cOf(w, null, "sampanjac", "t"), pj = cOf(w, null, "pjenusac", "t");
    const oc = others.reduce((a, o) => a + cOf(o, null, "sampanjac", "t"), 0), op = others.reduce((a, o) => a + cOf(o, null, "pjenusac", "t"), 0);
    const share = champ + pj ? champ / (champ + pj) : null, team = oc + op ? oc / (oc + op) : null;
    /* only with enough of it to mean something: a single bottle of champagne
       on the team swings a share of two or three sales */
    const bub = cOf(w, null, "sampanjac") + cOf(w, null, "pjenusac"), oChampN = others.reduce((a, o) => a + cOf(o, null, "sampanjac"), 0);
    if (share != null && team != null && bub >= 5 && oChampN >= 4 && share < team * 0.6) flags.push({ c: "mjehurici", rate: share, exp: team });
    flags.sort((a, b) => (a.rate - a.exp) - (b.rate - b.exp));
    out.push({ waiter: w, n, total, avg: total / n, lunch: nOf(w, "rucak"), rate, exp, champ: share, champTeam: team, flags });
  }
  return out.sort((a, b) => b.total - a.total);
}

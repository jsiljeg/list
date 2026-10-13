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
 * storno is its own bill with a negative total, so sums are right as they are. */
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

/* Bills in, inside one D1 batch. `days` is the range the export covered. */
export async function importBills(env, { from, to, bills, last }) {
  const rows = bills.map(cleanBill).filter(Boolean);
  const st = [];
  for (const r of rows) {
    st.push(env.DB.prepare("DELETE FROM sales_lines WHERE bill_id = ?1").bind(r.id));
    st.push(env.DB.prepare(
      `INSERT OR REPLACE INTO sales_bills (id, no, day, at, pay, waiter, cust, oib, total, vat, pnp, jir)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`)
      .bind(r.id, r.no, r.day, r.at, r.pay, r.waiter, r.cust || null, r.oib || null, r.total, r.vat, r.pnp, r.jir || null));
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
  return { bills: rows.length, rejected: bills.length - rows.length, removed };
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
    q(`SELECT l.grp AS grp, SUM(l.total) AS total, SUM(l.qty) AS qty FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id
       WHERE b.day BETWEEN ?1 AND ?2 GROUP BY l.grp ORDER BY total DESC`, lo, hi),
    q(`SELECT l.tax AS tax, SUM(l.total) AS total, SUM(l.net) AS net FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id
       WHERE b.day BETWEEN ?1 AND ?2 GROUP BY l.tax ORDER BY total DESC`, lo, hi),
    q(`SELECT cust, oib, COUNT(*) AS n, SUM(total) AS total, SUM(CASE WHEN pay = 'Virman' THEN total ELSE 0 END) AS virman
       FROM sales_bills WHERE day BETWEEN ?1 AND ?2 AND cust IS NOT NULL GROUP BY oib ORDER BY total DESC LIMIT 30`, lo, hi),
    q("SELECT k, v FROM sales_state"),
  ]);
  return { month, months, days, pays, groups, taxes, custs, state: Object.fromEntries(state.map((s) => [s.k, s.v])) };
}

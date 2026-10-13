/* /api/prihodi/tjedan  POST (the private repo's Monday run, EXPENSE_WORKER_KEY)
 *
 * The owner's Monday e-mail (2026-10-14: "a Monday email with the top
 * findings, so he does not have to open the admin"). Last week (Monday to
 * Sunday, Zagreb) against the week before and the same week last year, the
 * three numbers Filho steers by — turnover, the average bill, wine per bill —
 * the days, the dishes that carried it, and the month so far. Plain text,
 * through Theatrium's own sender (web/alerts), which can only write to the
 * address verified in Cloudflare Email Routing.
 *   {dry: true}  returns the text without sending it. */
import { reply, isExpenseWorker, staffData, STAFF_LABEL } from "../../_lib/sales.js";

const WINE = "(l.grp LIKE '%vin%' OR l.grp LIKE '%ampanj%' OR l.grp LIKE '%jenu%')";
const WD = ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"];
const eur = (n) => new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " €";
const hr = (d) => `${Number(d.slice(8, 10))}. ${Number(d.slice(5, 7))}.`;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const add = (d, n) => iso(Date.parse(d + "T12:00:00Z") + n * 86400000);
const arrow = (a, b) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / b) * 100))}%` : "");

async function range(env, lo, hi) {
  const r = await env.DB.prepare(
    `SELECT COUNT(DISTINCT b.id) AS n, COALESCE(SUM(l.total), 0) AS total,
            COALESCE(SUM(CASE WHEN ${WINE} THEN l.total ELSE 0 END), 0) AS wine
     FROM sales_bills b JOIN sales_lines l ON l.bill_id = b.id WHERE b.day BETWEEN ?1 AND ?2 AND b.total > 0`).bind(lo, hi).first();
  const s = await env.DB.prepare("SELECT COALESCE(SUM(total), 0) AS t FROM sales_bills WHERE day BETWEEN ?1 AND ?2").bind(lo, hi).first();
  return { n: r.n || 0, total: s.t || 0, wine: r.wine || 0 };
}

export async function onRequestPost({ request, env }) {
  if (!isExpenseWorker(request, env)) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const b = await request.json().catch(() => ({}));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(new Date());
  const dow = new Date(today + "T12:00:00Z").getUTCDay();
  const hi = add(today, -(dow === 0 ? 7 : dow)), lo = add(hi, -6);           /* last Monday–Sunday */
  const [w, p, y] = await Promise.all([range(env, lo, hi), range(env, add(lo, -7), add(hi, -7)), range(env, add(lo, -364), add(hi, -364))]);
  if (!w.n) return reply(request, { ok: true, skipped: "no bills last week" });

  const days = (await env.DB.prepare("SELECT day, COUNT(*) AS n, SUM(total) AS t FROM sales_bills WHERE day BETWEEN ?1 AND ?2 GROUP BY day ORDER BY day")
    .bind(lo, hi).all()).results || [];
  const dishes = (await env.DB.prepare(
    `SELECT l.name AS name, SUM(l.qty) AS q, SUM(l.total) AS t FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id
     WHERE b.day BETWEEN ?1 AND ?2 AND l.tax LIKE 'H%' AND l.grp NOT LIKE '%odat%' AND l.grp NOT LIKE '%epertoire%'
       AND l.name NOT LIKE '%COUVERT%' AND l.name NOT LIKE '%MENU%'
     GROUP BY l.name ORDER BY t DESC LIMIT 5`).bind(lo, hi).all()).results || [];
  /* each waiter (Filho, 2026-10-14: "koji je konobar što prodao … što mu je
     palo"): the week's takings, and where he is below the others at the same
     mix of lunches and dinners */
  const [staff, wine] = await Promise.all([staffData(env, lo, hi), env.DB.prepare(
    `SELECT b.waiter AS w, COUNT(DISTINCT b.id) AS n, SUM(CASE WHEN ${WINE} THEN l.total ELSE 0 END) AS wine
     FROM sales_lines l JOIN sales_bills b ON b.id = l.bill_id WHERE b.day BETWEEN ?1 AND ?2 AND b.total > 0 GROUP BY b.waiter`).bind(lo, hi).all()]);
  const wineBy = new Map((wine.results || []).map((r) => [r.w, r.n ? r.wine / r.n : 0]));
  const pc = (x) => `${Math.round((x || 0) * 100)}%`;
  const staffLines = staff.filter((x) => x.n >= 5).flatMap((x) => [
    `  ${x.waiter}: ${eur(x.total)} · ${x.n} računa · prosječno ${eur(x.avg)} · vino ${eur(wineBy.get(x.waiter) || 0)}/rač.`,
    ...(x.n >= 10 ? x.flags.slice(0, 3) : []).map((f) => f.c === "mjehurici"
      ? `      ! mjehurići: ${pc(f.rate)} šampanjca, ostali ${pc(f.exp)}`
      : `      ! ${STAFF_LABEL[f.c]}: na ${pc(f.rate)} računa, ostali na istim stolovima ${pc(f.exp)}`),
  ]);
  const m0 = hi.slice(0, 8) + "01", dayN = Number(hi.slice(8, 10));
  const pm = add(m0, -1).slice(0, 8) + "01";
  const pmEnd = add(pm, Math.min(dayN, Number(add(m0, -1).slice(8, 10))) - 1);
  const [mt, mp, my] = await Promise.all([range(env, m0, hi), range(env, pm, pmEnd), range(env, add(m0, -364), add(hi, -364))]);

  const avg = (x) => (x.n ? x.total / x.n : 0), wpb = (x) => (x.n ? x.wine / x.n : 0);
  const line = (label, now, before, last) => `${label}: ${eur(now)}${before ? `  (${arrow(now, before)} prema prošlom tjednu` : "  ("}${last ? `${before ? ", " : ""}${arrow(now, last)} prema lani` : ""})`.replace("  ()", "");
  const best = days.slice().sort((a, b2) => b2.t - a.t);
  const name = (s) => { const v = String(s || ""); return v === v.toUpperCase() ? v.charAt(0) + v.slice(1).toLowerCase() : v; };
  const text = [
    `Tjedan ${hr(lo)}–${hr(hi)}`,
    "",
    line("Promet", w.total, p.total, y.total),
    line("Prosječni račun", avg(w), avg(p), avg(y)),
    line("Vino po računu", wpb(w), wpb(p), wpb(y)),
    `Računa: ${w.n}${p.n ? ` (prošli tjedan ${p.n})` : ""}`,
    "",
    "Po danima:",
    ...days.map((d) => `  ${WD[new Date(d.day + "T12:00:00Z").getUTCDay()]} ${hr(d.day)}: ${eur(d.t)} · ${d.n} računa`),
    best.length > 1 ? `Najjači ${WD[new Date(best[0].day + "T12:00:00Z").getUTCDay()]}, najslabiji ${WD[new Date(best[best.length - 1].day + "T12:00:00Z").getUTCDay()]}.` : "",
    "",
    staffLines.length ? "Konobari:" : "",
    ...staffLines,
    "",
    dishes.length ? "Jela koja su nosila tjedan:" : "",
    ...dishes.map((d) => `  ${name(d.name)}: ${Math.round(d.q)} × · ${eur(d.t)}`),
    "",
    `Mjesec do sada (1.–${dayN}.): ${eur(mt.total)}${mp.total ? `  (${arrow(mt.total, mp.total)} prema istim danima prošlog mjeseca${my.total ? `, ${arrow(mt.total, my.total)} prema lani` : ""})` : ""}`,
    "",
    "Prag isplativosti, troškovi i ostalo: /admin → Troškovi → Pregled.",
  ].filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");

  const title = `Tjedan ${hr(lo)}–${hr(hi)}: ${eur(w.total)}${p.total ? ` ${arrow(w.total, p.total)}` : ""}`;
  if (b && b.dry) return reply(request, { ok: true, title, text });
  if (!env.ALERTS) return reply(request, { ok: false, error: "no_alerts" }, 503);
  const r = await env.ALERTS.fetch("https://alerts/notify", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic: "Tjedni pregled", to: "weekly", title, body: text, click: "https://theatrium.list.devinos.hr/admin.html" }),
  });
  const sent = await r.json().catch(() => ({}));
  return reply(request, { ok: r.ok, title, sent: sent.sent, failed: (sent.failed || []).map((f) => f.to) });
}

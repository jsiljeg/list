/* /api/prihodi/uvoz  (the private repo's Remaris run, EXPENSE_WORKER_KEY)
 *   GET                               {oldest, floor}: the earliest day held, and
 *                                     the month before which Remaris has nothing
 *   POST {from, to, bills: [...]}     a part of one export, ≤ 60 bills
 *   POST {from, to, bills, keep: []}  the last part: also drops whatever the
 *                                     range held that the export no longer has
 *   POST {floor: "YYYY-MM"}           an older month came back empty: stop there
 *   POST {error: "…"}                 the run failed; shown in /admin
 * Sent by theatrium-troskovi/remaris/sync.py. Design: web/EXPENSES.md. */
import { reply, isExpenseWorker, importBills, setState } from "../../_lib/sales.js";

const isDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

export async function onRequestGet({ request, env }) {
  if (!isExpenseWorker(request, env)) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const o = await env.DB.prepare("SELECT MIN(day) AS d FROM sales_bills").first();
  const f = await env.DB.prepare("SELECT v FROM sales_state WHERE k = 'floor'").first();
  return reply(request, { oldest: (o && o.d) || null, floor: (f && f.v) || "" });
}

export async function onRequestPost({ request, env }) {
  if (!isExpenseWorker(request, env)) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const b = await request.json().catch(() => null);
  if (!b) return reply(request, { error: "body" }, 400);
  if (b.error) {
    await setState(env, "error", JSON.stringify({ at: new Date().toISOString(), msg: String(b.error).slice(0, 300) }));
    return reply(request, { ok: true });
  }
  if (typeof b.floor === "string" && /^\d{4}-\d{2}$/.test(b.floor)) {
    await setState(env, "floor", b.floor);
    return reply(request, { ok: true });
  }
  if (!isDay(b.from) || !isDay(b.to) || b.from > b.to) return reply(request, { error: "range" }, 400);
  if (!Array.isArray(b.bills) || b.bills.length > 60) return reply(request, { error: "bills" }, 400);
  const last = Array.isArray(b.keep) ? { keep: b.keep.slice(0, 20000) } : null;
  const r = await importBills(env, { from: b.from, to: b.to, bills: b.bills, last });
  if (last) await setState(env, "error", "");
  return reply(request, { ok: true, ...r });
}

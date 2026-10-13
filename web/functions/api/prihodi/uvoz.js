/* /api/prihodi/uvoz  POST (the private repo's Remaris run, EXPENSE_WORKER_KEY)
 *   {from, to, bills: [...]}          a part of one export, ≤ 60 bills
 *   {from, to, bills, keep: [ids]}    the last part: also drops whatever the
 *                                     range held that the export no longer has
 *   {error: "…"}                      the run failed; shown in /admin
 * Sent by theatrium-troskovi/remaris/sync.py. Design: web/EXPENSES.md. */
import { reply, isExpenseWorker, importBills, setState } from "../../_lib/sales.js";

const isDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

export async function onRequestPost({ request, env }) {
  if (!isExpenseWorker(request, env)) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const b = await request.json().catch(() => null);
  if (!b) return reply(request, { error: "body" }, 400);
  if (b.error) {
    await setState(env, "error", JSON.stringify({ at: new Date().toISOString(), msg: String(b.error).slice(0, 300) }));
    return reply(request, { ok: true });
  }
  if (!isDay(b.from) || !isDay(b.to) || b.from > b.to) return reply(request, { error: "range" }, 400);
  if (!Array.isArray(b.bills) || b.bills.length > 60) return reply(request, { error: "bills" }, 400);
  const last = Array.isArray(b.keep) ? { keep: b.keep.slice(0, 20000) } : null;
  const r = await importBills(env, { from: b.from, to: b.to, bills: b.bills, last });
  if (last) await setState(env, "error", "");
  return reply(request, { ok: true, ...r });
}

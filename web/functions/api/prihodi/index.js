/* /api/prihodi
 *   GET  ?mjesec=YYYY-MM  (staff)  that month's income from the till, summed:
 *        by day, payment, sales group, tax group and company customer, plus
 *        the last 24 months and when Remaris was last read.
 * Design: web/EXPENSES.md, "Prihodi". */
import { reply, isStaffAsync, monthSummary } from "../../_lib/sales.js";

export async function onRequestGet({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const m = new URL(request.url).searchParams.get("mjesec") || "";
  const month = /^\d{4}-\d{2}$/.test(m) ? m : new Date().toISOString().slice(0, 7);
  return reply(request, await monthSummary(env, month));
}

/* /api/prihodi
 *   GET  ?mjesec=YYYY-MM  (staff)  that month's income from the till, summed:
 *        by day, payment, sales group, tax group and company customer, plus
 *        the last 24 months and when Remaris was last read.
 *   GET  ?od=YYYY-MM-DD&do=YYYY-MM-DD  (staff)  any span of days (≤ 93):
 *        the days, articles, weekdays, lunch/dinner, waiters and guests.
 * Design: web/EXPENSES.md, "Prihodi". */
import { reply, isStaffAsync, monthSummary, rangeSummary } from "../../_lib/sales.js";

const isDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

export async function onRequestGet({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const q = new URL(request.url).searchParams;
  const lo = q.get("od"), hi = q.get("do");
  if (lo || hi) {
    if (!isDay(lo) || !isDay(hi) || hi < lo || Date.parse(hi) - Date.parse(lo) > 92 * 86400000) return reply(request, { error: "range" }, 400);
    return reply(request, await rangeSummary(env, lo, hi));
  }
  const m = q.get("mjesec") || "";
  const month = /^\d{4}-\d{2}$/.test(m) ? m : new Date().toISOString().slice(0, 7);
  return reply(request, await monthSummary(env, month));
}

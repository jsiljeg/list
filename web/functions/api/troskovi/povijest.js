/* /api/troskovi/povijest  GET (staff): the last changes to receipts, for the
   /admin Povijest tab, newest first — who marked which invoice paid or
   unpaid. Behind the staff key like every receipt; never in git. */
import { reply, isStaffAsync } from "../../_lib/expenses.js";

export async function onRequestGet({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const { results } = await env.DB.prepare(
    "SELECT at, who, receipt_id, action, vendor, amount FROM expense_events ORDER BY at DESC LIMIT 80").all();
  return reply(request, { events: results || [] });
}

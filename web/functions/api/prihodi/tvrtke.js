/* /api/prihodi/tvrtke  (staff)
 *   GET                  every company a bill was made out to: habits, what
 *                        they take and what they never do, the house's rates
 *                        beside them, advice, and the staff note
 *   PUT {oib, note}      the note (≤ 2.000 characters; "" clears it)
 * Design: web/EXPENSES.md, "Tvrtke". */
import { reply, isStaffAsync, companyData } from "../../_lib/sales.js";

export async function onRequestGet({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  return reply(request, await companyData(env));
}

export async function onRequestPut({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const b = await request.json().catch(() => null);
  const oib = String((b && b.oib) || "").trim();
  if (!/^[\w-]{4,20}$/.test(oib)) return reply(request, { error: "oib" }, 400);
  const note = String(b.note || "").trim().slice(0, 2000), now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO sales_companies (oib, note, updated_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(oib) DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at`).bind(oib, note, now).run();
  return reply(request, { ok: true, oib, note, updated_at: now });
}

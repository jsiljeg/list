/* /api/troskovi/mer
 *   GET   (staff)  how the moj-eRačun connection stands
 *   POST  (staff)  "provjeri sada": ask the inbox now, not in half an hour;
 *                  {from, to} (YYYY-MM-DD) backfills an older range instead
 * Read only; design and the credentials it needs: web/EXPENSES.md. */
import { reply, isStaffAsync } from "../../_lib/expenses.js";
import { merSync, merStatus } from "../../_lib/mer.js";

export async function onRequestGet({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  return reply(request, { mer: await merStatus(env) });
}

export async function onRequestPost({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const b = await request.json().catch(() => ({}));
  const ok = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const range = b && ok(b.from) && ok(b.to) && b.from <= b.to ? { from: b.from, to: b.to } : null;
  const sync = await merSync(env, { force: true, range, retryFailed: !!(b && b.retry_failed) });
  return reply(request, { sync, mer: await merStatus(env) });
}

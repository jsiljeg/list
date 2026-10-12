/* /api/troskovi/mer
 *   GET   (staff)  how the moj-eRačun connection stands
 *   POST  (staff)  "provjeri sada": ask the inbox now, not in half an hour
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
  const sync = await merSync(env, { force: true });
  return reply(request, { sync, mer: await merStatus(env) });
}

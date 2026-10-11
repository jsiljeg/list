/* /api/troskovi/<id>/foto/<n>  GET (staff, or the reading run): one photo. */
import { reply, isStaffAsync, isExpenseWorker } from "../../../../_lib/expenses.js";
import { cors } from "../../../../_lib/wines.js";

export async function onRequestGet({ request, env, params }) {
  if (!isExpenseWorker(request, env) && !(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  const row = await env.DB.prepare("SELECT mime, bytes FROM expense_photos WHERE receipt_id = ?1 AND n = ?2")
    .bind(params.id, Number(params.n)).first();
  if (!row) return reply(request, { error: "not_found" }, 404);
  /* D1 hands a BLOB back as an array of numbers in production */
  return new Response(new Uint8Array(row.bytes), {
    headers: { "content-type": row.mime, "cache-control": "private, no-store", ...cors(request) },
  });
}

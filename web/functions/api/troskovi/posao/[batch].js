/* /api/troskovi/posao/<batch>  GET (worker): the receipts this run is to read,
   with their photo numbers. Ids reach the run only through here — the dispatch
   carries nothing but the batch id. */
import { reply, isExpenseWorker } from "../../../_lib/expenses.js";

export async function onRequestGet({ request, env, params }) {
  if (!isExpenseWorker(request, env)) return reply(request, { error: "key" }, 401);
  if (!/^\d{8}-[0-9a-f]{12}$/.test(params.batch)) return reply(request, { error: "batch" }, 400);
  const { results } = await env.DB.prepare(
    `SELECT r.id, (SELECT GROUP_CONCAT(n) FROM expense_photos p WHERE p.receipt_id = r.id) AS pics
       FROM expense_receipts r WHERE r.batch = ?1 AND r.status = 'working'`).bind(params.batch).all();
  return reply(request, { receipts: (results || []).map((r) => ({ id: r.id, photos: r.pics ? String(r.pics).split(",").map(Number) : [] })) });
}

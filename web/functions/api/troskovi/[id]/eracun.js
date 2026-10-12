/* /api/troskovi/<id>/eracun  GET (the reading run): an e-invoice's lines as
   the invoice states them, for the run to name and file. Amounts are exact
   and are not taken back from the run (mergeEinvoice). */
import { reply, isExpenseWorker, readReceipt } from "../../../_lib/expenses.js";

export async function onRequestGet({ request, env, params }) {
  if (!isExpenseWorker(request, env)) return reply(request, { error: "key" }, 401);
  const r = await readReceipt(env, params.id);
  if (!r || r.source !== "mer" || r.status !== "working") return reply(request, { error: "not_found" }, 404);
  return reply(request, { vendor: r.vendor, doc_date: r.doc_date, total: r.total, note: r.note,
    items: r.items.map(({ name, qty, unit, unit_price, total }) => ({ name, qty, unit, unit_price, total })) });
}

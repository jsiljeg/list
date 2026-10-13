/* /api/troskovi/<id>/eracun  GET (the reading run): an e-invoice's lines as
   the invoice states them, for the run to name and file. Amounts are exact
   and are not taken back from the run (mergeEinvoice). */
import { reply, isExpenseWorker, readReceipt } from "../../../_lib/expenses.js";

export async function onRequestGet({ request, env, params }) {
  if (!isExpenseWorker(request, env)) return reply(request, { error: "key" }, 401);
  const r = await readReceipt(env, params.id);
  if (!r || r.source !== "mer" || r.status !== "working") return reply(request, { error: "not_found" }, 404);
  return reply(request, { vendor: r.vendor, doc_date: r.doc_date, total: r.total, note: r.note,
    /* code and the invoiced price let the run tell a magnum from a bottle
       when the XML's name gives no size (2026-10-12) */
    items: r.items.map(({ name, qty, unit, unit_price, total, doc_code, doc_price, doc_qty, doc_unit }) =>
      ({ name, qty, unit, unit_price, total, code: doc_code || "", invoiced: { qty: doc_qty, unit: doc_unit, price: doc_price } })) });
}

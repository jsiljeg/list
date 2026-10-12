/* /api/troskovi/posao/<batch>  GET (worker): the receipts this run is to read,
   with their photo numbers. Ids reach the run only through here — the dispatch
   carries nothing but the batch id. An e-invoice from MER has no photo: it
   says einvoice, and the run fetches its lines from /<id>/eracun. Only
   images are offered as photos — an e-invoice's PDF is for Filho's eyes.
   known_keys: the product keys already in use, so a run reuses them. */
import { reply, isExpenseWorker } from "../../../_lib/expenses.js";

export async function onRequestGet({ request, env, params }) {
  if (!isExpenseWorker(request, env)) return reply(request, { error: "key" }, 401);
  if (!/^\d{8}-[0-9a-f]{12}$/.test(params.batch)) return reply(request, { error: "batch" }, 400);
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.source, (SELECT GROUP_CONCAT(n) FROM expense_photos p WHERE p.receipt_id = r.id AND p.mime LIKE 'image/%') AS pics
       FROM expense_receipts r WHERE r.batch = ?1 AND r.status = 'working'`).bind(params.batch).all();
  return reply(request, { receipts: (results || []).map((r) => ({ id: r.id, einvoice: r.source === "mer",
    photos: r.source === "mer" || !r.pics ? [] : String(r.pics).split(",").map(Number) })),
    known_keys: await knownKeys(env) });
}

/* The product keys already in use, each with the latest name it was printed
   under (owner, 2026-10-12: "check what you are comparing"). A run reads its
   receipts alone; without this it cannot know that last week's Mâcon was
   "macon jules desjourneys", and Cijene then never sees the two together. */
async function knownKeys(env) {
  const { results } = await env.DB.prepare(
    `SELECT items FROM expense_receipts WHERE status = 'done' AND dup_of IS NULL
      ORDER BY COALESCE(doc_date, created_at) DESC LIMIT 400`).all();
  const seen = new Map();
  for (const row of results || []) {
    let items = [];
    try { items = JSON.parse(row.items || "[]"); } catch { /* skip */ }
    for (const it of items) if (it && it.key && !seen.has(it.key)) seen.set(it.key, String(it.name || "").slice(0, 80));
  }
  return [...seen].slice(0, 800).map(([key, name]) => ({ key, name }));
}

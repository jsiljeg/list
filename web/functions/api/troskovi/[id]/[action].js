/* /api/troskovi/<id>/<action>  POST
 *   rezultat    (worker) what was read: {status: "done"|"failed", vendor, vendor_oib,
 *                        doc_date, doc_no, total, vat, payment, items[], note, error}
 *   kategorija  (staff)  {i, category}: Filho moves one line to another category
 *   ispravi     (staff)  {vendor?, doc_date?, total?}: he corrects the header
 *   ponovi      (staff)  a failed receipt is read again
 *   obrisi      (staff)  the receipt and its photos are deleted for good */
import { reply, isStaffAsync, isExpenseWorker, readReceipt, setFields, pump, clip, num, cleanItems, CATEGORIES } from "../../../_lib/expenses.js";

export async function onRequestPost({ request, env, params }) {
  const { id, action } = params;
  const item = await readReceipt(env, id);
  if (!item) return reply(request, { error: "not_found" }, 404);
  let b = {};
  try { b = await request.json(); } catch { /* actions without a body */ }

  if (action === "rezultat") {
    if (!isExpenseWorker(request, env)) return reply(request, { error: "key" }, 401);
    if (item.status !== "working") return reply(request, { error: "move", from: item.status }, 409);
    if (b.status === "failed") {
      await setFields(env, id, { status: "failed", batch: null, error: clip(b.error, 300) || "Račun se ne može pročitati." });
    } else {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(b.doc_date || "") ? b.doc_date : null;
      await setFields(env, id, {
        status: "done", batch: null, error: "",
        vendor: clip(b.vendor, 120), vendor_oib: clip(b.vendor_oib, 11).replace(/\D/g, ""),
        doc_date: date, doc_no: clip(b.doc_no, 60), total: num(b.total), vat: num(b.vat),
        payment: ["gotovina", "kartica", "virman"].includes(b.payment) ? b.payment : "",
        items: JSON.stringify(cleanItems(b.items)), note: clip(b.note, 300),
      });
    }
    await pump(env);
    return reply(request, { ok: true });
  }

  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);

  if (action === "kategorija") {
    const i = Number(b.i);
    if (!CATEGORIES.includes(b.category) || !Number.isInteger(i) || !item.items[i]) return reply(request, { error: "bad" }, 400);
    item.items[i].category = b.category;
    item.items[i].fixed = true;     /* chosen by a person */
    await setFields(env, id, { items: JSON.stringify(item.items) });
    return reply(request, { ok: true, item: await readReceipt(env, id) });
  }
  if (action === "ispravi") {
    const f = {};
    if (b.vendor !== undefined) f.vendor = clip(b.vendor, 120);
    if (b.doc_date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.doc_date)) return reply(request, { error: "date" }, 400);
      f.doc_date = b.doc_date;
    }
    if (b.total !== undefined) {
      const t = num(String(b.total).replace(",", "."));
      if (t == null) return reply(request, { error: "total" }, 400);
      f.total = t;
    }
    if (!Object.keys(f).length) return reply(request, { error: "empty" }, 400);
    await setFields(env, id, f);
    return reply(request, { ok: true, item: await readReceipt(env, id) });
  }
  if (action === "ponovi") {
    if (item.status !== "failed") return reply(request, { error: "not_failed" }, 409);
    await setFields(env, id, { status: "queued", runs: 0, error: "" });
    const pumped = await pump(env);
    return reply(request, { ok: true, item: await readReceipt(env, id), pumped });
  }
  if (action === "obrisi") {
    if (item.status === "working") return reply(request, { error: "running" }, 409);
    await env.DB.prepare("DELETE FROM expense_photos WHERE receipt_id = ?1").bind(id).run();
    await env.DB.prepare("DELETE FROM expense_receipts WHERE id = ?1").bind(id).run();
    return reply(request, { ok: true });
  }
  return reply(request, { error: "action" }, 404);
}

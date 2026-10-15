/* /api/troskovi/<id>/<action>  POST
 *   rezultat    (worker) what was read: {status: "done"|"failed", vendor, vendor_oib,
 *                        doc_date, doc_no, total, vat, payment, items[], note, error}
 *   kategorija  (staff)  {i, category}: Filho moves one line to another category
 *   ispravi     (staff)  {vendor?, doc_date?, total?}: he corrects the header
 *   uredi       (staff)  a hand-typed expense, typed again (same body as POST /api/troskovi)
 *   placeno     (staff)  {paid: true|false, by}: paid today, or not paid after all —
 *                        logged with who tapped it, for Povijest (expense_events)
 *   nije_isti   (staff)  "this is not the same invoice": a receipt marked as a twin counts again
 *   ponovi      (staff)  a receipt is read again — a failed one, or a photo read
 *                        under older rules (categories chosen by hand are kept)
 *   obrisi      (staff)  the receipt and its photos are deleted for good */
import { reply, isStaffAsync, isExpenseWorker, readReceipt, setFields, pump, clip, num, cleanItems, cleanManual,
         mergeEinvoice, keepFixed, zagrebDate, logEvent, pausePump, CATEGORIES } from "../../../_lib/expenses.js";
import { findTwin } from "../../../_lib/mer.js";
import { notifyOwner } from "../../../_lib/wines.js";

export async function onRequestPost({ request, env, params }) {
  const { id, action } = params;
  const item = await readReceipt(env, id);
  if (!item) return reply(request, { error: "not_found" }, 404);
  let b = {};
  try { b = await request.json(); } catch { /* actions without a body */ }

  if (action === "rezultat") {
    if (!isExpenseWorker(request, env)) return reply(request, { error: "key" }, 401);
    if (item.status !== "working") return reply(request, { error: "move", from: item.status }, 409);
    if (b.status === "retry") {
      /* the run could not start reading at all — Claude refused at once, most
         likely the subscription's usage limit (2026-10-12: 337 receipts were
         marked unreadable in 2-second runs). Back in line, this try not
         counted, and reading pauses so the queue is not spent on a closed door. */
      await env.DB.prepare("UPDATE expense_receipts SET status = 'queued', batch = NULL, runs = MAX(0, runs - 1), updated_at = ?2 WHERE id = ?1")
        .bind(id, new Date().toISOString()).run();
      /* the owner hears once per pause, not once per receipt (2026-10-15) */
      const p = await env.DB.prepare("SELECT v FROM expense_mer_state WHERE k = 'pump_pause_until'").first().catch(() => null);
      const already = p && p.v > new Date().toISOString();
      await pausePump(env, 30);
      if (!already) await notifyOwner(env, "Računi: Claude na granici",
        "Oba Claude računa su trenutno na granici korištenja. Računi čekaju u redu i čitanje se nastavlja samo za 30 min.");
      return reply(request, { ok: true, paused: true });
    }
    if (b.status === "failed") {
      await setFields(env, id, { status: "failed", batch: null, error: clip(b.error, 300) || "Račun se ne može pročitati." });
    } else if (item.source === "mer") {
      /* an e-invoice: who, when and how much are the invoice's own and stay;
         the run only names the lines and files them */
      await setFields(env, id, { status: "done", batch: null, error: "",
        items: JSON.stringify(mergeEinvoice(item.items, b.items)),
        note: [item.note, clip(b.note, 200)].filter(Boolean).join(" ") });
    } else {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(b.doc_date || "") ? b.doc_date : null;
      await setFields(env, id, {
        status: "done", batch: null, error: "",
        vendor: clip(b.vendor, 120), vendor_oib: clip(b.vendor_oib, 11).replace(/\D/g, ""),
        doc_date: date, doc_no: clip(b.doc_no, 60), total: num(b.total), vat: num(b.vat),
        payment: ["gotovina", "kartica", "virman"].includes(b.payment) ? b.payment : "",
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(b.due_date || "") ? b.due_date : null,
        items: JSON.stringify(keepFixed(item.items, cleanItems(b.items))), note: clip(b.note, 300),
      });
      /* a document that is itself proof of payment — a bank's list of executed
         payment orders, as salaries come (2026-10-13) — says when it was paid;
         a mark Filho already set by hand is never overwritten */
      if (/^\d{4}-\d{2}-\d{2}$/.test(b.paid_date || "") && !item.paid_at) await setFields(env, id, { paid_at: b.paid_date });
    }
    /* the same invoice, photographed and arrived from MER, counts once: the
       e-invoice is exact, so the photo is the one set aside */
    const now = await readReceipt(env, id);
    if (now.status === "done") {
      const isMer = now.source === "mer";
      const twin = await findTwin(env, now, !isMer, id);
      if (twin) {
        if (isMer) await setFields(env, twin.id, { dup_of: id });
        else await setFields(env, id, { dup_of: twin.id });
        /* paid or not, as tapped on the photo, goes over to the e-invoice
           that now counts — a photo set aside must not take the mark with it */
        const photo = isMer ? twin : now, einv = isMer ? now : twin;
        if (photo.paid_at && !einv.paid_at) await setFields(env, einv.id, { paid_at: photo.paid_at });
      }
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
  if (action === "uredi") {
    if (item.source !== "rucno") return reply(request, { error: "not_manual" }, 409);
    const m = cleanManual(b);
    if (m.error) return reply(request, { error: m.error }, 400);
    await setFields(env, id, m.fields);
    return reply(request, { ok: true, item: await readReceipt(env, id) });
  }
  if (action === "placeno") {
    /* "ne" says he unmarked it — a card receipt he still owes on stays unpaid */
    await setFields(env, id, { paid_at: b.paid === false ? "ne" : zagrebDate() });
    await logEvent(env, { who: b.by, receipt: item, action: b.paid === false ? "neplaceno" : "placeno" });
    return reply(request, { ok: true, item: await readReceipt(env, id) });
  }
  if (action === "nije_isti") {
    await setFields(env, id, { dup_of: null });
    return reply(request, { ok: true, item: await readReceipt(env, id) });
  }
  if (action === "ponovi") {
    if (item.status === "queued" || item.status === "working") return reply(request, { error: "busy" }, 409);
    if (item.source !== "foto" && item.status !== "failed") return reply(request, { error: "not_photo" }, 409);
    await setFields(env, id, { status: "queued", runs: 0, error: "" });
    const pumped = await pump(env);
    return reply(request, { ok: true, item: await readReceipt(env, id), pumped });
  }
  if (action === "obrisi") {
    if (item.status === "working") return reply(request, { error: "running" }, 409);
    await env.DB.prepare("DELETE FROM expense_photos WHERE receipt_id = ?1").bind(id).run();
    await env.DB.prepare("DELETE FROM expense_receipts WHERE id = ?1").bind(id).run();
    /* a photo set aside as this one's twin counts again */
    await env.DB.prepare("UPDATE expense_receipts SET dup_of = NULL WHERE dup_of = ?1").bind(id).run();
    return reply(request, { ok: true });
  }
  return reply(request, { error: "action" }, 404);
}

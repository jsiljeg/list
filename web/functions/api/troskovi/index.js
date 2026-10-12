/* /api/troskovi
 *   GET   (staff)  every receipt, newest first, without photos; plus the brakes.
 *   POST  (staff)  one receipt: 1–4 photos (multipart "photo"), "by";
 *                  or, as JSON, an expense with no receipt at all:
 *                  {vendor, doc_date, payment, items: [{name, total, category}], note, by}
 * A read also checks the moj-eRačun inbox (throttled, in the background). */
import { reply, isStaffAsync, newId, nowIso, clip, savePhotos, readReceipt, shape, pump, limits, cleanManual, MAX_PHOTOS } from "../../_lib/expenses.js";
import { merSync, merStatus } from "../../_lib/mer.js";

export async function onRequestGet({ request, env, waitUntil }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  if (waitUntil) waitUntil(merSync(env));
  const pumped = await pump(env);
  const { results } = await env.DB.prepare(
    `SELECT r.*, (SELECT GROUP_CONCAT(n) FROM expense_photos p WHERE p.receipt_id = r.id) AS pics
       FROM expense_receipts r ORDER BY COALESCE(r.doc_date, substr(r.created_at, 1, 10)) DESC, r.created_at DESC LIMIT 1500`).all();
  const items = (results || []).map((r) => shape(r, r.pics ? String(r.pics).split(",").map(Number) : []));
  return reply(request, { items, limits: await limits(env), pumped, mer: await merStatus(env) });
}

export async function onRequestPost({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const by = (v) => clip(v, 40).replace(/[^\p{L} .-]/gu, "");
  if ((request.headers.get("content-type") || "").includes("application/json")) {
    let b;
    try { b = await request.json(); } catch { return reply(request, { error: "body" }, 400); }
    const m = cleanManual(b);
    if (m.error) return reply(request, { error: m.error }, 400);
    const id = newId(), now = nowIso(), f = { ...m.fields, status: "done", source: "rucno" };
    const keys = Object.keys(f);
    await env.DB.prepare(`INSERT INTO expense_receipts (id, created_at, updated_at, created_by, ${keys.join(", ")})
                          VALUES (?1, ?2, ?2, ?3, ${keys.map((_, i) => `?${i + 4}`).join(", ")})`)
      .bind(id, now, by(b.by), ...keys.map((k) => f[k])).run();
    return reply(request, { ok: true, item: await readReceipt(env, id) }, 201);
  }
  let form;
  try { form = await request.formData(); } catch { return reply(request, { error: "body" }, 400); }
  const photos = form.getAll("photo").filter((f) => f && typeof f === "object" && f.size);
  if (!photos.length) return reply(request, { error: "no_photo" }, 400);
  if (photos.length > MAX_PHOTOS) return reply(request, { error: "too_many_photos" }, 400);
  const id = newId(), now = nowIso();
  await env.DB.prepare("INSERT INTO expense_receipts (id, created_at, updated_at, created_by, status, source) VALUES (?1, ?2, ?2, ?3, 'queued', 'foto')")
    .bind(id, now, by(form.get("by"))).run();
  const saved = await savePhotos(env, id, photos);
  if (saved.error) {
    await env.DB.prepare("DELETE FROM expense_photos WHERE receipt_id = ?1").bind(id).run();
    await env.DB.prepare("DELETE FROM expense_receipts WHERE id = ?1").bind(id).run();
    return reply(request, { error: saved.error }, 400);
  }
  const pumped = await pump(env);
  return reply(request, { ok: true, item: await readReceipt(env, id), pumped }, 201);
}

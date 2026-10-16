/* /api/troskovi
 *   GET   (staff)  receipts, newest first, without photos; plus the brakes.
 *                  ?offset=&limit= pages them (limit ≤ 150): a free Worker has
 *                  10 ms of CPU, and a whole year in one answer did not fit.
 *   POST  (staff)  one receipt: 1–4 photos (multipart "photo"), "by";
 *                  or, as JSON, an expense with no receipt at all:
 *                  {vendor, doc_date, payment, items: [{name, total, category}], note, by}
 * A read also checks the moj-eRačun inbox (throttled, in the background). */
import { reply, isStaffAsync, newId, nowIso, clip, savePhotos, readReceipt, shape, pump, limits, cleanManual, MAX_PHOTOS } from "../../_lib/expenses.js";
import { merSync, merStatus } from "../../_lib/mer.js";
import { cors } from "../../_lib/wines.js";

export async function onRequestGet({ request, env, waitUntil }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const url = new URL(request.url);
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset")) || 0));
  const limit = Math.min(150, Math.max(1, Math.floor(Number(url.searchParams.get("limit")) || 150)));
  /* the first page does the housekeeping; the rest only read */
  /* in the background, after the answer: they need nothing from it, and
     awaited they cost the first page ~1 s of one-at-a-time queries (2026-10-16) */
  if (!offset && waitUntil) { waitUntil(merSync(env)); waitUntil(pump(env)); }
  const pumped = offset || waitUntil ? null : await pump(env);
  /* the first page's totals, asked for together with the page */
  const extras = offset ? null : Promise.all([env.DB.prepare("SELECT COUNT(*) AS n FROM expense_receipts").first(), limits(env), merStatus(env)]);
  /* The page's ids first, sorted on narrow columns (idx_exp_order), then
     only those rows in full: sorting the whole table with every receipt's
     lines attached took ~1,5 s a page at 712 receipts (2026-10-16). */
  const { results } = await env.DB.prepare(
    `WITH page AS (SELECT id, COALESCE(doc_date, substr(created_at, 1, 10)) AS d, created_at AS c FROM expense_receipts
                    ORDER BY COALESCE(doc_date, substr(created_at, 1, 10)) DESC, created_at DESC, id LIMIT ?1 OFFSET ?2)
     SELECT r.*, (SELECT GROUP_CONCAT(n) FROM expense_photos p WHERE p.receipt_id = r.id) AS pics
       FROM page JOIN expense_receipts r ON r.id = page.id ORDER BY page.d DESC, page.c DESC, page.id`).bind(limit + 1, offset).all();
  const more = (results || []).length > limit;
  if (more) results.pop();
  /* Each receipt's lines are stored as JSON already; they go out as stored
     rather than parsed and serialised again. At 280 receipts the round trip
     ran the Worker over its CPU limit one read in three (error 1102,
     2026-10-12) — and a full year is ~700. */
  const parts = (results || []).map((r) => {
    const raw = typeof r.items === "string" && r.items[0] === "[" && r.items[r.items.length - 1] === "]" ? r.items : "[]";
    const s = shape({ ...r, items: null }, r.pics ? String(r.pics).split(",").map(Number) : []);
    s.items = 0;
    return JSON.stringify(s).replace('"items":0', '"items":' + raw);
  });
  /* the first page also says how many there are, so the app can ask for the
     rest all at once (2026-10-13: five pages one after another took ~5 s);
     the others carry only the page */
  const [count, lim, mer] = extras ? await extras : [];
  const tail = JSON.stringify(offset ? { more } : {
    more, total: (count || {}).n || 0, limits: lim, pumped, mer,
  }).slice(1);
  return new Response(`{"items":[${parts.join(",")}],${tail}`, {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(request) } });
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

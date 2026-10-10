/* /api/vina — the new-wine inbox.
 *
 *   GET   (staff or worker)  every request, newest first, plus the brakes' state
 *   POST  (staff)            a new request: multipart form with
 *                              photo (1–3 files), price_bottle, price_glass,
 *                              vol (litres, blank = 0,75), recommended ("1"),
 *                              remark (a short note from Filho, ≤ 300 chars)
 *
 * A staff GET also pumps the queue — see pump() in _lib/wines.js. */
import { reply, isStaffAsync, isWorker, isReader, newId, savePhotos, readRequest, shape, pump, limits,
         euros, clip, person, setPerson } from "../../_lib/wines.js";

export async function onRequestGet({ request, env }) {
  const staff = await isStaffAsync(request, env);
  if (!staff && !isWorker(request, env) && !isReader(request, env)) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const pumped = staff ? await pump(env) : null;
  const { results } = await env.DB.prepare(
    `SELECT r.*, (SELECT GROUP_CONCAT(n) FROM wine_photos p WHERE p.request_id = r.id) AS pics,
            w.created_by, w.published_by
       FROM wine_requests r LEFT JOIN wine_people w ON w.request_id = r.id
      ORDER BY r.created_at DESC LIMIT 100`).all();
  const items = (results || []).map((r) => shape(r, r.pics ? String(r.pics).split(",").map(Number) : []));
  return reply(request, { items, limits: await limits(env), pumped });
}

export async function onRequestPost({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  let form;
  try { form = await request.formData(); } catch { return reply(request, { error: "body" }, 400); }

  const bottle = euros(form.get("price_bottle")), glass = euros(form.get("price_glass"));
  if (Number.isNaN(bottle) || Number.isNaN(glass)) return reply(request, { error: "price" }, 400);
  if (bottle == null && glass == null) return reply(request, { error: "no_price" }, 400);
  const volRaw = clip(form.get("vol"), 10).replace(",", ".");
  const vol = volRaw ? Number(volRaw) : null;
  if (vol != null && !(vol > 0 && vol <= 18)) return reply(request, { error: "vol" }, 400);
  const photos = form.getAll("photo").filter((f) => f && typeof f === "object" && f.size);
  if (!photos.length) return reply(request, { error: "no_photo" }, 400);
  if (photos.length > 3) return reply(request, { error: "too_many_photos" }, 400);

  const id = newId(), now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO wine_requests (id, created_at, updated_at, status, price_bottle, price_glass, vol, recommended, remark, runs)
     VALUES (?1, ?2, ?2, 'queued', ?3, ?4, ?5, ?6, ?7, 0)`)
    .bind(id, now, bottle, glass, vol, form.get("recommended") === "1" ? 1 : 0, clip(form.get("remark"), 300)).run();
  const saved = await savePhotos(env, id, photos);
  if (saved.error) {
    await env.DB.prepare("DELETE FROM wine_photos WHERE request_id = ?1").bind(id).run();
    await env.DB.prepare("DELETE FROM wine_requests WHERE id = ?1").bind(id).run();
    return reply(request, { error: saved.error }, 400);
  }
  await setPerson(env, id, "created_by", person(form.get("by")));
  const pumped = await pump(env);
  return reply(request, { ok: true, item: await readRequest(env, id), pumped }, 201);
}

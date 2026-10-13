/* /api/kuhinja/citaj — "Dnevna ponuda" from /admin (see _lib/daily-intake.js).
 *
 *   GET   (staff or worker)  requests of the last 3 service days + the brakes
 *   POST  (staff)            multipart: photo (0–3), text (the menu, pasted),
 *                            remark, date (default: today's service day), by
 *
 * A staff GET also pumps the queue. */
import { reply, isStaffAsync, isWorker } from "../../../_lib/wines.js";
import { isDate } from "../../../_lib/daily.js";
import { today, newId, clip, person, shape, storePhoto, pump, limits, MAX_PHOTOS } from "../../../_lib/daily-intake.js";

export async function onRequestGet({ request, env }) {
  const staff = await isStaffAsync(request, env);
  if (!staff && !isWorker(request, env)) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const pumped = staff ? await pump(env) : null;
  const since = new Date(Date.parse(today() + "T12:00:00Z") - 2 * 86400e3).toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(
    "SELECT * FROM daily_requests WHERE date >= ?1 ORDER BY created_at DESC LIMIT 30").bind(since).all();
  return reply(request, { today: today(), items: (results || []).map(shape), limits: await limits(env), pumped });
}

export async function onRequestPost({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  let form;
  try { form = await request.formData(); } catch { return reply(request, { error: "body" }, 400); }
  const date = isDate(form.get("date")) ? form.get("date") : today();
  const text = clip(form.get("text"), 4000);
  const files = form.getAll("photo").filter((f) => f && typeof f === "object" && f.size);
  if (files.length > MAX_PHOTOS) return reply(request, { error: "too_many_photos" }, 400);
  if (!files.length && !text) return reply(request, { error: "empty_menu" }, 400);
  const photos = [];
  for (const f of files) {
    const s = await storePhoto(env, date, f);
    if (s.error) return reply(request, { error: s.error }, 400);
    photos.push(s.id);
  }
  const id = newId(), now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO daily_requests (id, date, created_at, updated_at, status, text, remark, photos, runs, created_by)
     VALUES (?1, ?2, ?3, ?3, 'queued', ?4, ?5, ?6, 0, ?7)`)
    .bind(id, date, now, text, clip(form.get("remark"), 300), JSON.stringify(photos), person(form.get("by")) || null).run();
  const pumped = await pump(env);
  return reply(request, { ok: true, id, pumped }, 201);
}

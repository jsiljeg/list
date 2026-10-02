/* POST /api/kuhinja/media?date=YYYY-MM-DD — upload one photo.
 *
 * The body is the image itself (the staff page has already shrunk it to
 * ~1600px WebP/JPEG in the browser). The id is the SHA-256 of the bytes, so
 * uploading the same photo twice stores it once, and /media/<id> can be cached
 * for ever. 1.5 MB cap: D1 rows top out at 2 MB, and a phone photo that is
 * still this big after resizing was not resized. */
import { json, isDate, isStaff, denied } from "../../_lib/daily.js";

const TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif"];
const MAX = 1_500_000;

export async function onRequestPost({ request, env }) {
  if (!isStaff(request, env)) return denied(env);
  if (!env.DB) return json({ error: "no_db" }, 503);
  const q = new URL(request.url).searchParams;
  const date = q.get("date");
  if (!isDate(date)) return json({ error: "date" }, 400);
  const mime = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (!TYPES.includes(mime)) return json({ error: "type" }, 415);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return json({ error: "empty" }, 400);
  if (bytes.byteLength > MAX) return json({ error: "too_big", max: MAX }, 413);
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const w = Number(q.get("w")) || null, h = Number(q.get("h")) || null;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO media (id, date, mime, width, height, bytes, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(hash, date, mime, w, h, bytes, new Date().toISOString()).run();
  return json({ ok: true, id: hash, url: `/media/${hash}` }, 201);
}

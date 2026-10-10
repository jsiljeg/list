/* GET /api/vina/:id/foto/:n — one label photo (staff or worker).
   Not under the public /media/ route on purpose: these are working material,
   not something the site publishes. */
import { reply, isStaffAsync, isWorker, isReader, cors } from "../../../../_lib/wines.js";

export async function onRequestGet({ request, env, params }) {
  if (!isWorker(request, env) && !isReader(request, env) && !(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  const row = await env.DB.prepare("SELECT mime, bytes FROM wine_photos WHERE request_id = ?1 AND n = ?2")
    .bind(params.id, Number(params.n)).first();
  if (!row) return reply(request, { error: "not_found" }, 404);
  /* Production D1 hands a BLOB back as an array of numbers, local D1 as an
     ArrayBuffer. Passing the array straight to Response served 0 bytes live
     (2026-10-10, the first real run: "datoteka je prazna") while every local
     test passed. Same handling as functions/media/[id].js. */
  const body = row.bytes instanceof ArrayBuffer ? row.bytes : new Uint8Array(row.bytes);
  return new Response(body, { headers: { "content-type": row.mime, "cache-control": "private, max-age=3600", ...cors(request) } });
}

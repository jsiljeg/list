/* GET /api/vina/:id/foto/:n — one label photo (staff or worker).
   Not under the public /media/ route on purpose: these are working material,
   not something the site publishes. */
import { reply, isStaffAsync, isWorker, isReader, cors } from "../../../../_lib/wines.js";

export async function onRequestGet({ request, env, params }) {
  if (!isWorker(request, env) && !isReader(request, env) && !(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  const row = await env.DB.prepare("SELECT mime, bytes FROM wine_photos WHERE request_id = ?1 AND n = ?2")
    .bind(params.id, Number(params.n)).first();
  if (!row) return reply(request, { error: "not_found" }, 404);
  return new Response(row.bytes, { headers: { "content-type": row.mime, "cache-control": "private, max-age=3600", ...cors(request) } });
}

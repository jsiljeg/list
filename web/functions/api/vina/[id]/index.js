/* GET /api/vina/:id — one request (staff or worker). */
import { reply, isStaff, isWorker, readRequest } from "../../../_lib/wines.js";

export async function onRequestGet({ request, env, params }) {
  if (!isStaff(request, env) && !isWorker(request, env)) return reply(request, { error: "key" }, 401);
  const item = await readRequest(env, params.id);
  return item ? reply(request, { item }) : reply(request, { error: "not_found" }, 404);
}

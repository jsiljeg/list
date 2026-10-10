/* GET /api/vina/:id — one request (staff or worker). */
import { reply, isStaffAsync, isWorker, isReader, readRequest } from "../../../_lib/wines.js";

export async function onRequestGet({ request, env, params }) {
  if (!isWorker(request, env) && !isReader(request, env) && !(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  const item = await readRequest(env, params.id);
  return item ? reply(request, { item }) : reply(request, { error: "not_found" }, 404);
}

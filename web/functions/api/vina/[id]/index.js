/* GET /api/vina/:id — one request (staff or worker). */
import { reply, isWorker, isReader, readRequest } from "../../../_lib/wines.js";
import { staffOrSomm, forRole } from "../../../_lib/roles.js";

export async function onRequestGet({ request, env, params }) {
  const machine = isWorker(request, env) || isReader(request, env);
  const a = machine ? null : await staffOrSomm(request, env);   /* full or somm (web/ROLES.md) */
  if (!machine && !a) return reply(request, { error: "key" }, 401);
  const item = await readRequest(env, params.id);
  return item ? reply(request, { item: forRole(item, a) }) : reply(request, { error: "not_found" }, 404);
}

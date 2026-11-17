/* GET /api/kuhinja/citaj/:id — one request (staff or worker). */
import { reply, isWorker } from "../../../../_lib/wines.js";
import { readReq } from "../../../../_lib/daily-intake.js";
import { staffOrSomm, forRole } from "../../../../_lib/roles.js";

export async function onRequestGet({ request, env, params }) {
  const a = isWorker(request, env) ? null : await staffOrSomm(request, env);   /* full or somm (web/ROLES.md) */
  if (!a && !isWorker(request, env)) return reply(request, { error: "key" }, 401);
  const item = await readReq(env, params.id);
  return item ? reply(request, { item: forRole(item, a) }) : reply(request, { error: "not_found" }, 404);
}

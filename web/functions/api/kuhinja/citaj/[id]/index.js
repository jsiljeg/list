/* GET /api/kuhinja/citaj/:id — one request (staff or worker). */
import { reply, isStaffAsync, isWorker } from "../../../../_lib/wines.js";
import { readReq } from "../../../../_lib/daily-intake.js";

export async function onRequestGet({ request, env, params }) {
  if (!isWorker(request, env) && !(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  const item = await readReq(env, params.id);
  return item ? reply(request, { item }) : reply(request, { error: "not_found" }, 404);
}

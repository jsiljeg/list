/* DELETE /api/kuhinja/media/<id> — remove a photo that is in no offer.
 *
 * Refuses while any offer still references it: a published page pointing at
 * a deleted photo shows a broken image to guests, and the staff page only
 * removes a photo from the *offer* — this is the tidy-up after that. */
import { json, isStaff, denied } from "../../../_lib/daily.js";

export async function onRequestDelete({ request, env, params }) {
  if (!isStaff(request, env)) return denied(env);
  const id = String(params.id || "");
  if (!/^[a-f0-9]{16,64}$/.test(id)) return json({ error: "id" }, 400);
  const used = await env.DB.prepare("SELECT date FROM daily_offers WHERE instr(body, ?1) > 0 LIMIT 1").bind(id).first();
  if (used) return json({ error: "in_use", date: used.date }, 409);
  await env.DB.prepare("DELETE FROM media WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

/* POST /api/vina/test-obavijest (staff) — sends one test alert to the owner's
   phone and says exactly what ntfy answered. Added 2026-10-10 when the first
   real run's alerts never arrived; kept so "do alerts work?" is one tap. */
import { reply, isStaffAsync, notifyOwner } from "../../_lib/wines.js";

export async function onRequestPost({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  const r = await notifyOwner(env, "Novo vino: test obavijesti", "Ako ovo vidite na mobitelu, obavijesti rade.");
  return reply(request, r || { sent: false, why: "no result" });
}

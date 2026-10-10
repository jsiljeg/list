/* POST /api/vina/test-obavijest (staff) — sends one test alert to the owner's
   phone and says exactly what ntfy answered. Added 2026-10-10 when the first
   real run's alerts never arrived; kept so "do alerts work?" is one tap. */
import { reply, isStaffAsync, notifyOwner } from "../../_lib/wines.js";

export async function onRequestPost({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  const r = await notifyOwner(env, "Novo vino: test obavijesti", "Ako ovo vidite na mobitelu, obavijesti rade.");
  /* What was sent, without the secret itself: whether a token exists and
     its kind (ntfy access tokens start "tk_"). */
  const tok = String(env.NTFY_TOKEN || "");
  return reply(request, { ...(r || { sent: false, why: "no result" }),
    token: tok ? `${tok.slice(0, 3)}… (${tok.length} chars)` : "none" });
}

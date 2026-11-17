/* GET /api/dnevnik — who did what in Dodaj vino and Ponuda (full keys only).
 *
 * Filho's Povijest reads this beside the git history (Karta) and Troškovi's
 * own log. Owner, 2026-11-17: "we need to see his activities in history, but
 * he should not see any history" — so ACCESS gives this to "full" alone, the
 * middleware refuses a sommelier key before it gets here, and isStaffAsync()
 * below refuses it again. ?limit= (default 200, at most 500). */
import { reply, cors, isStaffAsync } from "../_lib/wines.js";

export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: cors(request) });

export async function onRequestGet({ request, env }) {
  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);
  if (!env.DB) return reply(request, { error: "no_db" }, 503);
  const limit = Math.min(500, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 200));
  const { results } = await env.DB.prepare(
    "SELECT at, who, role, area, what, ref FROM staff_log ORDER BY at DESC, id DESC LIMIT ?1").bind(limit).all();
  return reply(request, { events: results || [] });
}

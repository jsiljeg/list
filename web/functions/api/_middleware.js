/* The first lock in front of every /api function (web/ROLES.md §3.2).
 *
 * A request that carries a sommelier key ("somm_…") goes on only to a route
 * and method that ACCESS in _lib/roles.js gives "somm" — Karta, Dodaj vino,
 * Ponuda. Anything else, Troškovi, Prihodi and Povijest above all, and any
 * endpoint added later without a line in ACCESS, is refused here with
 * {"error":"role"} and the function never runs. An unknown somm key is
 * refused outright. Every other request passes untouched: this changes
 * nothing for Filho, the guests or the machine keys.
 *
 * The second lock is in the functions themselves (isStaffAsync is full-only),
 * so neither lock alone is what keeps him out. */
import { bearer, isSommShaped, sommMay, sommWho } from "../_lib/roles.js";
import { cors } from "../_lib/wines.js";

const refuse = (request, error, status) => new Response(JSON.stringify({ error }), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(request) },
});

export async function onRequest({ request, env, next }) {
  if (request.method === "OPTIONS") return next();
  const t = bearer(request);
  /* Anything that looks like a sommelier key in any shape — also one that
     is not quite well-formed — is held to the sommelier's rules. */
  if (!/^somm_/i.test(t)) return next();
  if (!isSommShaped(t) || !(await sommWho(t, env))) return refuse(request, "key", 401);
  if (!sommMay(request.method, new URL(request.url).pathname)) return refuse(request, "role", 403);
  return next();
}

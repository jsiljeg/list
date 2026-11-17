/* GET /api/uloga — who is this key? (web/ROLES.md)
 *
 * The page asks before it draws a single tab when it holds a sommelier key:
 * {role: "somm", who: "Toni", print} builds Karta, Dodaj vino and Ponuda and
 * nothing else; anything but a 200 builds nothing. A full key answers
 * {role: "full"}; Filho's page does not need to ask, and does not.
 * `print` is the first 16 hex of the key's SHA-256, for the owner to read
 * off the screen — never the key. */
import { reply, cors } from "../_lib/wines.js";
import { staffOrSomm, bearer, sha256hex } from "../_lib/roles.js";

export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: cors(request) });

export async function onRequestGet({ request, env }) {
  const a = await staffOrSomm(request, env);
  if (!a) return reply(request, { error: "key" }, 401);
  const print = (await sha256hex(bearer(request))).slice(0, 16);
  return reply(request, a.role === "somm" ? { role: "somm", who: a.who, print } : { role: "full", print });
}

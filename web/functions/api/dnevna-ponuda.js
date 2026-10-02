/* GET /api/dnevna-ponuda — the published daily offer as JSON.
 *
 * The feed the wine list will read for "Filhov izbor" (see DAILY-OFFER.md),
 * and anything else that wants the day's dishes: a screen in the window, a
 * newsletter. CORS is open because it serves only what the public page shows.
 *
 * Only the current service day (rolls over 03:00 UTC — today() in
 * _lib/daily.js); there is no date parameter, because a past offer is sold
 * out and must not reach a guest from anywhere.
 *
 * Returns { offer: null } rather than a 404 on a day with nothing published,
 * so a consumer has one shape to handle. `rollover` tells a consumer (the wine
 * list) when this answer stops being true. */
import { json, today, readOffer, loadShelf, resolveOffer, ROLLOVER_UTC_HOUR } from "../_lib/daily.js";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestGet({ request, env }) {
  const date = today();
  const offer = await readOffer(env, date);
  const headers = { ...CORS, "cache-control": "public, max-age=60" };
  const rollover = ROLLOVER_UTC_HOUR;
  if (!offer || offer.status !== "published") return json({ date, rollover, offer: null }, 200, headers);
  const shelf = await loadShelf(env).catch((e) => { console.error("wine list unreachable", e?.message); return null; });
  return json({ date, rollover, offer: resolveOffer(offer, shelf) }, 200, headers);
}

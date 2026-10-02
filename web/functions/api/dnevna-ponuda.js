/* GET /api/dnevna-ponuda — the published daily offer as JSON.
 *
 * The feed the wine list will read for "Filhov izbor" (see DAILY-OFFER.md),
 * and anything else that wants the day's dishes: a screen in the window, a
 * newsletter. CORS is open because it serves only what the public page shows.
 *
 *   ?date=YYYY-MM-DD   a given day (default: today, Zagreb)
 *
 * Returns { offer: null } rather than a 404 on a day with nothing published,
 * so a consumer has one shape to handle. Never yesterday's offer in place of
 * today's: those dishes are sold out. */
import { json, today, isDate, readOffer, loadShelf, resolveOffer } from "../_lib/daily.js";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const date = isDate(q.get("date")) ? q.get("date") : today();
  const offer = await readOffer(env, date);
  const headers = { ...CORS, "cache-control": "public, max-age=60" };
  if (!offer || offer.status !== "published") return json({ date, offer: null }, 200, headers);
  const shelf = await loadShelf(env).catch((e) => { console.error("wine list unreachable", e?.message); return null; });
  return json({ date, offer: resolveOffer(offer, shelf) }, 200, headers);
}

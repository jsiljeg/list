/* GET /api/availability?date=YYYY-MM-DD&covers=2
 *
 * Returns the slots that can still take this party. All the deciding happens
 * in src/lib/booking.mjs; this only fetches the day's rows and hands them over.
 *
 * The answer is advisory. It can be stale by the time the guest submits, which
 * is why /api/reservations re-checks atomically rather than trusting this. */

import { availableSlots, isValidDate, CONFIG, nowInZagreb, addDays } from "../../src/lib/booking.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      /* Short cache: a slot list is worth a few seconds of edge cache on a busy
         evening, but not more — it goes stale as people book. */
      "cache-control": "public, max-age=15",
    },
  });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "";
  const covers = Number(url.searchParams.get("covers") || 2);

  if (!isValidDate(date)) return json({ error: "date" }, 400);
  if (!Number.isInteger(covers) || covers < CONFIG.minParty || covers > CONFIG.maxParty)
    return json({ error: "covers", maxParty: CONFIG.maxParty }, 400);

  const now = nowInZagreb();
  if (date < now.date || date > addDays(now.date, CONFIG.horizonDays))
    return json({ date, covers, slots: [] });

  if (!env.DB) {
    /* No binding yet (local `astro dev`, or before D1 is attached). Show the
       shape of a full day rather than pretending the restaurant is booked. */
    return json({ date, covers, slots: availableSlots({ date, covers, now }), unbound: true });
  }

  const [booked, blackouts] = await Promise.all([
    env.DB.prepare(
      "SELECT start_min AS start, turn_min AS turn, covers FROM reservations WHERE date = ? AND status = 'confirmed'"
    ).bind(date).all(),
    env.DB.prepare(
      "SELECT start_min AS start, end_min AS end FROM blackouts WHERE date = ?"
    ).bind(date).all(),
  ]);

  const slots = availableSlots({
    date,
    covers,
    booked: booked.results ?? [],
    blackouts: blackouts.results ?? [],
    now,
  });

  return json({ date, covers, slots });
}

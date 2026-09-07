/* POST /api/reservations — takes a booking.
 *
 * This is a reservation, not a request: it comes back confirmed or it comes
 * back refused, and the guest never waits on a human.
 *
 * THE RACE IS THE WHOLE PROBLEM. Two people can be looking at the last two
 * seats at 20:00. Checking availability in JavaScript and then inserting is a
 * check-then-act with a gap in the middle, and on a Saturday that gap is where
 * the double-booking happens. So the capacity test is part of the INSERT: the
 * conditional INSERT ... SELECT ... WHERE below either writes one row or
 * writes nothing, atomically, and `meta.changes` says which. A loser gets a
 * 409 and a fresh slot list rather than a table that does not exist. */

import { validate, toMin, CONFIG, nowInZagreb, addDays, isValidDate } from "../../src/lib/booking.mjs";
import { sendGuestConfirmation, sendHouseNotice } from "../_lib/mail.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = request.headers.get("content-type")?.includes("application/json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return json({ error: "body" }, 400);
  }

  const covers = Number(body.covers);
  const input = {
    date: String(body.date || ""),
    time: String(body.time || ""),
    covers,
    name: String(body.name || "").trim().slice(0, 120),
    email: String(body.email || "").trim().slice(0, 200),
    phone: String(body.phone || "").trim().slice(0, 40),
    note: String(body.note || "").trim().slice(0, 1000),
    consentPrivacy: body.consentPrivacy === true || body.consentPrivacy === "yes" || body.privacy === "yes",
    marketing: body.newsletter === "yes" || body.newsletter === true,
    locale: /^[a-z]{2}$/.test(String(body.locale || "")) ? String(body.locale) : "hr",
  };

  const errors = validate(input);
  if (errors.length) return json({ error: "invalid", fields: errors }, 400);

  const now = nowInZagreb();
  if (input.date < now.date || input.date > addDays(now.date, CONFIG.horizonDays))
    return json({ error: "outside-horizon" }, 400);

  const start = toMin(input.time);
  const turn = CONFIG.turnMinutes(covers);
  const end = start + turn;

  if (input.date === now.date && start < now.minutes + CONFIG.leadMinutes)
    return json({ error: "too-soon", leadMinutes: CONFIG.leadMinutes }, 409);

  if (!env.DB) return json({ error: "no-database" }, 503);

  /* A blackout closes the day or a window of it. Checked separately because a
     closure is not a capacity question and deserves its own message. */
  const black = await env.DB.prepare(
    `SELECT 1 FROM blackouts WHERE date = ?
       AND COALESCE(start_min, 0) < ? AND COALESCE(end_min, 1440) > ? LIMIT 1`
  ).bind(input.date, end, start).first();
  if (black) return json({ error: "closed" }, 409);

  const id = crypto.randomUUID();
  const cancelToken = crypto.randomUUID().replace(/-/g, "");
  const createdAt = new Date().toISOString();

  /* The atomic part. Both capacity rules are evaluated inside the statement,
     against the same snapshot the row is written into. */
  const res = await env.DB.prepare(
    `INSERT INTO reservations
       (id, created_at, date, start_min, turn_min, covers, name, email, phone, note,
        status, cancel_token, consent_privacy_at, consent_marketing_at, locale, source)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
            'confirmed', ?11, ?2, ?12, ?13, 'web'
     WHERE (
       SELECT COALESCE(SUM(covers), 0) FROM reservations
        WHERE date = ?3 AND status = 'confirmed'
          AND start_min < ?14 AND start_min + turn_min > ?4
     ) + ?6 <= ?15
       AND (
       SELECT COALESCE(SUM(covers), 0) FROM reservations
        WHERE date = ?3 AND status = 'confirmed' AND start_min = ?4
     ) + ?6 <= ?16`
  ).bind(
    id, createdAt, input.date, start, turn, covers,
    input.name, input.email, input.phone || null, input.note || null,
    cancelToken, input.marketing ? createdAt : null, input.locale,
    end, CONFIG.capacity, CONFIG.pacing
  ).run();

  if (!res.meta || res.meta.changes !== 1) {
    /* Someone took it in the seconds between loading the slots and pressing
       send. Say so plainly and let the page refresh its list. */
    return json({ error: "slot-taken" }, 409);
  }

  /* Email must never fail the booking: the table is held either way, and a
     guest seeing an error after their seat was taken is the worst outcome. */
  const origin = new URL(request.url).origin;
  try {
    await Promise.all([
      sendGuestConfirmation(env, { ...input, id, start, cancelToken, origin }),
      sendHouseNotice(env, { ...input, id, start }),
    ]);
  } catch (err) {
    console.error("reservation mail failed", id, err?.message);
  }

  return json({
    ok: true,
    id,
    date: input.date,
    time: input.time,
    covers,
    cancelUrl: `${origin}/otkazivanje/?t=${cancelToken}`,
  }, 201);
}

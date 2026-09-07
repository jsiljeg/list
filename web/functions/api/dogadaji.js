/* POST /api/dogadaji — a private-event enquiry.
 *
 * Deliberately not a booking. A private event is a conversation: the date may
 * be vague, the headcount is a guess, and what is actually being asked is
 * whether the room can do the thing at all. So this stores the enquiry, mails
 * the house, and acknowledges the guest — it never promises availability,
 * because nobody can promise it at this point.
 *
 * That is also why it does not touch the reservations table or the capacity
 * rules: an enquiry consumes no covers and blocks no slot. */

import { sendEnquiryAck, sendEnquiryNotice } from "../_lib/mail.js";

const json = (b, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = request.headers.get("content-type")?.includes("application/json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch { return json({ error: "body" }, 400); }

  const input = {
    name: clean(body.name, 120),
    email: clean(body.email, 200),
    phone: clean(body.phone, 40),
    company: clean(body.company, 160),
    kind: clean(body.kind, 40),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? String(body.date) : "",
    guests: Number.isFinite(Number(body.guests)) ? Math.max(0, Math.min(400, Number(body.guests))) : null,
    message: clean(body.message, 2000),
    consent: body.consentPrivacy === true || body.consentPrivacy === "yes",
    locale: /^[a-z]{2}$/.test(String(body.locale || "")) ? String(body.locale) : "hr",
  };

  const errors = [];
  if (input.name.length < 2) errors.push("name");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) errors.push("email");
  if (!input.consent) errors.push("consent");
  if (errors.length) return json({ error: "invalid", fields: errors }, 400);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (env.DB) {
    await env.DB.prepare(
      `INSERT INTO event_enquiries
        (id, created_at, name, email, phone, company, kind, date, guests, message,
         status, consent_privacy_at, locale)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'new',?2,?11)`
    ).bind(id, createdAt, input.name, input.email, input.phone || null,
           input.company || null, input.kind || null, input.date || null,
           input.guests, input.message || null, input.locale).run();
  }

  /* Mail must not fail the enquiry: it is already stored, and telling someone
     their message failed when it did not is worse than a missing email. */
  try {
    await Promise.all([
      sendEnquiryNotice(env, { ...input, id }),
      sendEnquiryAck(env, input),
    ]);
  } catch (e) {
    console.error("enquiry mail failed", id, e?.message);
  }

  return json({ ok: true, id }, 201);
}

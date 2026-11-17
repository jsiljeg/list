/* /api/kuhinja/ponuda — the staff side of the daily offer.
 *
 *   GET    ?date=        the day's offer including a draft, as stored
 *   PUT    {date, status, ...offer}   save (draft or published) — whole document
 *   DELETE ?date=        remove the day's offer (its photos stay until pruned)
 *
 * Every write goes through normalizeOffer(), so whatever the page sends, what
 * is stored has one shape. */
import { json, isDate, today, denied, normalizeOffer, readOffer, recentPublished } from "../../_lib/daily.js";
import { staffOrSomm, logStaff } from "../../_lib/roles.js";   /* full or somm (web/ROLES.md) */

export async function onRequestGet({ request, env }) {
  const a = await staffOrSomm(request, env);
  if (!a) return denied(env);
  const q = new URL(request.url).searchParams;
  const date = isDate(q.get("date")) ? q.get("date") : today();
  const [offer, recent] = await Promise.all([readOffer(env, date), recentPublished(env, 30)]);
  return json({ date, offer, recent });
}

export async function onRequestPut({ request, env }) {
  const a = await staffOrSomm(request, env);
  if (!a) return denied(env);
  if (!env.DB) return json({ error: "no_db" }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "body" }, 400); }
  if (!isDate(b.date)) return json({ error: "date" }, 400);
  const status = b.status === "published" ? "published" : "draft";
  const body = normalizeOffer(b);
  if (status === "published" && !body.dishes.length) return json({ error: "no_dishes" }, 400);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO daily_offers (date, status, body, updated_at, published_at)
     VALUES (?1, ?2, ?3, ?4, CASE WHEN ?2 = 'published' THEN ?4 END)
     ON CONFLICT(date) DO UPDATE SET
       status = excluded.status, body = excluded.body, updated_at = excluded.updated_at,
       published_at = CASE WHEN excluded.status = 'published'
                           THEN COALESCE(daily_offers.published_at, excluded.updated_at) END`
  ).bind(b.date, status, JSON.stringify(body), now).run();
  await logStaff(env, a, b.by, "ponuda", `${status === "published" ? "Objavio" : "Spremio"} dnevnu ponudu za ${b.date} (${body.dishes.length} jela)`, b.date);
  return json({ ok: true, date: b.date, status, updatedAt: now, offer: { date: b.date, status, ...body } });
}

export async function onRequestDelete({ request, env }) {
  const a = await staffOrSomm(request, env);
  if (!a) return denied(env);
  const date = new URL(request.url).searchParams.get("date");
  if (!isDate(date)) return json({ error: "date" }, 400);
  await env.DB.prepare("DELETE FROM daily_offers WHERE date = ?1").bind(date).run();
  await logStaff(env, a, "", "ponuda", `Obrisao dnevnu ponudu za ${date}`, date);
  return json({ ok: true });
}

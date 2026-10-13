/* POST /api/kuhinja/citaj/:id/<action>
 *
 *   stanje    (worker)  the run reports: working | ready | failed, with
 *                       run_url / result {offer, notes, dropped} / usage / error.
 *   objavi    (staff)   {offer, by}: the previewed offer, with Filho's prices
 *                       and removals, goes live — normalizeOffer() into
 *                       daily_offers, status published. Replaces whatever was
 *                       published that day, keeping its market photos, video
 *                       and intro when the new one has none.
 *   ponovi    (staff)   failed/ready → queued again, {remark} optional
 *   odustani  (staff)   anything not published → cancelled */
import { reply, isStaffAsync, isWorker, notifyOwner } from "../../../../_lib/wines.js";
import { normalizeOffer, readOffer, today } from "../../../../_lib/daily.js";
import { readReq, setReq, pump, clip, person } from "../../../../_lib/daily-intake.js";

const WORKER_MOVES = { working: ["working", "ready", "failed"] };

export async function onRequestPost({ request, env, params }) {
  const { id, action } = params;
  const item = await readReq(env, id);
  if (!item) return reply(request, { error: "not_found" }, 404);

  if (action === "stanje") {
    if (!isWorker(request, env)) return reply(request, { error: "key" }, 401);
    let b;
    try { b = await request.json(); } catch { return reply(request, { error: "body" }, 400); }
    if (!(WORKER_MOVES[item.status] || []).includes(b.status)) return reply(request, { error: "move", from: item.status, to: b.status }, 409);
    const f = { status: b.status };
    if (b.run_url) f.run_url = clip(b.run_url, 300);
    f.error = b.status === "failed" ? clip(b.error || "", 1000) : "";
    if (b.usage) f.usage = JSON.stringify(b.usage).slice(0, 2000);
    if (b.result) {
      const offer = normalizeOffer(b.result.offer || {});
      const r = JSON.stringify({ offer, notes: clip(b.result.notes, 3000),
        dropped: (Array.isArray(b.result.dropped) ? b.result.dropped : []).slice(0, 40).map((x) => clip(x, 300)) });
      if (r.length > 200000) return reply(request, { error: "result_too_big" }, 413);
      f.result = r;
    }
    await setReq(env, id, f);
    if (b.status === "ready") await notifyOwner(env, "Dnevna ponuda: spremna za pregled", `${item.date} — Filho je može objaviti u /admin.`, b.run_url || item.run_url);
    if (b.status === "failed") await notifyOwner(env, "Dnevna ponuda: nije uspjelo", `${item.date}: ${f.error}`, b.run_url || item.run_url);
    if (b.status !== "working") await pump(env);
    return reply(request, { ok: true });
  }

  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);

  if (action === "objavi") {
    if (!["ready", "published"].includes(item.status)) return reply(request, { error: "not_ready" }, 409);
    /* An offer lives for its service day only (03:00 UTC rollover). Publishing
       yesterday's preview would write a day nobody can see any more. */
    if (item.date !== today()) return reply(request, { error: "stale" }, 409);
    let b;
    try { b = await request.json(); } catch { return reply(request, { error: "body" }, 400); }
    const body = normalizeOffer(b.offer || (item.result && item.result.offer) || {});
    if (!body.dishes.length) return reply(request, { error: "no_dishes" }, 400);
    const prev = await readOffer(env, item.date);
    if (prev) {
      if (!body.photos.length) body.photos = prev.photos || [];
      if (!body.video) body.video = prev.video || "";
      if (!Object.keys(body.intro).length) body.intro = prev.intro || {};
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO daily_offers (date, status, body, updated_at, published_at)
       VALUES (?1, 'published', ?2, ?3, ?3)
       ON CONFLICT(date) DO UPDATE SET status = 'published', body = excluded.body, updated_at = excluded.updated_at,
         published_at = COALESCE(daily_offers.published_at, excluded.updated_at)`)
      .bind(item.date, JSON.stringify(body), now).run();
    /* One live request per day: an older one stops claiming to be on the site. */
    await env.DB.prepare("UPDATE daily_requests SET status = 'ready' WHERE date = ?1 AND status = 'published' AND id != ?2")
      .bind(item.date, id).run();
    await setReq(env, id, { status: "published", published_by: person(b.by) || null,
      result: JSON.stringify({ ...(item.result || {}), offer: body }) });
    return reply(request, { ok: true, item: await readReq(env, id) });
  }

  if (action === "ponovi") {
    if (!["failed", "ready"].includes(item.status)) return reply(request, { error: "not_failed" }, 409);
    const b = await request.json().catch(() => ({}));
    const f = { status: "queued", error: "" };
    if (b && b.remark) f.remark = clip(b.remark, 300);
    await setReq(env, id, f);
    return reply(request, { ok: true, item: await readReq(env, id), pumped: await pump(env) });
  }

  if (action === "odustani") {
    if (["published", "cancelled"].includes(item.status)) return reply(request, { error: "too_late" }, 409);
    if (item.status === "working") return reply(request, { error: "running" }, 409);
    await setReq(env, id, { status: "cancelled" });
    return reply(request, { ok: true, item: await readReq(env, id) });
  }

  return reply(request, { error: "action" }, 404);
}

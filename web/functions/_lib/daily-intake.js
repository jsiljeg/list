/* "Dnevna ponuda" from /admin — the inbox behind it (2026-10-13).
 *
 * Filho sends the day's menu the way he already makes it: a photo of the
 * graphic, or the text pasted. A GitHub Actions run (daily-offer.yml) reads it
 * with the sommelier skill and writes the whole offer — names in 8 languages,
 * food tags, 1–3 wines a dish — and the result waits here as a preview. Only
 * his "Objavi" writes it into daily_offers, through the same normalizeOffer()
 * as /kuhinja/, so the website and the wine list's sommelier get it at once.
 *
 * The brakes are the wine intake's, for the same reason (the owner's Claude
 * subscription is behind them): one run at a time, DAILY_CAP a day,
 * MONTHLY_CAP a month, MAX_RUNS per request, and the owner's switch
 * (DAILY_INTAKE_ENABLED, falling back to WINE_INTAKE_ENABLED, so one switch
 * stops both). The workflow gets the request id and nothing else. */
import { today } from "./daily.js";
import { zagrebDate, newId, clip, person } from "./wines.js";

export const DAILY_CAP = 6;
export const MONTHLY_CAP = 60;
export const MAX_RUNS = 3;
export const MAX_PHOTOS = 3;
export const PHOTO_MAX = 1_500_000;
export const PHOTO_TYPES = ["image/jpeg", "image/webp", "image/png"];
const STALE_MIN = 25;
const REPO = "jsiljeg/list";
const WORKFLOW = "daily-offer.yml";

export { today, newId, clip, person };
const nowIso = () => new Date().toISOString();
const parse = (t, d) => { try { return t ? JSON.parse(t) : d; } catch { return d; } };

export const enabled = (env) => String((env && (env.DAILY_INTAKE_ENABLED ?? env.WINE_INTAKE_ENABLED)) || "") === "1";

export function shape(r) {
  if (!r) return null;
  return {
    id: r.id, date: r.date, status: r.status, created_at: r.created_at, updated_at: r.updated_at,
    text: r.text || "", remark: r.remark || "", photos: parse(r.photos, []), runs: r.runs,
    result: parse(r.result, null), run_url: r.run_url || "", error: r.error || "",
    usage: parse(r.usage, null), created_by: r.created_by || "", published_by: r.published_by || "",
  };
}

export async function readReq(env, id) {
  return shape(await env.DB.prepare("SELECT * FROM daily_requests WHERE id = ?1").bind(id).first());
}

export async function setReq(env, id, fields) {
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `${k} = ?${i + 2}`).concat(`updated_at = ?${keys.length + 2}`);
  await env.DB.prepare(`UPDATE daily_requests SET ${sets.join(", ")} WHERE id = ?1`)
    .bind(id, ...keys.map((k) => fields[k]), nowIso()).run();
}

/* A photo goes into `media` exactly as /api/kuhinja/media stores one:
   content-hashed, so the run fetches it from the public /media/<id>. The menu
   is public content; the photo of it is too. */
export async function storePhoto(env, date, f) {
  if (!PHOTO_TYPES.includes(f.type)) return { error: "photo_type" };
  if (f.size > PHOTO_MAX) return { error: "photo_too_big" };
  const bytes = await f.arrayBuffer();
  const id = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO media (id, date, mime, width, height, bytes, created_at) VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?5)")
    .bind(id, date, f.type, bytes, nowIso()).run();
  return { id };
}

async function counts(env) {
  const day = zagrebDate(), month = day.slice(0, 7);
  const r = await env.DB.prepare(
    `SELECT SUM(CASE WHEN date = ?1 THEN 1 ELSE 0 END) AS today,
            SUM(CASE WHEN substr(date, 1, 7) = ?2 THEN 1 ELSE 0 END) AS month FROM daily_dispatches`)
    .bind(day, month).first();
  return { today: (r && r.today) || 0, month: (r && r.month) || 0 };
}
export async function limits(env) {
  const c = await counts(env);
  return { enabled: enabled(env), today: c.today, dailyCap: DAILY_CAP, month: c.month, monthlyCap: MONTHLY_CAP };
}

/* Start the oldest queued request if every brake allows — the wine intake's
   pump(), against its own tables. A run "working" for STALE_MIN has died. */
export async function pump(env) {
  const stale = new Date(Date.now() - STALE_MIN * 60000).toISOString();
  await env.DB.prepare(
    `UPDATE daily_requests SET status = 'failed', error = 'run_timed_out', updated_at = ?1
      WHERE status = 'working' AND updated_at < ?2`).bind(nowIso(), stale).run();
  if (!enabled(env)) return { held: "disabled" };
  if (await env.DB.prepare("SELECT id FROM daily_requests WHERE status = 'working' LIMIT 1").first()) return { held: "busy" };
  const next = await env.DB.prepare(
    "SELECT id, runs FROM daily_requests WHERE status = 'queued' ORDER BY updated_at LIMIT 1").first();
  if (!next) return { held: "empty" };
  if (next.runs >= MAX_RUNS) { await setReq(env, next.id, { status: "failed", error: "too_many_rounds" }); return { held: "rounds" }; }
  const c = await counts(env);
  if (c.today >= DAILY_CAP) return { held: "daily_cap" };
  if (c.month >= MONTHLY_CAP) return { held: "monthly_cap" };
  const claim = await env.DB.prepare(
    "UPDATE daily_requests SET status = 'working', runs = runs + 1, error = '', updated_at = ?2 WHERE id = ?1 AND status = 'queued'")
    .bind(next.id, nowIso()).run();
  if (!claim.meta || !claim.meta.changes) return { held: "raced" };
  if (!env.GH_DISPATCH_TOKEN) {
    await setReq(env, next.id, { status: "queued", runs: next.runs, error: "no_dispatch_token" });
    return { held: "no_dispatch_token" };
  }
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`, accept: "application/vnd.github+json",
               "x-github-api-version": "2022-11-28", "user-agent": "theatrium-daily-offer" },
    body: JSON.stringify({ ref: "main", inputs: { id: next.id } }),
  });
  if (r.status !== 204) {
    await setReq(env, next.id, { status: "queued", runs: next.runs, error: `github_${r.status}` });
    return { held: `github_${r.status}` };
  }
  await env.DB.prepare("INSERT INTO daily_dispatches (at, date, request_id) VALUES (?1, ?2, ?3)")
    .bind(nowIso(), zagrebDate(), next.id).run();
  return { started: next.id };
}

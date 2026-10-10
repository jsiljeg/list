/* The new-wine inbox ("Novo vino") — shared by every /api/vina endpoint.
 *
 * Filho photographs a bottle in /admin on the wine list, types the price, and
 * that is all he does. The request lands here; a GitHub Actions run picks it
 * up, Claude researches and writes the card on a branch, and the card comes
 * back here as a preview. Filho reads it and taps "Objavi". Full design and the
 * reasons for it: web/WINE-INTAKE.md.
 *
 * What this file is responsible for, because it is the only gate in front of
 * the owner's Claude subscription:
 *
 *   1. Who may write. Staff (the existing STAFF_KEY, the same model as the
 *      daily offer) create, answer, publish and cancel. The worker (a separate
 *      WINE_WORKER_KEY, held only by the GitHub environment) reports progress.
 *      Neither key can do the other's job. The owner's dashboard (pr-checkups)
 *      reads with WINE_READ_KEY, which can do nothing else.
 *   2. When a run may start. Never more than one at a time, DAILY_CAP a day,
 *      MONTHLY_CAP a month, MAX_RUNS per wine, and only while the owner's
 *      switch WINE_INTAKE_ENABLED is "1". The workflow is started with the
 *      request id and nothing else — no text from Filho ever reaches the
 *      dispatch call, so nothing he types can steer what runs.
 *   3. Every dispatch is logged (wine_dispatches), and the caps are counted
 *      from that log, not from request rows that can change state. */
import { json, isStaff } from "./daily.js";

export const DAILY_CAP = 5;        /* owner, 2026-10-10 */
export const MONTHLY_CAP = 60;
export const MAX_RUNS = 5;         /* the first run, two rounds of questions, two rounds of edits */
export const MAX_PHOTOS = 6;       /* across all rounds */
export const PHOTO_MAX = 1_500_000;
export const PHOTO_TYPES = ["image/jpeg", "image/webp", "image/png"];
const STALE_MIN = 40;              /* a "working" row older than this has died */

const REPO = "jsiljeg/list";
const WORKFLOWS = { add: "add-wine.yml", publish: "publish-wine.yml" };

/* The wine list's admin lives on another origin and calls this API. */
const ORIGINS = ["https://theatrium.list.devinos.hr", "http://127.0.0.1:4173", "http://localhost:4173"];
export function cors(request) {
  const o = request.headers.get("origin");
  return ORIGINS.includes(o)
    ? { "access-control-allow-origin": o, "vary": "origin",
        "access-control-allow-headers": "authorization, content-type",
        "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-max-age": "600" }
    : {};
}
export const reply = (request, body, status = 200) => json(body, status, cors(request));

function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export function isWorker(request, env) {
  const got = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return same(got, env && env.WINE_WORKER_KEY);
}
export function isReader(request, env) {
  const got = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return same(got, env && env.WINE_READ_KEY);
}
/* Staff, the way the tablet already proves it: the GitHub key the 86 board
   uses. Owner, 2026-10-10: a second key on the Novo vino tab only confused
   him. The key is checked with GitHub itself — it must belong to an account
   in WINE_GH_LOGINS (default the owner's) — so a key that is not one of his
   gets nothing here, and revoking it on github.com revokes it here too. The
   daily offer's STAFF_KEY still works, for /kuhinja/-style use. */
const GH_CACHE = new Map();   /* sha256(token) -> {login, until}; per isolate, best effort */
async function githubLogin(token) {
  const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const hit = GH_CACHE.get(h);
  if (hit && hit.until > Date.now()) return hit.login;
  const r = await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "theatrium-wine-intake" },
  });
  const login = r.ok ? String((await r.json()).login || "") : "";
  GH_CACHE.set(h, { login, until: Date.now() + 5 * 60000 });
  return login;
}
export async function isStaffAsync(request, env) {
  if (isStaff(request, env)) return true;
  const got = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!/^(github_pat_|ghp_|gho_)[A-Za-z0-9_]{20,}$/.test(got)) return false;
  const allowed = String((env && env.WINE_GH_LOGINS) || "jsiljeg").split(",").map((s) => s.trim().toLowerCase());
  return allowed.includes((await githubLogin(got)).toLowerCase());
}
export { isStaff };

/* The owner's phone, through the same ntfy topic his dashboard uses — so a
   new wine reaches him with the laptop off. Optional: no NTFY_TOPIC, no push.
   Never throws: a notification must not fail the request it reports on. */
export async function notifyOwner(env, title, body, click) {
  if (!env || !env.NTFY_TOPIC) return { sent: false, why: "no NTFY_TOPIC" };
  const enc = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(s)))}?=`);
  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, {
      method: "POST",
      headers: { Title: enc(title), Priority: "3", Tags: "wine_glass", ...(click ? { Click: click } : {}) },
      body,
    });
    const why = r.ok ? "" : (await r.text().catch(() => "")).slice(0, 200);
    if (!r.ok) console.log(`ntfy ${r.status}: ${why}`);
    return { sent: r.ok, status: r.status, why };
  } catch (e) {
    console.log(`ntfy failed: ${e}`);
    return { sent: false, why: String(e) };
  }
}

export const zagrebDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(d);
const nowIso = () => new Date().toISOString();
export const newId = () => {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return zagrebDate().replace(/-/g, "") + "-" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

const parse = (t, dflt) => { try { return t ? JSON.parse(t) : dflt; } catch { return dflt; } };

/* A row as the API hands it out. Photos are listed by number, never inlined. */
export function shape(row, photos = []) {
  if (!row) return null;
  return {
    id: row.id, status: row.status, created_at: row.created_at, updated_at: row.updated_at,
    price_bottle: row.price_bottle, price_glass: row.price_glass, vol: row.vol,
    recommended: !!row.recommended, remark: row.remark || "",
    runs: row.runs, questions: parse(row.questions, []), answers: parse(row.answers, []),
    result: parse(row.result, null), branch: row.branch || "", run_url: row.run_url || "",
    error: row.error || "", ref: row.ref || "", published_at: row.published_at || "",
    usage: parse(row.usage, null), photos,
  };
}

export async function readRequest(env, id) {
  const row = await env.DB.prepare("SELECT * FROM wine_requests WHERE id = ?1").bind(id).first();
  if (!row) return null;
  const { results } = await env.DB.prepare(
    "SELECT n, mime FROM wine_photos WHERE request_id = ?1 ORDER BY n").bind(id).all();
  return shape(row, (results || []).map((p) => p.n));
}

export async function savePhotos(env, id, files) {
  const { results } = await env.DB.prepare(
    "SELECT COALESCE(MAX(n), 0) AS last, COUNT(*) AS c FROM wine_photos WHERE request_id = ?1").bind(id).all();
  let n = results[0].last, count = results[0].c;
  for (const f of files) {
    if (count >= MAX_PHOTOS) return { error: "too_many_photos" };
    if (!PHOTO_TYPES.includes(f.type)) return { error: "photo_type" };
    if (f.size > PHOTO_MAX) return { error: "photo_too_big" };
    const bytes = await f.arrayBuffer();
    n += 1; count += 1;
    await env.DB.prepare("INSERT INTO wine_photos (request_id, n, mime, bytes, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(id, n, f.type, bytes, nowIso()).run();
  }
  return { ok: true };
}

export async function setStatus(env, id, fields) {
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `${k} = ?${i + 2}`).concat(`updated_at = ?${keys.length + 2}`);
  await env.DB.prepare(`UPDATE wine_requests SET ${sets.join(", ")} WHERE id = ?1`)
    .bind(id, ...keys.map((k) => fields[k]), nowIso()).run();
}

/* ---- the brake ---- */
async function counts(env) {
  const day = zagrebDate(), month = day.slice(0, 7);
  const r = await env.DB.prepare(
    `SELECT SUM(CASE WHEN date = ?1 AND kind = 'add' THEN 1 ELSE 0 END) AS today,
            SUM(CASE WHEN substr(date, 1, 7) = ?2 AND kind = 'add' THEN 1 ELSE 0 END) AS month
       FROM wine_dispatches`).bind(day, month).first();
  return { today: r.today || 0, month: r.month || 0 };
}
export async function limits(env) {
  const c = await counts(env);
  return { enabled: env.WINE_INTAKE_ENABLED === "1", today: c.today, dailyCap: DAILY_CAP,
           month: c.month, monthlyCap: MONTHLY_CAP };
}

async function dispatch(env, kind, id) {
  if (!env.GH_DISPATCH_TOKEN) return { error: "no_dispatch_token" };
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOWS[kind]}/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`, accept: "application/vnd.github+json",
               "x-github-api-version": "2022-11-28", "user-agent": "theatrium-wine-intake" },
    body: JSON.stringify({ ref: "main", inputs: { id } }),
  });
  if (r.status !== 204) return { error: `github_${r.status}` };
  await env.DB.prepare("INSERT INTO wine_dispatches (at, date, request_id, kind) VALUES (?1, ?2, ?3, ?4)")
    .bind(nowIso(), zagrebDate(), id, kind).run();
  return { ok: true };
}

/* Start the oldest queued request, if every brake allows it. Called after a
   submit or an answer, and on every staff read of the list, so a request held
   back by the daily cap starts by itself the next day the board is opened. A
   run that has been "working" for STALE_MIN is presumed dead and failed, so a
   crashed runner cannot block the queue for ever. */
export async function pump(env) {
  const stale = new Date(Date.now() - STALE_MIN * 60000).toISOString();
  await env.DB.prepare(
    `UPDATE wine_requests SET status = 'failed', error = 'run_timed_out', updated_at = ?1
      WHERE status = 'working' AND updated_at < ?2`).bind(nowIso(), stale).run();
  if (env.WINE_INTAKE_ENABLED !== "1") return { held: "disabled" };
  const busy = await env.DB.prepare("SELECT id FROM wine_requests WHERE status = 'working' LIMIT 1").first();
  if (busy) return { held: "busy" };
  const next = await env.DB.prepare(
    "SELECT id, runs FROM wine_requests WHERE status = 'queued' ORDER BY updated_at LIMIT 1").first();
  if (!next) return { held: "empty" };
  if (next.runs >= MAX_RUNS) {
    await setStatus(env, next.id, { status: "failed", error: "too_many_rounds" });
    return { held: "rounds" };
  }
  const c = await counts(env);
  if (c.today >= DAILY_CAP) return { held: "daily_cap" };
  if (c.month >= MONTHLY_CAP) return { held: "monthly_cap" };
  /* Claim before dispatching, so two pumps racing cannot both start it. */
  const claim = await env.DB.prepare(
    "UPDATE wine_requests SET status = 'working', runs = runs + 1, error = '', updated_at = ?2 WHERE id = ?1 AND status = 'queued'")
    .bind(next.id, nowIso()).run();
  if (!claim.meta || !claim.meta.changes) return { held: "raced" };
  const d = await dispatch(env, "add", next.id);
  if (d.error) await setStatus(env, next.id, { status: "queued", runs: next.runs, error: d.error });
  return d.error ? { held: d.error } : { started: next.id };
}

export async function startPublish(env, id) {
  if (env.WINE_INTAKE_ENABLED !== "1") return { error: "disabled" };
  const claim = await env.DB.prepare(
    "UPDATE wine_requests SET status = 'publishing', updated_at = ?2 WHERE id = ?1 AND status = 'ready'")
    .bind(id, nowIso()).run();
  if (!claim.meta || !claim.meta.changes) return { error: "not_ready" };
  const d = await dispatch(env, "publish", id);
  if (d.error) await setStatus(env, id, { status: "ready", error: d.error });
  return d;
}

/* Numbers from a form: euros with a comma or a dot, two decimals at most. */
export function euros(v) {
  const t = String(v ?? "").trim().replace(/\s|€/g, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  const n = Number(t);
  return n > 0 && n < 100000 ? n : NaN;
}
export const clip = (v, max) => String(v ?? "").trim().slice(0, max);

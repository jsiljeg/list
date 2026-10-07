/* /api/stat — anonymous guest statistics for the wine list (schema.sql: guest_stats).
 *
 * POST (from the wine list, navigator.sendBeacon, text/plain JSON):
 *   { "kind": "visit" | "lang" | "wine" | "search", "key": "...", "device": "tablet" | "phone" | "desktop" }
 * adds one to that counter for the current Zagreb date and hour. Nothing about the guest is stored:
 * no cookie, no IP, no id, so two taps by the same guest can't be told apart from two guests.
 * Only the wine list's own origin may post; every field is checked, so junk can't fill the table.
 *
 * GET ?days=30 — the counters added up (languages, devices, hours, top wines, searches), for the
 * owner's dashboard. Aggregates only; a search term shows once at least two taps used it. */
import { json, LANGS } from "../_lib/daily.js";

const ORIGINS = ["https://theatrium.list.devinos.hr"];
const KINDS = ["visit", "lang", "wine", "search"];
const DEVICES = ["tablet", "phone", "desktop"];

const ZAGREB = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
function zagrebNow() {
  const p = Object.fromEntries(ZAGREB.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** The counter's key, cleaned per kind; null rejects the event. */
function cleanKey(kind, raw) {
  const s = String(raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (kind === "visit" || kind === "lang") return LANGS.includes(s) ? s : null;
  if (kind === "wine") return s.length >= 2 && s.length <= 140 && !/[<>{}]/.test(s) ? s : null;
  if (kind === "search") {
    const q = s.toLowerCase().slice(0, 40);
    return q.length >= 3 && !/[<>{}]/.test(q) ? q : null;
  }
  return null;
}

const cors = (origin) => (ORIGINS.includes(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } : {});

export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("origin");
  if (!ORIGINS.includes(origin)) return new Response(null, { status: 403 });
  const text = await request.text();
  if (text.length > 1000) return new Response(null, { status: 413, headers: cors(origin) });
  let ev;
  try { ev = JSON.parse(text); } catch { return new Response(null, { status: 400, headers: cors(origin) }); }
  const kind = KINDS.includes(ev?.kind) ? ev.kind : null;
  const device = DEVICES.includes(ev?.device) ? ev.device : null;
  const key = kind && cleanKey(kind, ev.key);
  if (!kind || !device || !key) return new Response(null, { status: 400, headers: cors(origin) });
  const { date, hour } = zagrebNow();
  await env.DB.prepare(
    `INSERT INTO guest_stats (date, hour, kind, key, device, n) VALUES (?1, ?2, ?3, ?4, ?5, 1)
     ON CONFLICT (date, hour, kind, key, device) DO UPDATE SET n = n + 1`,
  ).bind(date, hour, kind, key, device).run();
  return new Response(null, { status: 204, headers: cors(origin) });
}

export async function onRequestGet({ request, env }) {
  const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const q = (sql) => env.DB.prepare(sql).bind(since).all().then((r) => r.results || []);
  const [byDay, byLangDevice, byHour, wines, searches] = await Promise.all([
    q(`SELECT date, kind, SUM(n) AS n FROM guest_stats WHERE date >= ?1 AND kind IN ('visit', 'lang', 'wine') GROUP BY date, kind ORDER BY date`),
    q(`SELECT key AS lang, device, SUM(n) AS n FROM guest_stats WHERE date >= ?1 AND kind IN ('visit', 'lang') GROUP BY key, device`),
    q(`SELECT hour, SUM(n) AS n FROM guest_stats WHERE date >= ?1 AND kind = 'visit' GROUP BY hour ORDER BY hour`),
    q(`SELECT key AS wine, SUM(n) AS n FROM guest_stats WHERE date >= ?1 AND kind = 'wine' GROUP BY key ORDER BY n DESC LIMIT 15`),
    q(`SELECT key AS term, SUM(n) AS n FROM guest_stats WHERE date >= ?1 AND kind = 'search' GROUP BY key HAVING SUM(n) >= 2 ORDER BY n DESC LIMIT 15`),
  ]);
  return json({ since, days, byDay, byLangDevice, byHour, wines, searches }, 200, { "cache-control": "no-store" });
}

/* /api/stat — anonymous guest statistics for the wine list (schema.sql: guest_sessions, guest_events).
 *
 * The tablet goes from table to table and resets itself to the language screen after three idle
 * minutes, so a "session" is one table (or one guest on their own phone). Two kinds of message:
 *
 *   { "kind": "session", "lang", "device", "cards", "searches", "seconds" }
 *     sent once when a table is done (idle reset, page closed): one row tick per table, with how
 *     many wine cards they opened, how many searches, how long they browsed. This is what tells
 *     "one Italian reading everything" from "a hundred Italians opening one wine each".
 *   { "kind": "wine" | "search" | "search-empty" | "feature", "key", "lang", "device", "section"? }
 *     one tick per wine card opened (with the language it was read in and the list section), per
 *     search term settled on (and whether it found nothing), per feature used (sommelier helper,
 *     Filho's picks, best rated, pride of the house).
 *
 * Nothing about a guest is stored: no cookie, no IP, no id, no sequence of events. Only the wine
 * list's own origin may post, and every field is checked, so junk can't fill the tables.
 *
 * GET ?days=30 — everything added up, for the owner's dashboard. Aggregates only; a search that
 * found something shows once at least two tables used it. */
import { json, LANGS } from "../_lib/daily.js";

const ORIGINS = ["https://theatrium.list.devinos.hr"];
const EVENT_KINDS = ["wine", "search", "search-empty", "feature"];
const FEATURES = ["helper", "picks", "rated", "pride"];
const DEVICES = ["tablet", "phone", "desktop"];

const ZAGREB = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
function zagrebNow() {
  const p = Object.fromEntries(ZAGREB.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

const depthOf = (cards) => (cards <= 0 ? "0" : cards === 1 ? "1" : cards <= 3 ? "2-3" : cards <= 7 ? "4-7" : "8+");
const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

/** The event's key, cleaned per kind; null rejects it. */
function cleanKey(kind, raw) {
  const s = String(raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (kind === "wine") return s.length >= 2 && s.length <= 140 && !/[<>{}]/.test(s) ? s : null;
  if (kind === "search" || kind === "search-empty") {
    const q = s.toLowerCase().slice(0, 40);
    return q.length >= 3 && !/[<>{}]/.test(q) ? q : null;
  }
  if (kind === "feature") return FEATURES.includes(s) ? s : null;
  return null;
}

const cors = (origin) => (ORIGINS.includes(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } : {});

export const onRequestOptions = ({ request }) => new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("origin");
  if (!ORIGINS.includes(origin)) return new Response(null, { status: 403 });
  const h = cors(origin);
  const text = await request.text();
  if (text.length > 1000) return new Response(null, { status: 413, headers: h });
  let ev;
  try { ev = JSON.parse(text); } catch { return new Response(null, { status: 400, headers: h }); }
  const lang = LANGS.includes(ev?.lang) ? ev.lang : null;
  const device = DEVICES.includes(ev?.device) ? ev.device : null;
  if (!lang || !device) return new Response(null, { status: 400, headers: h });
  const { date, hour } = zagrebNow();

  if (ev.kind === "session") {
    const cards = int(ev.cards, 500), searches = int(ev.searches, 200), seconds = int(ev.seconds, 4 * 3600);
    if (cards === null || searches === null || seconds === null) return new Response(null, { status: 400, headers: h });
    await env.DB.prepare(
      `INSERT INTO guest_sessions (date, hour, lang, device, depth, n, cards, searches, seconds) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?8)
       ON CONFLICT (date, hour, lang, device, depth) DO UPDATE SET n = n + 1, cards = cards + ?6, searches = searches + ?7, seconds = seconds + ?8`,
    ).bind(date, hour, lang, device, depthOf(cards), cards, searches, seconds).run();
    return new Response(null, { status: 204, headers: h });
  }

  const kind = EVENT_KINDS.includes(ev?.kind) ? ev.kind : null;
  const key = kind && cleanKey(kind, ev.key);
  if (!kind || !key) return new Response(null, { status: 400, headers: h });
  const tick = (k, v) => env.DB.prepare(
    `INSERT INTO guest_events (date, hour, kind, key, lang, device, n) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
     ON CONFLICT (date, hour, kind, key, lang, device) DO UPDATE SET n = n + 1`,
  ).bind(date, hour, k, v, lang, device);
  const section = kind === "wine" && /^[a-z_-]{2,30}$/.test(String(ev.section || "")) ? ev.section : null;
  await env.DB.batch(section ? [tick(kind, key), tick("section", section)] : [tick(kind, key)]);
  return new Response(null, { status: 204, headers: h });
}

export async function onRequestGet({ request, env }) {
  const days = Math.min(365, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const q = (sql) => env.DB.prepare(sql).bind(since).all().then((r) => r.results || []);
  const [languages, depth, devices, byHour, byDay, wines, winesByLang, sections, searches, empty, features] = await Promise.all([
    // Per language: tables, cards opened, searches, minutes browsing.
    q(`SELECT lang, SUM(n) AS tables, SUM(cards) AS cards, SUM(searches) AS searches, SUM(seconds) AS seconds FROM guest_sessions WHERE date >= ?1 GROUP BY lang ORDER BY tables DESC`),
    q(`SELECT lang, depth, SUM(n) AS tables FROM guest_sessions WHERE date >= ?1 GROUP BY lang, depth`),
    q(`SELECT device, SUM(n) AS tables FROM guest_sessions WHERE date >= ?1 GROUP BY device`),
    q(`SELECT hour, SUM(n) AS tables FROM guest_sessions WHERE date >= ?1 GROUP BY hour ORDER BY hour`),
    q(`SELECT date, SUM(n) AS tables, SUM(cards) AS cards FROM guest_sessions WHERE date >= ?1 GROUP BY date ORDER BY date`),
    q(`SELECT key AS wine, SUM(n) AS n FROM guest_events WHERE date >= ?1 AND kind = 'wine' GROUP BY key ORDER BY n DESC LIMIT 15`),
    // Each language's three most opened wines.
    q(`SELECT lang, wine, n FROM (SELECT lang, key AS wine, SUM(n) AS n, ROW_NUMBER() OVER (PARTITION BY lang ORDER BY SUM(n) DESC) AS r
         FROM guest_events WHERE date >= ?1 AND kind = 'wine' GROUP BY lang, key) WHERE r <= 3 ORDER BY lang, n DESC`),
    q(`SELECT key AS section, lang, SUM(n) AS n FROM guest_events WHERE date >= ?1 AND kind = 'section' GROUP BY key, lang`),
    q(`SELECT key AS term, SUM(n) AS n FROM guest_events WHERE date >= ?1 AND kind = 'search' GROUP BY key HAVING SUM(n) >= 2 ORDER BY n DESC LIMIT 15`),
    q(`SELECT key AS term, SUM(n) AS n FROM guest_events WHERE date >= ?1 AND kind = 'search-empty' GROUP BY key ORDER BY n DESC LIMIT 15`),
    q(`SELECT key AS feature, SUM(n) AS n FROM guest_events WHERE date >= ?1 AND kind = 'feature' GROUP BY key ORDER BY n DESC`),
  ]);
  return json({ since, days, languages, depth, devices, byHour, byDay, wines, winesByLang, sections, searches, empty, features }, 200, { "cache-control": "no-store" });
}

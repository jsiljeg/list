/* The daily offer — shared by the public page, its JSON feed and the staff
 * endpoints. See web/DAILY-OFFER.md for the whole picture.
 *
 * Three rules hold everything together:
 *
 *   1. The offer stores wine *refs*, never names or prices. The wine list is
 *      the only place a price lives; this reads it live, so a price change or
 *      an 86 reaches the daily offer without anyone touching it.
 *   2. Nothing here writes to the wine list. Its published JSON is read over
 *      HTTPS, exactly as a guest's tablet reads it.
 *   3. Only a *published* offer for *today* reaches a guest by default. A
 *      draft is the chef's; yesterday's dishes are sold out. */

import { wineRows, suggest } from "../../src/lib/pairing.mjs";

export const LANGS = ["hr", "en", "it", "fr", "de", "sl", "es", "zh"];
export const COURSES = ["starters", "soups", "mains", "desserts"];
export const COURSE_HR = { starters: "Predjela", soups: "Juhe", mains: "Glavna jela", desserts: "Deserti" };

const WINE_LIST = "https://theatrium.list.devinos.hr";
export const wineListOrigin = (env) => (env && env.WINE_LIST_ORIGIN) || WINE_LIST;

/* The service day, YYYY-MM-DD. It rolls over at 03:00 UTC (04:00/05:00 in
   Zagreb), not at midnight — owner, 2026-10-02: the day's offer disappears by
   itself overnight and nobody has to remove it, but a table still eating at
   00:30 does not watch it vanish. Nothing is deleted: the row stays in D1 for
   the staff page, it is simply no longer "today". The wine list's sommelier
   uses the same rule (branch wine-list-daily-offer), so the two cannot
   disagree about which offer is current. */
export const ROLLOVER_UTC_HOUR = 3;
export const today = () =>
  new Date(Date.now() - ROLLOVER_UTC_HOUR * 3600e3).toISOString().slice(0, 10);

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const json = (b, status = 200, headers = {}) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

/* ---- staff auth ----
   A shared key, held in the staff phone's localStorage and sent as a bearer
   token. The same model as the wine list's 86 board, and adequate for the same
   reason: what it guards is public content (a menu), not guest personal data.
   Reservations are a different matter and get Cloudflare Access (PLAN.md §7).
   Revoking is one `wrangler pages secret put STAFF_KEY`. */
export function isStaff(request, env) {
  const key = env && env.STAFF_KEY;
  if (!key) return false;
  const got = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (got.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= got.charCodeAt(i) ^ key.charCodeAt(i);
  return diff === 0;
}

export const denied = (env) =>
  env && env.STAFF_KEY ? json({ error: "key" }, 401) : json({ error: "not_configured" }, 503);

/* ---- the stored shape ----
   Everything from the client passes through here, so the stored JSON is
   always this shape whatever the staff page sends. */
const clip = (v, max) => String(v ?? "").trim().slice(0, max);
const words = (o, max) => {
  const out = {};
  for (const l of LANGS) { const v = clip(o && o[l], max); if (v) out[l] = v; }
  return out;
};
const keys = (a, max) =>
  [...new Set((Array.isArray(a) ? a : []).map((k) => String(k)).filter((k) => /^[a-z0-9_]{1,40}$/.test(k)))].slice(0, max);
const refs = (a) =>
  [...new Set((Array.isArray(a) ? a : []).map((k) => String(k)).filter((k) => /^[a-z0-9-]{3,200}$/.test(k)))].slice(0, 6);
const mediaId = (v) => (/^[a-f0-9]{16,64}$/.test(String(v || "")) ? String(v) : null);

export function normalizeOffer(input) {
  const b = input || {};
  const video = clip(b.video, 400);
  return {
    title: words(b.title, 120),
    intro: words(b.intro, 1200),
    video: /^https:\/\//.test(video) ? video : "",
    photos: (Array.isArray(b.photos) ? b.photos : []).map(mediaId).filter(Boolean).slice(0, 12),
    dishes: (Array.isArray(b.dishes) ? b.dishes : []).slice(0, 12).map((d) => ({
      course: COURSES.includes(d && d.course) ? d.course : "mains",
      name: words(d && d.name, 160),
      description: words(d && d.description, 600),
      price: Number.isFinite(Number(d && d.price)) && Number(d.price) > 0 ? Math.round(Number(d.price) * 100) / 100 : null,
      pairings: keys(d && d.pairings, 6),
      styles: keys(d && d.styles, 6),
      wines: refs(d && d.wines),
      photo: mediaId(d && d.photo),
    })).filter((d) => d.name.hr),
  };
}

export async function readOffer(env, date) {
  if (!env.DB) return null;
  const row = await env.DB.prepare(
    "SELECT date, status, body, updated_at, published_at FROM daily_offers WHERE date = ?1"
  ).bind(date).first();
  if (!row) return null;
  let body;
  try { body = JSON.parse(row.body); } catch { body = normalizeOffer({}); }
  return { date: row.date, status: row.status, updatedAt: row.updated_at, publishedAt: row.published_at, ...body };
}

export async function recentPublished(env, limit = 14) {
  if (!env.DB) return [];
  const { results } = await env.DB.prepare(
    "SELECT date FROM daily_offers WHERE status = 'published' AND date <= ?1 ORDER BY date DESC LIMIT ?2"
  ).bind(today(), limit).all();
  return (results || []).map((r) => r.date);
}

/* ---- the wine list, read live ----
   Three files, the same three a tablet polls. Cached at the edge for two
   minutes: a price edit on the list reaches this page about as fast as it
   reaches the tablets, and a busy lunch does not fetch 500 kB per request. */
async function getJson(url) {
  const r = await fetch(url, { cf: { cacheTtl: 120, cacheEverything: true } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

export async function loadShelf(env) {
  const o = wineListOrigin(env);
  const [lib, list, unavailable] = await Promise.all([
    getJson(`${o}/library/wines.json`),
    getJson(`${o}/lists/theatrium.json`),
    getJson(`${o}/data/unavailable.json`).catch(() => ({ hidden: [] })),
  ]);
  return wineRows(lib, list, unavailable);
}

/**
 * The offer as a guest sees it: wines resolved to name, producer and tonight's
 * prices, anything 86'd or no longer listed dropped, media turned into URLs.
 * `shelf` may be null when the wine list could not be read — the dishes are
 * still worth showing, the wines are then left off rather than guessed.
 */
export function resolveOffer(offer, shelf) {
  const byRef = new Map();
  for (const r of shelf || []) {
    const e = byRef.get(r.ref) || { ref: r.ref, name: r.name, producer: r.producer, bottle: null, glass: null, vol: null,
      style: r.insight.style, grape: r.insight.grape || "", country: r.country || "", region: r.insight.region || "",
      recommended: !!r.recommended };
    if (r.glass) e.glass = r.price ?? e.glass;
    else if (e.bottle == null || (r.price ?? Infinity) < e.bottle) { e.bottle = r.price ?? null; e.vol = r.vol ?? null; }
    byRef.set(r.ref, e);
  }
  const photo = (id) => (id ? `/media/${id}` : null);
  return {
    date: offer.date,
    status: offer.status,
    title: offer.title || {},
    intro: offer.intro || {},
    video: offer.video || "",
    photos: (offer.photos || []).map(photo),
    dishes: (offer.dishes || []).map((d) => ({
      course: d.course,
      name: d.name,
      description: d.description || {},
      price: d.price,
      pairings: d.pairings || [],
      styles: d.styles || [],
      photo: photo(d.photo),
      wines: shelf ? dishWines(d, shelf, byRef) : [],
    })),
  };
}

/* The chef's wines for one dish, as many as were picked.

   A wine 86'd after the offer was published drops out, and the dish must not
   be left short for it (owner, 2026-10-10: "remove wines if removed from the
   list and show again what can be shown"). Each lost pick is replaced by the
   model's next-best bottle for the dish's own tags — the same scoring the
   staff page proposed from, so the stand-in is a wine the chef would have
   seen at the top of the list. The chef's surviving picks keep their order and
   come first; nothing is added when nothing was lost. */
export function dishWines(d, shelf, byRef) {
  const refs = d.wines || [];
  const kept = refs.map((ref) => byRef.get(ref)).filter(Boolean);
  const lost = refs.length - kept.length;
  if (lost <= 0 || !(d.pairings || []).length) return kept;
  const have = new Set(refs);
  const extra = suggest({ pairings: d.pairings || [], styles: d.styles || [] }, shelf, { n: 40 })
    .filter((s) => !s.styleOnly && !have.has(s.ref))
    .slice(0, lost)
    .map((s) => byRef.get(s.ref))
    .filter(Boolean);
  return kept.concat(extra);
}

/* ---- the public page, Croatian ---- */
const DATE_HR = new Intl.DateTimeFormat("hr-HR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const dateHr = (iso) => DATE_HR.format(new Date(`${iso}T12:00:00Z`));
const eur = (n) => (n == null ? "" : `${Number(n).toLocaleString("hr-HR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`);
const volHr = (v) => (v && v !== 0.75 ? ` · ${String(v).replace(".", ",")} l` : "");

/* YouTube embeds without cookies; anything else (Instagram, TikTok) is a link,
   because their embeds need third-party scripts and consent the site does not
   otherwise ask for. */
function videoHtml(url) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,20})/);
  if (yt)
    return `<div class="daily-video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(yt[1])}" title="Video s tržnice" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
  return `<p class="daily-video-link"><a href="${esc(url)}" rel="noopener" target="_blank">Pogledajte video s tržnice →</a></p>`;
}

function wineHtml(w, food) {
  const prices = [w.glass != null ? `čaša ${eur(w.glass)}` : "", w.bottle != null ? `boca ${eur(w.bottle)}${volHr(w.vol)}` : ""]
    .filter(Boolean).join(" · ");
  const meta = [w.grape, w.region].filter(Boolean).join(" · ");
  return `<li class="daily-wine">
  <span class="dw-name">${esc(w.name)}</span>
  <span class="dw-producer">${esc(w.producer)}</span>
  ${meta ? `<span class="dw-meta">${esc(meta)}</span>` : ""}
  ${prices ? `<span class="dw-price">${esc(prices)}</span>` : ""}
</li>`;
}

export function renderOffer(o, { food = (k) => k } = {}) {
  const title = o.title.hr || "Dnevna ponuda";
  let h = `<header class="daily-head">
  <p class="eyebrow">${esc(dateHr(o.date))}</p>
  <h1>${esc(title)}</h1>
  ${o.intro.hr ? `<p class="lede">${esc(o.intro.hr).replace(/\n+/g, "<br>")}</p>` : ""}
</header>`;
  if (o.photos.length)
    h += `<div class="daily-photos">${o.photos.map((src, i) =>
      `<img src="${esc(src)}" alt="" loading="${i ? "lazy" : "eager"}" decoding="async">`).join("")}</div>`;
  if (o.video) h += videoHtml(o.video);

  for (const c of COURSES) {
    const ds = o.dishes.filter((d) => d.course === c);
    if (!ds.length) continue;
    h += `<section class="daily-course"><h2>${esc(COURSE_HR[c])}</h2>`;
    for (const d of ds) {
      h += `<article class="daily-dish">
  ${d.photo ? `<img class="dd-photo" src="${esc(d.photo)}" alt="${esc(d.name.hr)}" loading="lazy" decoding="async">` : ""}
  <div class="dd-body">
    <h3>${esc(d.name.hr)}${d.price != null ? ` <span class="dd-price">${esc(eur(d.price))}</span>` : ""}</h3>
    ${d.description.hr ? `<p class="dd-desc">${esc(d.description.hr)}</p>` : ""}
    ${d.wines.length ? `<p class="dd-label">Uz ovo jelo${d.pairings.length ? ` <span class="dd-why">· ${esc(d.pairings.slice(0, 3).map(food).join(", "))}</span>` : ""}</p>
    <ul class="daily-wines">${d.wines.map((w) => wineHtml(w, food)).join("")}</ul>` : ""}
  </div>
</article>`;
    }
    h += `</section>`;
  }
  h += `<p class="daily-legal muted">Cijene su u eurima, PDV uključen. Za informacije o alergenima obratite se našem osoblju.
  Vina su s naše <a href="https://theatrium.list.devinos.hr">karte pića</a>.</p>`;
  return h;
}

export function renderEmpty() {
  return `<header class="daily-head">
  <p class="eyebrow">${esc(dateHr(today()))}</p>
  <h1>Dnevna ponuda</h1>
  <p class="lede">Današnja ponuda još nije objavljena — Filho je vjerojatno još na tržnici.
  Do tada: <a href="/jelovnik/">jelovnik</a> i <a href="https://theatrium.list.devinos.hr">karta pića</a>.</p>
</header>`;
}

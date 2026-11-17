/* Who may call what on /api — the roles (web/ROLES.md).
 *
 *   full    Filho and the owner: STAFF_KEY, or a listed GitHub key
 *           (isStaffAsync in wines.js). Everything staff can do, as before.
 *   somm    the head sommelier (Toni, owner 2026-11-17): Karta, Dodaj vino,
 *           Ponuda — and NOTHING of Troškovi, Prihodi or Povijest. His key
 *           is a server key ("somm_…"), never a GitHub token: a GitHub key
 *           that can write the list can also write web/ and so the server.
 *   worker / reader / expense-worker   the machine keys, unchanged.
 *   public  no key at all (the guest site's own endpoints).
 *
 * Deny by default, twice:
 *   1. api/_middleware.js lets a somm key through only to a route and method
 *      this table gives "somm"; everything else is 403 before the function
 *      runs — including any endpoint added later and not declared here.
 *   2. isStaffAsync() means full only, and a somm key never passes it. Only
 *      the functions that opted in call staffOrSomm().
 * tests/roles.spec.mjs fails if a route file has a handler this table does
 * not declare, or the table declares one that does not exist. */
import { isStaffAsync, person } from "./wines.js";

export const ACCESS = {
  "/api/availability":                { GET: ["public"] },
  "/api/dnevna-ponuda":               { GET: ["public"], OPTIONS: ["public"] },
  "/api/dogadaji":                    { POST: ["public"] },
  "/api/reservations":                { POST: ["public"] },
  "/api/stat":                        { GET: ["public"], POST: ["public"], OPTIONS: ["public"] },

  "/api/uloga":                       { GET: ["full", "somm"], OPTIONS: ["public"] },
  "/api/dnevnik":                     { GET: ["full"], OPTIONS: ["public"] },
  "/api/karta":                       { GET: ["full", "somm"], PUT: ["full", "somm"], OPTIONS: ["public"] },

  "/api/vina":                        { GET: ["full", "somm", "worker", "reader"], POST: ["full", "somm"] },
  "/api/vina/test-obavijest":         { POST: ["full"] },
  "/api/vina/:id":                    { GET: ["full", "somm", "worker", "reader"] },
  "/api/vina/:id/foto/:n":            { GET: ["full", "somm", "worker", "reader"] },
  "/api/vina/:id/:action":            { POST: ["full", "somm", "worker"] },

  "/api/kuhinja/citaj":               { GET: ["full", "somm", "worker"], POST: ["full", "somm"] },
  "/api/kuhinja/citaj/:id":           { GET: ["full", "somm", "worker"] },
  "/api/kuhinja/citaj/:id/:action":   { POST: ["full", "somm", "worker"] },
  "/api/kuhinja/media":               { POST: ["full", "somm"] },
  "/api/kuhinja/media/:id":           { DELETE: ["full", "somm"] },
  "/api/kuhinja/ponuda":              { GET: ["full", "somm"], PUT: ["full", "somm"], DELETE: ["full", "somm"] },

  "/api/prihodi":                     { GET: ["full"] },
  "/api/prihodi/tjedan":              { POST: ["expense-worker"] },
  "/api/prihodi/tvrtke":              { GET: ["full"], PUT: ["full"] },
  "/api/prihodi/uvoz":                { GET: ["expense-worker"], POST: ["expense-worker"] },

  "/api/troskovi":                    { GET: ["full"], POST: ["full"] },
  "/api/troskovi/kljucevi":           { POST: ["full"] },
  "/api/troskovi/mer":                { GET: ["full"], POST: ["full", "expense-worker"] },
  "/api/troskovi/povijest":           { GET: ["full"] },
  "/api/troskovi/posao/:batch":       { GET: ["expense-worker"] },
  "/api/troskovi/:id/eracun":         { GET: ["expense-worker"] },
  "/api/troskovi/:id/foto/:n":        { GET: ["full", "expense-worker"] },
  "/api/troskovi/:id/:action":        { POST: ["full", "expense-worker"] },
};

/* The route a path lands on, the way Pages picks it: a static segment beats
   a parameter. A path that matches no declared route resolves to nothing,
   which the middleware treats as "not allowed". */
const ROUTES = Object.keys(ACCESS).map((route) => {
  const segs = route.split("/").slice(1);
  return { route, segs, rank: segs.map((s) => (s.startsWith(":") ? "1" : "0")).join("") };
}).sort((a, b) => a.rank.localeCompare(b.rank));
export function resolveRoute(pathname) {
  const p = String(pathname || "").replace(/\/$/, "");
  const parts = p.split("/").slice(1);
  if (parts.some((s) => s === "")) return null;
  for (const r of ROUTES) {
    if (r.segs.length !== parts.length) continue;
    if (r.segs.every((s, i) => s.startsWith(":") || s === parts[i])) return r.route;
  }
  return null;
}
export function rolesFor(method, pathname) {
  const route = resolveRoute(pathname);
  return (route && ACCESS[route][String(method || "").toUpperCase()]) || [];
}
export const sommMay = (method, pathname) => rolesFor(method, pathname).includes("somm");

/* ---- the sommelier's key ----
   "somm_" + 43 characters (32 random bytes, base64url), from
   scripts/new-somm-key.mjs. Only its full SHA-256 is kept here — it cannot
   be turned back into the key and is safe in a public repo. The name is the
   server's, never the page's: it signs his commits and his requests.
   WINE_SOMM_KEYS ("<sha256>:<Name>,…") adds keys without a deploy.
   Revoking: delete the line (or the env entry) and deploy. */
export const SOMM_KEYS = {
  /* "<64 hex sha256>": "Toni",   ← the owner adds this after his manual test (web/ROLES.md §4) */
};
export const SOMM_SHAPE = /^somm_[A-Za-z0-9_-]{32,128}$/;
export const bearer = (request) => (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
export const isSommShaped = (t) => SOMM_SHAPE.test(String(t || ""));
export const sha256hex = async (t) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))]
  .map((b) => b.toString(16).padStart(2, "0")).join("");

function envKeys(env) {
  const out = {};
  for (const part of String((env && env.WINE_SOMM_KEYS) || "").split(",")) {
    const [h, name] = part.trim().split(":");
    if (/^[0-9a-f]{64}$/i.test(h || "")) out[h.toLowerCase()] = (name || "").trim() || "Somelijer";
  }
  return out;
}
/* The name of an enrolled sommelier key, or "" */
export async function sommWho(token, env) {
  if (!isSommShaped(token)) return "";
  const h = await sha256hex(token);
  const name = (Object.prototype.hasOwnProperty.call(SOMM_KEYS, h) && SOMM_KEYS[h]) || envKeys(env)[h] || "";
  return String(name).replace(/[^\p{L} .-]/gu, "").trim().slice(0, 40);
}

/* Who is calling, for the functions somm may use: {role, who} or null. */
export async function staffOrSomm(request, env) {
  const t = bearer(request);
  if (isSommShaped(t)) {
    const who = await sommWho(t, env);
    return who ? { role: "somm", who } : null;
  }
  return (await isStaffAsync(request, env)) ? { role: "full", who: "" } : null;
}

/* The name a write is recorded under. A sommelier's is the server's, from
   his key — whatever the page sends as `by`. A full key's is what its page
   says (Filho's page sends "Filho", the owner's "Jure"), as before. */
export const actorName = (a, by) => (a && a.role === "somm" ? a.who : person(by) || "Filho");

/* One line in staff_log (schema.sql), for Povijest (owner, 2026-11-17: "we
   need to see his activities in history, but he should not see any
   history"). Every write Dodaj vino and Ponuda can make calls this; Karta's
   are in git. Never throws: a log line must not fail the write it records. */
export async function logStaff(env, a, by, area, what, ref = "") {
  if (!a || !env || !env.DB) return;
  try {
    await env.DB.prepare("INSERT INTO staff_log (at, who, role, area, what, ref) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
      .bind(new Date().toISOString(), actorName(a, by), a.role, area, String(what).slice(0, 300), String(ref || "").slice(0, 120)).run();
  } catch (e) { console.log(`staff_log: ${e}`); }
}

/* What a Claude run cost is the owner's, not the sommelier's. */
export function forRole(item, a) {
  if (!item || !a || a.role !== "somm") return item;
  const { usage, ...rest } = item;
  return rest;
}

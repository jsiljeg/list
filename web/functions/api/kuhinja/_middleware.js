/* CORS for /api/kuhinja: since 2026-10-13 the wine list's /admin publishes the
   daily offer too ("Dnevna ponuda" tab), from another origin, exactly as it
   calls /api/vina. Only the origins in wines.js get the headers; the key
   check behind this still applies to every method. The /admin sends its
   GitHub key, which isStaffAsync() accepts beside STAFF_KEY. */
import { cors } from "../../_lib/wines.js";

export async function onRequest({ request, next }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  const res = await next();
  const h = cors(request);
  if (!Object.keys(h).length) return res;
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(h)) out.headers.set(k, v);
  return out;
}

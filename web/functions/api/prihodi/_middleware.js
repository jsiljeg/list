/* CORS for /api/prihodi: the caller is the wine list's /admin on another
   origin, exactly as for /api/vina. The key checks behind it still apply. */
import { cors } from "../../_lib/wines.js";

export async function onRequest({ request, next }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  return next();
}

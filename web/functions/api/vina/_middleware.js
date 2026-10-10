/* CORS for /api/vina: the caller is the wine list's /admin on another origin.
   Only the origins in wines.js get the headers; everyone else gets none, and
   the key check behind this still applies to every method. */
import { cors } from "../../_lib/wines.js";

export async function onRequest({ request, next }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
  return next();
}

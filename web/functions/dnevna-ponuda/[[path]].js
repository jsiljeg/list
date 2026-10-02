/* /dnevna-ponuda/ — the public page.
 *
 * Astro builds the page once (layout, nav, styles) with an empty slot in it;
 * this fills the slot on every request with the day's offer, rendered as real
 * HTML. That keeps the site static and the stack unchanged, and still gives a
 * crawler — and a guest on a slow phone — the dishes and wines in the first
 * response rather than after a script runs.
 *
 * Only the current service day is ever shown (rolls over 03:00 UTC, see
 * today() in _lib/daily.js). Past days have no public page: the owner wants
 * the offer to disappear by itself, and a sold-out dish reachable from an old
 * link is the same thing not disappearing. /dnevna-ponuda/<date>/ therefore
 * redirects to the current page. */
import { readOffer, loadShelf, resolveOffer, renderOffer, renderEmpty, today, dateHr } from "../_lib/daily.js";
import { food } from "../../src/lib/food.mjs";

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  if ((params.path || []).filter(Boolean).length) return Response.redirect(new URL("/dnevna-ponuda/", url), 302);

  const date = today();
  const page = await env.ASSETS.fetch(new URL("/dnevna-ponuda/", url));
  const offer = await readOffer(env, date).catch(() => null);

  let html, title;
  if (offer && offer.status === "published") {
    const shelf = await loadShelf(env).catch((e) => { console.error("wine list unreachable", e?.message); return null; });
    const o = resolveOffer(offer, shelf);
    html = renderOffer(o, { food });
    title = `${o.title.hr || "Dnevna ponuda"} — ${dateHr(date)} | Theatrium by Filho`;
  } else {
    html = renderEmpty();
  }

  const res = new HTMLRewriter()
    .on("#daily-slot", { element: (el) => el.setInnerContent(html, { html: true }) })
    .on("title", { element: (el) => { if (title) el.setInnerContent(title); } })
    .transform(page);
  const out = new Response(res.body, res);
  /* A minute at the edge: publishing shows up within one, and the lunch rush
     is not a D1 query per guest. */
  out.headers.set("cache-control", "public, max-age=60");
  return out;
}

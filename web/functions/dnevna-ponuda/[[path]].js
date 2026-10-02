/* /dnevna-ponuda/ and /dnevna-ponuda/YYYY-MM-DD/ — the public page.
 *
 * Astro builds the page once (layout, nav, styles) with an empty slot in it;
 * this fills the slot on every request with the day's offer, rendered as real
 * HTML. That keeps the site static and the stack unchanged, and still gives a
 * crawler — and a guest on a slow phone — the dishes and wines in the first
 * response rather than after a script runs. */
import { readOffer, recentPublished, loadShelf, resolveOffer, renderOffer, renderEmpty, today, isDate, dateHr } from "../_lib/daily.js";
import { food } from "../../src/lib/food.mjs";

export async function onRequestGet({ request, env, params }) {
  const seg = (params.path || []).filter(Boolean);
  const url = new URL(request.url);
  const date = seg.length ? seg[0] : today();
  if (seg.length > 1 || !isDate(date)) return new Response("not found", { status: 404 });

  const page = await env.ASSETS.fetch(new URL("/dnevna-ponuda/", url));
  const [offer, archive] = await Promise.all([
    readOffer(env, date).catch(() => null),
    recentPublished(env).catch(() => []),
  ]);

  let html, title;
  if (offer && offer.status === "published") {
    const shelf = await loadShelf(env).catch((e) => { console.error("wine list unreachable", e?.message); return null; });
    const o = resolveOffer(offer, shelf);
    html = renderOffer(o, { archive, food });
    title = `${o.title.hr || "Dnevna ponuda"} — ${dateHr(date)} | Theatrium by Filho`;
  } else if (seg.length) {
    return new Response("not found", { status: 404 });
  } else {
    html = renderEmpty(archive);
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

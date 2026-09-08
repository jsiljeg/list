/* Pull prices and ingredients from theatrium.hr/jelovnik into the new site.
 *
 *   node scripts/fetch-menu.mjs
 *
 * WHY A SCRIPT AND NOT A BUILD STEP. Fetching a third-party page on every
 * deploy makes the build fail whenever their WordPress is slow or restyled.
 * This writes a committed file instead: run it when the kitchen changes the
 * card, review the diff, commit. The build never touches the network.
 *
 * WHY NOT data/menu.json. That file belongs to the wine list — the sommelier
 * scores against it and validate.mjs guards it. Prices and ingredients are the
 * new site's concern, so they live in the new site's own data and are joined by
 * slug. The wine list keeps exactly the shape it has today.
 *
 * The join is by slug, computed the same way build-pairings.mjs computes it, so
 * a dish that exists in both files lines up. Anything that does not match is
 * printed rather than silently dropped: a rename on their side should be
 * visible, not invisible. */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "../../scripts/lib/list.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "..", "src", "data");
const SRC = "https://theatrium.hr/jelovnik/";

const FOLD = { đ: "d", Đ: "d", ß: "ss" };
const slug = (s) =>
  s.replace(/[đĐß]/g, (c) => FOLD[c])
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const strip = (html) =>
  html.replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/&#8211;|&ndash;/g, "–").replace(/&#8217;|&rsquo;/g, "’")
      .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s+/g, " ").trim();

const res = await fetch(SRC, { headers: { "user-agent": "Mozilla/5.0" } });
if (!res.ok) { console.error(`fetch failed: ${res.status}`); process.exit(1); }
const html = await res.text();

/* h3 = course, h4 = dish + price, the following p = ingredients. */
const COURSE = { "predjela": "starters", "juhe": "soups", "glavna jela": "mains", "deserti": "desserts" };
const dishes = [];
let course = "";

const re = /<(h3|h4|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
let m, pending = null;
while ((m = re.exec(html))) {
  const tag = m[1].toLowerCase();
  const text = strip(m[2]);
  if (!text) continue;

  if (tag === "h3") {
    const k = COURSE[text.toLowerCase()];
    if (k) course = k;
    pending = null;
  } else if (tag === "h4") {
    /* "Name 18 €" — the price is the trailing number. */
    const pm = text.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*€\s*$/);
    pending = {
      course,
      name: (pm ? pm[1] : text).trim(),
      price: pm ? Number(pm[2].replace(",", ".")) : null,
      ingredients: "",
    };
    pending.slug = slug(pending.name);
    dishes.push(pending);
  } else if (tag === "p" && pending && !pending.ingredients) {
    pending.ingredients = text;
    pending = null;
  }
}

if (!dishes.length) { console.error("no dishes parsed — the page markup changed"); process.exit(1); }

/* Report the join against the wine list's dish names, without touching them. */
const menu = JSON.parse(readFileSync(resolve(ROOT, "data/menu.json"), "utf8"));
const live = new Set(menu.dishes.filter((d) => !d.off).map((d) => slug(d.name.hr)));
const matched = dishes.filter((d) => live.has(d.slug));
const extra = dishes.filter((d) => !live.has(d.slug));
const missing = [...live].filter((s) => !dishes.some((d) => d.slug === s));

mkdirSync(OUT, { recursive: true });
const out = {};
for (const d of dishes) out[d.slug] = { course: d.course, name: d.name, price: d.price, ingredients: d.ingredients };
writeFileSync(resolve(OUT, "menu-detail.json"), JSON.stringify(out, null, 1) + "\n", "utf8");

console.log(`menu-detail.json — ${dishes.length} dishes, ${dishes.filter((d) => d.price != null).length} with a price`);
console.log(`  match the wine list's live menu: ${matched.length}`);
if (extra.length) console.log(`  on their page, not in menu.json: ${extra.map((d) => d.slug).join(", ")}`);
if (missing.length) console.log(`  in menu.json, not on their page: ${missing.join(", ")}`);

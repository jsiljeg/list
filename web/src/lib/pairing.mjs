/* The house pairing model, in one module that runs everywhere the daily offer
   needs it: the staff page (browser), the public page and its JSON feed
   (Pages Functions) and the sommelier skill's script (node).

   It is a port, not a new model. Every rule here already exists in the wine
   list and was tuned there — see CLAUDE.md, "The sommelier", and the skill at
   .claude/skills/sommelier/. Keep these in step with their originals:

     dishScore()   js/app.js dishScore(), web/scripts/build-pairings.mjs
     foodFirst     js/app.js renderHelperResults()
     CLASHES       scripts/validate.mjs PAIRING_RULES
     hidden()      js/app.js hiddenTest()
     joinList()    js/app.js mergeList(), scripts/lib/list.mjs

   Read-only towards the wine list: it takes the list's published JSON as
   input and never writes to it. */

/* Croatian labels for the 18 wine styles, as the list prints them
   (js/i18n.js → hr.styles). The staff page is Croatian. */
export const STYLE_HR = {
  sparkling: "Pjenušavo vino", sparkling_rose: "Pjenušavi rosé",
  champagne: "Champagne", champagne_bdb: "Champagne · Blanc de Blancs",
  champagne_bdn: "Champagne · Blanc de Noirs", champagne_rose: "Champagne rosé",
  champagne_prestige: "Prestižni champagne",
  white_fresh: "Bijelo · svježe", white_aromatic: "Bijelo · aromatično",
  white_mineral: "Bijelo · mineralno", white_rich: "Bijelo · bogato",
  orange: "Macerirano bijelo", rose: "Rosé · svježe",
  red_light: "Crno · lagano", red_medium: "Crno · srednje puno",
  red_full: "Crno · puno", red_mature: "Crno · zrelo",
  sweet: "Desertno vino",
};

/* ---- clashes: a floor, not a house style ----
   The five rules validate.mjs enforces on every wine's tags. Here they run the
   other way, and only where nothing else vouches for the wine: see suggest().
   They are deliberately NOT applied to a wine that shares a food with the
   dish. A dish carries several tags, and "white with beef" is a clash for a
   steak but not for a tartare that is also `light_starters` — Champagne with
   tartare is in the house research as a classic. The wine's own tags already
   passed these rules in validate.mjs, so a shared food is a vetted match. */
const DESSERT_FOOD = ["desserts", "fruit_desserts", "dark_chocolate"];
const RED_MEAT_FOOD = ["beef", "steak", "lamb", "game", "bbq", "stews", "pasticada"];
const DELICATE_FOOD = ["oysters", "caviar", "sushi", "white_fish", "grilled_fish", "shellfish"];
const SAVOURY_MAIN = [...RED_MEAT_FOOD, ...DELICATE_FOOD, "seafood", "light_starters", "aperitif",
  "poultry", "veal", "pork", "white_meat", "pasta", "risotto", "pizza"];

export const CLASHES = [
  ["suho vino uz slatko jelo djeluje kiselo i tanko — šećer u jelu ne smije nadjačati šećer u čaši",
    (ins, f) => ins.sweetness !== "sweet" && ins.sweetness !== "semi_sweet" && DESSERT_FOOD.includes(f)
      && !(/rose$/.test(ins.style) && /^(sparkling|champagne)/.test(ins.style) && f === "fruit_desserts")],
  ["slatko vino uz slano glavno jelo — sukob namjene",
    (ins, f) => ins.style === "sweet" && SAVOURY_MAIN.includes(f)],
  ["tanin i jod daju metalan okus — veliko crno uništava kamenice, kavijar i sirovu ribu",
    (ins, f) => /^(red_full|red_mature)$/.test(ins.style) && DELICATE_FOOD.includes(f)],
  ["bijelo ili pjenušavo nema težinu za crveno meso i divljač",
    (ins, f) => /^(white|sparkling|champagne)/.test(ins.style) && RED_MEAT_FOOD.includes(f)],
  ["tamna čokolada ogoli suho pjenušavo vino",
    (ins, f) => /^(sparkling|champagne)/.test(ins.style) && f === "dark_chocolate"],
];

/** Why this wine must not go with this dish, or null. */
export function clash(insight, foods) {
  for (const f of foods || [])
    for (const [why, test] of CLASHES)
      if (test(insight, f)) return { food: f, why };
  return null;
}

/* ---- scoring: identical to the list ----
   4 points for the wine's first food, 3 for its second, 2 for its third, 1
   after — the wine's pairings are stored best-first — plus 3 for a style the
   dish asks for and 1 for one of Filho's picks. */
export function dishScore(dish, wine) {
  const ins = wine.insight;
  if (!ins) return 0;
  let score = 0;
  (ins.pairings || []).forEach((p, i) => {
    if ((dish.pairings || []).includes(p)) score += Math.max(1, 4 - i);
  });
  if ((dish.styles || []).includes(ins.style)) score += 3;
  if (wine.recommended) score += 1;
  return score;
}

export const sharedFoods = (dish, wine) =>
  (wine.insight?.pairings || []).filter((p) => (dish.pairings || []).includes(p));

/* ---- the list, as the guest sees it tonight ---- */
const norm = (s) => String(s ?? "").trim().toLowerCase();

function hidden(rules) {
  const rs = (Array.isArray(rules) ? rules : []).filter((r) => r && r.name);
  return (item, secId) => rs.some((r) =>
    norm(r.name) === norm(item.name) &&
    (!r.producer || norm(r.producer) === norm(item.producer)) &&
    (r.vol == null || Number(r.vol) === item.vol) &&
    (!r.where || (r.where === "glass" ? secId === "glass" : secId.startsWith("bottle"))));
}

/**
 * Every *wine* listing that is pourable tonight, flat: one row per listing,
 * so a wine sold by the glass and by the bottle appears twice, with `glass`
 * telling them apart. Spirits (insight.kind) and soft drinks (no insight)
 * are left out — the daily offer pairs wine.
 *
 * @param lib    library/wines.json
 * @param list   lists/theatrium.json
 * @param unavailable data/unavailable.json (optional)
 */
export function wineRows(lib, list, unavailable) {
  const wines = (lib && lib.wines) || {};
  const isHidden = hidden(unavailable && unavailable.hidden);
  const rows = [];
  for (const sec of list.sections) {
    const glass = sec.id === "glass";
    if (!glass && !sec.id.startsWith("bottle-")) continue;
    for (const cat of sec.categories)
      for (const g of cat.groups)
        for (const entry of g.items) {
          const facts = wines[entry.ref];
          if (!facts || !facts.insight || facts.insight.kind) continue;
          const { ref, ...venue } = entry;
          const row = { ...facts, ...venue, ref, glass, section: sec.id, country: g.country || facts.insight.country };
          if (!isHidden(row, sec.id)) rows.push(row);
        }
  }
  return rows;
}

/**
 * Ranked suggestions for a dish, deterministic (no tie-break jitter: the chef
 * is choosing, not browsing, and a list that reshuffles on every keystroke
 * cannot be chosen from).
 *
 * - foodFirst: if any wine shares a food with the dish, only those are
 *   returned — a suggestion must name the dish's food on its own card; the
 *   style-only fallback drops anything that clashes with the dish;
 * - one row per ref (the cheapest listing), with the glass price attached
 *   when the wine is also poured by the glass.
 *
 * opts: { n = 12, glassOnly = false, lo = 0, hi = Infinity } — lo/hi bound
 * the *bottle* price and do not apply to glasses.
 */
export function suggest(dish, rows, opts = {}) {
  const { n = 12, glassOnly = false, lo = 0, hi = Infinity } = opts;
  const glassPrice = new Map();
  for (const r of rows) if (r.glass && r.price != null) glassPrice.set(r.ref, r.price);

  const best = new Map();
  for (const r of rows) {
    if (glassOnly ? !r.glass : r.glass) continue;
    if (!glassOnly && r.price != null && (r.price < lo || r.price > hi)) continue;
    const score = dishScore(dish, r);
    if (score <= 0) continue;
    const prev = best.get(r.ref);
    if (!prev || (r.price ?? Infinity) < (prev.row.price ?? Infinity)) best.set(r.ref, { row: r, score });
  }
  let pool = [...best.values()];
  const strong = pool.filter((x) => sharedFoods(dish, x.row).length);
  /* Style-only is the fallback for a dish no wine names a food of. Nothing
     but the style vouches for these, so a clash with the dish removes them. */
  pool = strong.length ? strong : pool.filter((x) => !clash(x.row.insight, dish.pairings));
  pool.sort((a, b) => b.score - a.score
    || Number(!!b.row.recommended) - Number(!!a.row.recommended)
    || (a.row.price ?? 0) - (b.row.price ?? 0));
  return pool.slice(0, n).map(({ row, score }) => ({
    ref: row.ref, name: row.name, producer: row.producer,
    price: row.price ?? null, vol: row.vol ?? null,
    glassPrice: glassPrice.get(row.ref) ?? null,
    score, styleOnly: !strong.length,
    style: row.insight.style, grape: row.insight.grape || "",
    shared: sharedFoods(dish, row), recommended: !!row.recommended,
  }));
}

/** Food tags the shelf actually carries, most common first — the vocabulary
    a dish can be described in and still find a wine. */
export function foodVocabulary(rows) {
  const n = new Map();
  for (const r of rows) for (const p of r.insight.pairings || []) n.set(p, (n.get(p) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({ k, count }));
}

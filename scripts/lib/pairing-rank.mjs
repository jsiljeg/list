/* Which food a wine is *best* with, not merely compatible with.
   Owner, 2026-08-02: "rank the best pairing for each wine and match them
   accordingly" — in both directions, the sommelier's food→wine and the card's
   wine→food.

   `validate.mjs` and `data.spec.mjs` check that every wine's `pairings` array
   is stored in this order, so the card reads best-first with no runtime work,
   and `dishScore()` in js/app.js weights an early match above a late one. The
   owner can still override by hand: the check reports the order it expected,
   it does not rewrite anything.

   Two layers, because a style gets you most of the way and a grape gets you
   the rest:

   1. STYLE_ORDER — what that shelf does best, in order. This is classical
      practice, not invention: a mineral white leads with oysters because the
      salt and the acid are the pairing; a full red leads with steak because
      protein and fat are what tannin needs.
   2. GRAPE_FIRST — a short list of grapes whose classic dish outranks the
      style default. Nebbiolo wants truffles before steak; Riesling wants the
      spice; Pinot Noir wants the bird and the mushroom. Only the cases a
      sommelier would name without hesitating are here — this is a nudge, not
      a second table. */

export const STYLE_ORDER = {
  sparkling: ["aperitif", "light_starters", "oysters", "seafood", "shellfish", "white_fish",
    "cheese_fresh", "salads", "vegetables", "risotto", "sushi", "prosciutto", "charcuterie",
    "poultry", "cheese_hard"],
  sparkling_rose: ["aperitif", "prosciutto", "charcuterie", "light_starters", "salads",
    "seafood", "vegetables", "fruit_desserts"],
  champagne: ["aperitif", "oysters", "caviar", "seafood", "shellfish", "white_fish",
    "light_starters", "sushi", "poultry", "white_meat", "charcuterie", "cheese_fresh", "cheese_hard"],
  champagne_bdb: ["oysters", "caviar", "white_fish", "shellfish", "seafood", "sushi", "japanese",
    "light_starters", "cheese_fresh", "poultry", "cheese_hard"],
  champagne_bdn: ["poultry", "white_meat", "charcuterie", "prosciutto", "veal", "cheese_hard"],
  champagne_rose: ["aperitif", "prosciutto", "charcuterie", "seafood", "shellfish", "poultry",
    "light_starters", "fruit_desserts"],
  champagne_prestige: ["caviar", "oysters", "shellfish", "white_fish", "poultry", "veal",
    "white_meat", "cheese_fresh", "charcuterie", "cheese_hard", "solo"],
  white_fresh: ["white_fish", "seafood", "shellfish", "oysters", "salads", "vegetables",
    "light_starters", "sushi", "grilled_fish", "risotto", "pasta", "cheese_fresh", "poultry",
    "veal", "asian"],
  white_aromatic: ["asian", "spicy", "asparagus", "salads", "cheese_fresh", "vegetables",
    "sushi", "white_fish", "seafood", "light_starters", "poultry"],
  white_mineral: ["oysters", "shellfish", "white_fish", "seafood", "grilled_fish", "caviar",
    "sushi", "light_starters", "salads", "asparagus", "vegetables", "asian", "spicy", "cheese_fresh",
    "poultry", "white_meat", "risotto", "pasta", "veal", "pork", "mushrooms", "prosciutto",
    "cheese_hard", "solo"],
  white_rich: ["poultry", "white_fish", "truffles", "risotto", "mushrooms", "shellfish", "veal",
    "white_meat", "foie_gras", "cheese_hard", "seafood", "cheese_fresh", "salads", "vegetables",
    "pasta", "solo"],
  /* Skin contact gives a white the grip of a red without the fruit, which is
     why it lands on cured meat and hard cheese before anything delicate. */
  orange: ["cheese_hard", "charcuterie", "mushrooms", "white_meat", "prosciutto", "spicy",
    "asian", "vegetables", "poultry", "game"],
  rose: ["salads", "seafood", "light_starters", "vegetables", "prosciutto", "charcuterie",
    "shellfish", "white_fish", "poultry"],
  red_light: ["poultry", "mushrooms", "veal", "charcuterie", "game", "white_meat", "pork",
    "prosciutto", "pasta", "cheese_hard"],
  red_medium: ["pasta", "charcuterie", "poultry", "white_meat", "veal", "cheese_hard", "pork",
    "game", "stews", "mushrooms", "beef", "truffles", "pizza", "bbq", "prosciutto", "lamb", "solo"],
  red_full: ["steak", "beef", "lamb", "game", "bbq", "stews", "pasticada", "cheese_hard",
    "truffles", "pizza", "pasta", "charcuterie", "pork", "solo"],
  red_mature: ["game", "truffles", "cheese_hard", "lamb", "beef", "steak", "mushrooms",
    "stews", "pasticada", "charcuterie", "solo"],
  sweet: ["foie_gras", "cheese_blue", "desserts", "fruit_desserts", "dark_chocolate", "nuts"]
};

/* grape (matched case-insensitively against insight.grape) → foods that move
   to the front for that grape, in order. */
export const GRAPE_FIRST = [
  [/nebbiolo/i, ["truffles", "game", "cheese_hard"]],
  [/pinot noir|pinot nero|pinot crni|modri pinot/i, ["poultry", "mushrooms", "game"]],
  [/sangiovese/i, ["pasta", "pizza", "cheese_hard"]],
  [/cabernet|merlot|carménère|carmenere/i, ["beef", "steak", "lamb"]],
  [/syrah|shiraz/i, ["bbq", "game", "beef"]],
  /* The sources are unanimous that lamb — peka lamb — is the Plavac dish,
     and pašticada the Dalmatian braise it was made for. */
  [/plavac mali/i, ["lamb", "bbq", "pasticada", "stews"]],
  [/tribidrag|zinfandel|primitivo|kratošija/i, ["bbq", "lamb", "stews"]],
  [/malvazija istarska/i, ["white_fish", "seafood", "truffles", "risotto"]],
  [/pošip|grk\b|rukatac|maraština/i, ["oysters", "white_fish", "seafood", "grilled_fish"]],
  [/teran|refošk/i, ["beef", "stews", "truffles", "charcuterie"]],
  [/riesling|rizling/i, ["asian", "spicy", "pork"]],
  [/grüner|gruner|veltliner/i, ["asparagus", "vegetables", "veal"]],
  /* Anchored to the start of a token so "Cabernet Sauvignon" does not get
     asparagus promoted onto a Bordeaux blend. */
  [/(^|,\s*)sauvignon\b/i, ["asparagus", "salads", "cheese_fresh"]],
  [/chardonnay/i, ["poultry", "white_fish", "truffles"]],
  [/gewürz|gewurz|muškat|muskat|muscat|moscato/i, ["asian", "spicy"]],
  [/furmint|savagnin/i, ["cheese_hard", "mushrooms"]],
  [/nerello/i, ["poultry", "mushrooms"]],
  [/corvina/i, ["cheese_hard", "stews"]]
];

/** The order `pairings` should be stored in for this wine, best food first. */
export function rankPairings(insight) {
  const tags = insight.pairings || [];
  const base = STYLE_ORDER[insight.style] || [];
  const grape = String(insight.grape || "");
  const first = [];
  for (const [re, foods] of GRAPE_FIRST)
    if (re.test(grape)) for (const f of foods) if (!first.includes(f)) first.push(f);
  const rank = (p) => {
    const g = first.indexOf(p);
    if (g !== -1) return g;                  // the grape's classic dish leads
    const b = base.indexOf(p);
    return b === -1 ? 900 : 100 + b;         // then the style's order, then anything unlisted
  };
  return [...tags].sort((a, b) => rank(a) - rank(b) || tags.indexOf(a) - tags.indexOf(b));
}

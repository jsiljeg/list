/* What each grape is classically served with — the wine→food direction.
   Compiled 2026-08-02 from the sources listed against each family, plus the
   dish-level research in scratch/pairing-research.md. Used two ways:

     - `missingFoods()` reports classic pairings a wine does not claim, which
       is how the thin shelves get filled honestly rather than by guesswork;
     - `unsupportedFoods()` reports the reverse, a tag the grape has no
       business carrying.

   It is a reference, not a rule: a wine may legitimately depart from its
   grape's habits, which is why nothing here fails a build. What it does is
   stop a shelf being thin by accident — `veal` was on nine of 308 wines while
   half the Pinot Noir and Grüner on the list are textbook veal wines.

   Order matters: it is the order the foods should appear in for that grape,
   so it feeds the ranking as well. */

export const GRAPE_FOODS = [
  /* ---- Croatian and regional, where the local pairing is the point ---- */
  // total-croatia-news / wineandmore: peka lamb is "the dish Plavac was born
  // alongside"; then grilled meat, pašticada, game, mature cheese, tomato stews.
  [/plavac mali/i, ["lamb", "bbq", "beef", "pasticada", "game", "stews", "cheese_hard"]],
  [/tribidrag|zinfandel|primitivo|kratošija|crljenak/i, ["bbq", "lamb", "beef", "stews", "pizza", "cheese_hard"]],
  // croatia.hr / thetasteofcroatia: richer sauces, meat, truffles.
  [/teran|refošk|refosk/i, ["beef", "stews", "charcuterie", "truffles", "cheese_hard", "pasta"]],
  [/babić|babic/i, ["lamb", "beef", "bbq", "stews", "cheese_hard"]],
  // croatia.hr: grilled sea bass, scampi, asparagus risotto, local truffles.
  [/malvazija istarska|malvasia istriana/i,
    ["white_fish", "seafood", "shellfish", "risotto", "truffles", "asparagus", "pasta", "salads", "poultry"]],
  [/pošip|posip/i, ["white_fish", "seafood", "grilled_fish", "shellfish", "risotto", "poultry"]],
  [/grk\b/i, ["oysters", "shellfish", "white_fish", "seafood"]],
  [/graševina|grasevina/i, ["white_fish", "salads", "light_starters", "vegetables", "poultry"]],
  [/škrlet|skrlet|kraljevina|plavec žuti/i, ["salads", "light_starters", "white_fish", "vegetables"]],
  [/rukatac|maraština/i, ["white_fish", "seafood", "shellfish", "grilled_fish"]],
  [/vitovska|ribolla gialla/i, ["cheese_hard", "charcuterie", "white_meat", "mushrooms", "prosciutto"]],
  [/friulano|sauvignon vert|sauvignonasse/i, ["prosciutto", "white_fish", "cheese_fresh", "asparagus", "poultry"]],

  /* ---- the international families ---- */
  [/cabernet sauvignon|petit verdot|malbec/i, ["steak", "beef", "lamb", "game", "bbq", "cheese_hard"]],
  [/^merlot|,\s*merlot/i, ["beef", "lamb", "mushrooms", "poultry", "cheese_hard", "pork", "pasta"]],
  [/cabernet franc/i, ["beef", "lamb", "charcuterie", "poultry", "vegetables", "cheese_hard", "pasta"]],
  // matchingfoodandwine: Bordeaux right-bank and Burgundy both for Wellington.
  [/pinot noir|pinot nero|pinot crni|modri pinot|spätburgunder/i,
    ["poultry", "mushrooms", "veal", "game", "truffles", "white_meat", "charcuterie", "grilled_fish"]],
  [/gamay/i, ["charcuterie", "poultry", "prosciutto", "pork", "veal", "cheese_fresh"]],
  [/sangiovese/i, ["pasta", "pizza", "beef", "cheese_hard", "charcuterie", "game", "stews"]],
  [/nebbiolo/i, ["truffles", "game", "beef", "mushrooms", "cheese_hard", "stews"]],
  [/syrah|shiraz/i, ["bbq", "game", "beef", "lamb", "steak", "stews"]],
  [/corvina|rondinella|molinara/i, ["cheese_hard", "game", "stews", "beef"]],
  [/tempranillo|garnacha|grenache|graciano|mazuelo/i, ["lamb", "beef", "charcuterie", "cheese_hard", "stews"]],
  [/croatina|vespolina|uva rara/i, ["charcuterie", "pasta", "poultry", "cheese_hard", "game"]],
  [/nerello/i, ["poultry", "mushrooms", "pasta", "charcuterie"]],

  /* ---- whites ---- */
  // vivino/grapeguru: unoaked Chardonnay is the risotto wine; oaked takes
  // poultry, truffles and mushroom.
  [/chardonnay/i, ["poultry", "white_fish", "risotto", "truffles", "mushrooms", "shellfish", "seafood", "veal"]],
  [/riesling|rizling/i, ["white_fish", "shellfish", "asian", "spicy", "pork", "sushi", "poultry"]],
  [/sauvignon blanc|^sauvignon\b|,\s*sauvignon\b/i,
    ["cheese_fresh", "salads", "asparagus", "vegetables", "white_fish", "seafood", "sushi"]],
  [/grüner|gruner|veltliner/i, ["asparagus", "vegetables", "veal", "white_fish", "salads", "poultry", "sushi"]],
  // The Alsace classic, and why Albert Mann's Hengst carries foie gras.
  [/pinot gris|pinot grigio|sivi pinot/i, ["white_meat", "mushrooms", "foie_gras", "poultry", "pork", "asian"]],
  [/pinot blanc|pinot bianco|bijeli pinot/i, ["white_fish", "cheese_fresh", "salads", "poultry", "risotto"]],
  [/viura|savagnin/i, ["cheese_hard", "mushrooms", "poultry", "truffles", "white_fish"]],
  [/furmint/i, ["cheese_hard", "poultry", "white_fish", "foie_gras"]],
  [/muskat|muscat|moscato|gewürz|gewurz/i, ["asian", "spicy", "cheese_blue", "fruit_desserts", "desserts"]],
  [/aligoté|aligote/i, ["oysters", "shellfish", "white_fish", "light_starters", "salads"]],
  [/vermentino|garganega|carricante/i, ["white_fish", "seafood", "shellfish", "grilled_fish", "salads"]],
  [/glera|prosecco/i, ["aperitif", "light_starters", "prosciutto", "salads"]],
  [/godello|albariño|albarino/i, ["white_fish", "seafood", "shellfish", "grilled_fish"]],
  [/žilavka|zilavka|kujundžuša/i, ["white_fish", "seafood", "grilled_fish", "poultry"]],
  [/trnjak|vranac/i, ["lamb", "beef", "stews", "bbq", "cheese_hard"]]
];

/** The classic foods for this wine's grapes, in order, de-duplicated. */
export function classicFoods(insight) {
  const grape = String(insight.grape || "");
  const out = [];
  for (const [re, foods] of GRAPE_FOODS)
    if (re.test(grape)) for (const f of foods) if (!out.includes(f)) out.push(f);
  return out;
}

/** Classic foods for the grape that this wine does not claim. */
export function missingFoods(insight) {
  const has = new Set(insight.pairings || []);
  return classicFoods(insight).filter((f) => !has.has(f));
}

/** Foods this wine claims that are not classic for any of its grapes. */
export function unsupportedFoods(insight) {
  const classic = new Set(classicFoods(insight));
  if (!classic.size) return [];                 // no reference for this grape
  return (insight.pairings || []).filter((f) => !classic.has(f));
}

/* Dish style targets corrected against the pairing research of 2026-08-02.
   Each change names its source. One-shot; kept for the record. */
import fs from "node:fs";
const p = "data/menu.json";
const d = JSON.parse(fs.readFileSync(p, "utf8"));
const by = Object.fromEntries(d.dishes.map((x) => [x.name.en, x]));

const FIX = {
  "Roasted beetroot & goat cheese salad": {
    styles: ["white_aromatic", "white_mineral", "white_fresh", "rose"],
    why: "Sancerre is the gold standard for goat cheese (matchingfoodandwine, " +
         "vinepair), with Provence rosé and Albariño beside it. Orange was the " +
         "odd one out: skin contact fights a fresh chèvre rather than helping it."
  },
  "Burrata, asparagus & strawberry salad": {
    styles: ["white_aromatic", "white_fresh", "sparkling", "rose"],
    why: "Grüner and Sauvignon are the two grapes that survive asparagus " +
         "(decanter); rosé picks up the strawberry. Unchanged in substance, " +
         "reordered so the aromatics lead."
  },
  "Artichoke tempura": {
    styles: ["white_fresh", "white_aromatic", "sparkling"],
    why: "Cynarin makes everything taste sweeter, so the rule is bone dry, high " +
         "acid and NO OAK (thekitchn, bibendum, Food & Wine). Zero-dosage or " +
         "brut sparkling is explicitly recommended; orange wine — skin tannin " +
         "and often oxidative — was the wrong instinct."
  },
  "Drniš prosciutto vs. Jamón Ibérico": {
    styles: ["sparkling", "sparkling_rose", "orange", "red_light", "rose"],
    why: "Fino is the classic and we pour none; after that cellartours and " +
         "7bellotas both give Cava/Champagne brut nature, dry rosé and light " +
         "reds. Orange stays — skin tannin and salt genuinely work."
  },
  "Prawn soup (our Tom Kha Gai)": {
    styles: ["white_aromatic", "sweet", "white_fresh", "sparkling"],
    why: "Off-dry Riesling is the gold standard and Gewürztraminer beside it; " +
         "unoaked Chardonnay handles the coconut (kamalabeachestate, " +
         "tastingtable). Steely mineral was the wrong axis — the chilli needs " +
         "a touch of sugar, not more acid."
  },
  "Beef risotto": {
    styles: ["red_medium", "white_rich", "white_fresh", "red_light"],
    why: "Owner, and the sources agree: an unoaked Chardonnay and a creamy " +
         "Parmesan risotto 'just understand each other' (vivino, grapeguru); " +
         "aged whites work for Parmesan-heavy versions and light high-acid reds " +
         "for the beef. Acidity is what balances the mantecatura."
  },
  "Adriatic tuna skewer": {
    styles: ["red_light", "rose", "white_aromatic", "white_mineral"],
    why: "Pinot Noir is the top choice for seared tuna and dry rosé beside it; " +
         "crisp high-acid whites work, heavy tannin turns metallic " +
         "(drinkandpair, texasrealfood). A rich oaked white was the odd entry."
  },
  "Beef Wellington": {
    styles: ["red_full", "red_mature", "red_medium"],
    why: "Bordeaux is the classic, but the mushroom duxelles is precisely why " +
         "Burgundy works — 'a chef's favourite when the Wellington is " +
         "medium-rare' (matchingfoodandwine)."
  },
  "Foie gras": {
    styles: ["sweet", "white_rich", "champagne_prestige", "champagne_bdb"],
    why: "Sauternes first, then late-harvest Alsace and Tokaji; but Champagne " +
         "is named repeatedly, and blanc de blancs specifically 'refreshes the " +
         "palate between mouthfuls' (fauchon, jjbuckley, altcellars)."
  },
  "Beef tartare": {
    styles: ["red_light", "red_medium", "champagne", "white_mineral"],
    why: "'When in doubt with any tartare, quality Champagne rarely fails'; " +
         "Pinot Noir and Beaujolais are the classic reds, and a dry high-acid " +
         "white works on the raw texture (tartare.org, winedeals)."
  }
};

for (const [name, { styles, why }] of Object.entries(FIX)) {
  const dish = by[name];
  if (!dish) { console.log(`!! no dish "${name}"`); continue; }
  const before = dish.styles.join(",");
  dish.styles = styles;
  console.log(`${name}\n    ${before}\n  → ${styles.join(",")}\n    ${why.replace(/\s+/g, " ")}\n`);
}
fs.writeFileSync(p, (JSON.stringify(d, null, 1) + "\n").replace(/\n/g, "\r\n"), "utf8");
console.log("written");

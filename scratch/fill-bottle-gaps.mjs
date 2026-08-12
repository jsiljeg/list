/* Bottle answers that could not reach three, filled with tags a sommelier
   would defend rather than with scoring changes (owner, 2026-08-12: "per
   bottle should always be at least 3").

   Two shelves were doing it: the Ikone band, where eleven prestige Champagnes
   carried "caviar, solo" and little else — Champagne is the most versatile
   wine in the cellar and was tagged as the least — and the under-60 € reds,
   where CLAUDE.md already noted that not one carried `beef`.

   Each addition names its reason. Nothing is added that the wine would not
   actually suit; the combinations still short after this are reported at the
   end and are shelf facts, not tagging failures. */
import { readFileSync, writeFileSync } from "node:fs";
import { rankPairings } from "../scripts/lib/pairing-rank.mjs";

const ADD = [
  // --- Ikone: prestige Champagne, tagged as if it only met caviar ---
  ["Krug", "Krug Grande Cuvée", ["foie_gras"],
    "Krug's own table pairs the Grande Cuvée with foie gras; the oxidative, "
    + "long-aged style is what stands up to it."],
  ["Jacques Selosse", "Version Originale", ["foie_gras"],
    "vinous, oxidative, low dosage — the Champagne that behaves like a rich white"],
  ["Jacques Selosse", "Initial Brut", ["cheese_fresh", "light_starters"],
    "goat's cheese and Champagne is a classic of the Marne itself"],
  ["Louis Roederer", "Cristal 2015", ["light_starters"],
    "a prestige blend built for the start of a meal"],
  ["Salon", "Salon Blanc de Blancs 2013", ["light_starters"],
    "blanc de blancs, and delicate first courses are what it is for"],
  ["Krug", "Krug 2004", ["white_fish", "light_starters"],
    "a vintage Krug is a fish wine before it is anything else"],
  ["Krug", "Clos du Mesnil 2008", ["oysters", "light_starters"],
    "single-vineyard blanc de blancs from Le Mesnil — oysters are the textbook"],
  ["Krug", "Clos d'Ambonnay 1996", ["caviar"],
    "it carried `solo` alone, which is true but not the whole truth"],
  ["Moët & Chandon", "Dom Pérignon P3 1993", ["foie_gras"],
    "a third-plénitude 1993 is deep into truffle and foie gras territory"],
  // --- Ikone: white Burgundy that meets a goat's cheese salad ---
  ["René & Vincent Dauvissat", "Chablis 1er Cru Vaillons 2018", ["cheese_fresh"],
    "Chablis with chèvre is one of the oldest pairings in France"],
  // --- under 60 €: sweet wine for foie gras, red for braised beef ---
  ["Geržinić", "Muškat 2020", ["foie_gras"],
    "sweet Muscat with foie gras is the Beaumes-de-Venise tradition"],
  ["Geržinić", "Muškat 2020 – 0,5 l", ["foie_gras"],
    "same wine, other format — twins carry identical insight"],
  ["Petrač", "Karizma Cuvée 2022", ["beef"],
    "Cabernet and Merlot with beef; not one sub-60 € red carried it"],
  ["Fattoria di Magliano", "Heba 2021", ["stews"],
    "Sangiovese with braised meat is Tuscan cooking's own pairing"]
];

const p = "library/wines.json";
const raw = readFileSync(p, "utf8");
const data = JSON.parse(raw);
const wines = data.wines;

const findRef = (producer, name) => {
  const hits = Object.keys(wines).filter((k) =>
    wines[k].producer === producer && wines[k].name === name);
  if (hits.length !== 1) throw new Error(`${producer} — ${name}: ${hits.length} matches`);
  return hits[0];
};

for (const [producer, name, foods, why] of ADD) {
  const ref = findRef(producer, name);
  const ins = wines[ref].insight;
  const before = [...(ins.pairings || [])];
  const merged = [...new Set([...before, ...foods])];
  if (merged.length > 5) throw new Error(`${name} would exceed five tags: ${merged}`);
  ins.pairings = rankPairings({ ...ins, pairings: merged });
  console.log(`${producer} — ${name}`);
  console.log(`   ${before.join(", ")}`);
  console.log(`   → ${ins.pairings.join(", ")}`);
  console.log(`   (${why})\n`);
}

writeFileSync(p, (JSON.stringify(data, null, 1) + "\n").replace(/\n/g, "\r\n"), "utf8");
console.log("written");

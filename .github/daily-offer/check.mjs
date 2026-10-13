/* Checks the offer a daily-offer run wrote, before it reaches Filho's preview.
 *
 *   node .github/daily-offer/check.mjs intake/offer.json intake/result.json > out/report.json
 *
 * No AI here: it reads the files the model wrote and keeps only what the
 * house model can stand behind. A food tag or style the shelf does not carry
 * is dropped (it would find nothing on the tablets); a wine that is not
 * listed tonight, or is 86'd, is dropped; a dish left with no tag is reported,
 * because the list's sommelier cannot offer it. Everything dropped is listed,
 * in Croatian, for the preview. */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { wineRows, foodVocabulary } = await import(pathToFileURL(resolve(ROOT, "web/src/lib/pairing.mjs")).href);
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf-8"));

const [offerPath, resultPath] = process.argv.slice(2);
let offer, result = {};
try { offer = JSON.parse(readFileSync(offerPath, "utf-8")); }
catch (e) { console.log(JSON.stringify({ status: "failed", error: "Ponuda nije napisana — pokušajte ponovno." })); process.exit(0); }
try { result = JSON.parse(readFileSync(resultPath, "utf-8")); } catch { result = {}; }

if (result.status === "failed") {
  console.log(JSON.stringify({ status: "failed", error: String(result.error || "Jelovnik se nije mogao pročitati.").slice(0, 500) }));
  process.exit(0);
}

const rows = wineRows(read("library/wines.json"), read("lists/theatrium.json"), read("data/unavailable.json"));
const tags = new Set(foodVocabulary(rows).map((x) => x.k));
const styles = new Set(rows.map((r) => r.insight.style));
const refs = new Set(rows.map((r) => r.ref));
const LANGS = ["hr", "en", "it", "fr", "de", "sl", "es", "zh"];
const COURSES = ["starters", "soups", "mains", "desserts"];

const dropped = [];
const dishes = (Array.isArray(offer.dishes) ? offer.dishes : []).filter((d) => d && d.name && d.name.hr).slice(0, 12).map((d) => {
  const nm = d.name.hr;
  const keep = (arr, ok, what) => (Array.isArray(arr) ? arr : []).filter((k) => {
    if (ok.has(k)) return true;
    dropped.push(`${nm}: ${what} "${k}" nije na karti — izostavljeno`);
    return false;
  });
  const out = {
    course: COURSES.includes(d.course) ? d.course : "mains",
    name: d.name, description: d.description || {},
    price: Number(d.price) > 0 ? Number(d.price) : null,
    pairings: keep(d.pairings, tags, "oznaka"),
    styles: keep(d.styles, styles, "stil"),
    wines: keep(d.wines, refs, "vino").slice(0, 3),
  };
  const missing = LANGS.filter((l) => !(out.name[l] || "").trim());
  if (missing.length) dropped.push(`${nm}: naziv nedostaje na ${missing.join(", ")}`);
  if (!out.pairings.length && !out.styles.length) dropped.push(`${nm}: bez oznaka — neće se nuditi u "Pomozi mi odabrati"`);
  if (!out.wines.length) dropped.push(`${nm}: nijedno vino nije odabrano`);
  return out;
});

if (!dishes.length) {
  console.log(JSON.stringify({ status: "failed", error: "Na jelovniku nije pronađeno nijedno jelo." }));
  process.exit(0);
}

console.log(JSON.stringify({
  status: "ready",
  result: {
    offer: { title: offer.title || {}, intro: offer.intro || {}, dishes },
    notes: String(result.notes || "").slice(0, 3000),
    dropped,
  },
}));

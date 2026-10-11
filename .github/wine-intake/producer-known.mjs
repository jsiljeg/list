// Dodaj vino — is this winery already on the list? (owner, 2026-10-11: "if we
// have the producer, it should say so").
//
//   node .github/wine-intake/producer-known.mjs intake/result.json
//
// Adds to result.json, from the files rather than from the model's word:
//   producer_status  "new"   the run wrote a new winery story (draft.producer)
//                    "known" the winery already has a story on the list
//                    "none"  neither — the card shows no winery story
//   producer_known   {name, blurb_hr, other_wines[]} for "known": the story the
//                    guest will read, and what else of theirs we pour.
// Matching is producerInfo()'s in js/app.js: the longest key of producers.json
// contained in the wine's producer name.
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const res = JSON.parse(readFileSync(file, "utf8"));
if (res.status !== "ready") process.exit(0);

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const producers = read("data/producers.json").producers;
const lib = read("library/wines.json").wines;
const list = read("lists/theatrium.json");

const keyFor = (producer) => {
  const p = String(producer || "").toLowerCase();
  let best = null;
  for (const k of Object.keys(producers)) {
    if (k.charAt(0) === "_") continue;
    if (p.includes(k.toLowerCase()) && (!best || k.length > best.length)) best = k;
  }
  return best;
};

const draft = res.draft || {};
const wine = draft.wine || (res.ref && lib[res.ref]) || {};
const key = keyFor(wine.producer);

const listed = new Set();
(function walk(n) {
  if (Array.isArray(n)) n.forEach(walk);
  else if (n && typeof n === "object") { if (n.ref) listed.add(n.ref); Object.values(n).forEach(walk); }
})(list);
const others = key ? [...listed].filter((r) => r !== res.ref && lib[r] && keyFor(lib[r].producer) === key)
  .map((r) => lib[r].name) : [];

if (draft.producer) {
  res.producer_status = "new";
  res.producer_known = null;
} else if (key) {
  res.producer_status = "known";
  res.producer_known = { name: key, blurb_hr: (producers[key].blurb || {}).hr || "", other_wines: others.slice(0, 6) };
} else {
  res.producer_status = "none";
  res.producer_known = null;
}
writeFileSync(file, JSON.stringify(res, null, 1) + "\n");
console.log(`producer: ${res.producer_status}${key ? ` (${key}, ${others.length} other wines listed)` : ""}`);

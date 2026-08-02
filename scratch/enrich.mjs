/* Targeted, sourced additions to the wine→food tags. One-shot; kept for the record.
   Each rule names the source and the gap it closes. Cap of 5 pairings per wine:
   a card is a suggestion, not an inventory, and 20 one-off tags were removed
   earlier for exactly that reason. */
import fs from "node:fs";
import { rankPairings } from "../scripts/lib/pairing-rank.mjs";

const CAP = 5;
const p = "library/wines.json";
const d = JSON.parse(fs.readFileSync(p, "utf8"));

const RULES = [
  {
    food: "veal",
    why: "Burgundy — red and white — is the veal wine, and Grüner is Austria's. " +
         "`veal` was on 9 of 308 wines, which is why Wiener Schnitzel under 60 € " +
         "could offer exactly one bottle (worldoffinewine.com on Schnitzel; " +
         "matchingfoodandwine on veal).",
    when: (i) => (/pinot noir|pinot nero|pinot crni|modri pinot/i.test(i.grape) && /^red_(light|medium)$/.test(i.style)) ||
                 /grüner|veltliner/i.test(i.grape) ||
                 (/chardonnay/i.test(i.grape) && i.style === "white_rich")
  },
  {
    food: "pasticada",
    why: "total-croatia-news and wineandmore both name pašticada as a Plavac mali " +
         "pairing; it was on two bottles and the kitchen serves the dish.",
    when: (i) => /plavac mali/i.test(i.grape) && /^red_(full|mature)$/.test(i.style) &&
                 /Dalmac|Pelješac|Hvar|Korčula|Komarna|Dingač|Postup/i.test(i.region || "")
  },
  {
    food: "truffles",
    why: "croatia.hr on Istrian Malvasia: 'particularly recommended with white " +
         "truffles'. Istria is truffle country and the list pours six Malvazija.",
    when: (i) => /malvazija istarska/i.test(i.grape) && /^white_/.test(i.style)
  },
  {
    food: "asparagus",
    why: "Sauvignon and Grüner are the two grapes that survive asparagus " +
         "(decanter.com, thekitchn on difficult foods). It was on three wines " +
         "while the kitchen serves asparagus in two dishes.",
    when: (i) => (/(^|,\s*)sauvignon blanc/i.test(i.grape) || /grüner|veltliner/i.test(i.grape)) &&
                 /^white_(aromatic|mineral|fresh)$/.test(i.style)
  },
  {
    food: "risotto",
    why: "vivino and grapeguru both make unoaked Chardonnay the risotto wine — " +
         "'an unoaked Chardonnay and a creamy Parmesan risotto just understand " +
         "each other'.",
    when: (i) => /chardonnay/i.test(i.grape) && /^white_(fresh|mineral)$/.test(i.style)
  },
  {
    food: "mushrooms",
    why: "Pinot Noir and mushroom is the pairing the Wellington research leans " +
         "on (matchingfoodandwine); mature Nebbiolo the same.",
    when: (i) => (/pinot noir|pinot nero|pinot crni/i.test(i.grape) && /^red_/.test(i.style)) ||
                 (/nebbiolo/i.test(i.grape) && i.style === "red_mature")
  }
];

const added = new Map(), skipped = new Map();
for (const [ref, w] of Object.entries(d.wines)) {
  const i = w.insight;
  if (!i || i.kind === "spirit" || !i.pairings) continue;
  i.grape = i.grape || "";
  for (const r of RULES) {
    if (i.pairings.includes(r.food)) continue;
    if (!r.when(i)) continue;
    if (i.pairings.length >= CAP) {
      if (!skipped.has(r.food)) skipped.set(r.food, []);
      skipped.get(r.food).push(`${w.producer} — ${w.name}`);
      continue;
    }
    i.pairings.push(r.food);
    if (!added.has(r.food)) added.set(r.food, []);
    added.get(r.food).push(`${w.producer} — ${w.name} (${i.style})`);
  }
}
/* Re-rank, because an appended tag is by definition in the wrong place. */
for (const w of Object.values(d.wines)) {
  const i = w.insight;
  if (i && i.kind !== "spirit" && i.pairings) i.pairings = rankPairings(i);
}

for (const r of RULES) {
  const list = added.get(r.food) || [];
  console.log(`\n### +${r.food} on ${list.length} wines`);
  console.log(`    ${r.why.replace(/\s+/g, " ")}`);
  for (const x of list.slice(0, 8)) console.log(`      ${x}`);
  if (list.length > 8) console.log(`      … and ${list.length - 8} more`);
  const sk = skipped.get(r.food) || [];
  if (sk.length) console.log(`    (skipped ${sk.length} already at ${CAP} tags)`);
}
fs.writeFileSync(p, (JSON.stringify(d, null, 1) + "\n").replace(/\n/g, "\r\n"), "utf8");
console.log("\nwritten");

/* The owner's point (2026-08-12): we pour sweet wine, so a dessert should not
   be short. The blocker was precision — the sweet Rieslings carried
   `fruit_desserts` and not `desserts`, so a pistachio soufflé and a tiramisu
   matched nothing on them. A late-harvest Riesling with a nut soufflé or a
   tiramisu is a fair pairing; `fruit_desserts` stays first, because a fruit
   tart is still what it does best. */
import { readFileSync, writeFileSync } from "node:fs";
import { rankPairings } from "../scripts/lib/pairing-rank.mjs";
const p = "library/wines.json";
const data = JSON.parse(readFileSync(p, "utf8"));
const w = data.wines;
const ADD = [
  ["jakopic--rajnski-rizling-izborna-berba-2019", "the sweet Riesling we pour by the glass"],
  ["weingut-joh-jos-prum--riesling-wehlener-sonnenuhr-auslese-2023", "70 €, the 60–120 band"],
  ["weingut-wittmann--riesling-aulerde-auslese-2015", "94 €, same band"],
  ["weingut-heymann-lowenstein--riesling-schieferterrassen-beerenauslese-2017-0-375-l", "115 €, same band"]
];
for (const [ref, why] of ADD) {
  const key = Object.keys(w).find((k) => k === ref) ||
    Object.keys(w).find((k) => k.startsWith(ref.slice(0, 40)));
  if (!key) { console.log("MISSING", ref); continue; }
  const ins = w[key].insight;
  const before = [...ins.pairings];
  ins.pairings = rankPairings({ ...ins, pairings: [...new Set([...before, "desserts"])] });
  console.log(`${w[key].producer} — ${w[key].name}  (${why})`);
  console.log(`   ${before.join(", ")}  →  ${ins.pairings.join(", ")}`);
}
writeFileSync(p, (JSON.stringify(data, null, 1) + "\n").replace(/\n/g, "\r\n"), "utf8");

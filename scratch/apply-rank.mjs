import fs from "node:fs";
import { rankPairings } from "../scripts/lib/pairing-rank.mjs";
const p = "library/wines.json";
const raw = fs.readFileSync(p, "utf8");
const d = JSON.parse(raw);
let moved = 0;
for (const [ref, w] of Object.entries(d.wines)) {
  const ins = w.insight;
  if (!ins || ins.kind === "spirit" || !ins.pairings) continue;
  const after = rankPairings(ins);
  if (after.join(",") !== ins.pairings.join(",")) { ins.pairings = after; moved++; }
}
fs.writeFileSync(p, (JSON.stringify(d, null, 1) + "\n").replace(/\n/g, "\r\n"), "utf8");
console.log(`reordered ${moved} wines`);

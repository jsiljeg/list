/* Where does a bottle's own note repeat what its producer card already says?
   Compares word overlap between note.hr and blurb.hr for every bottle. */
import { joinList } from "../scripts/lib/list.mjs";
import { readFileSync } from "node:fs";
const wines = joinList().list;
const pr = JSON.parse(readFileSync("data/producers.json", "utf8")).producers;
const key = (n) => { let b = null; for (const k of Object.keys(pr))
  if (n && n.toLowerCase().includes(k.toLowerCase()) && (!b || k.length > b.length)) b = k; return b; };
const words = (s) => new Set((s || "").toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 4));
const rows = [];
const walk = (n) => {
  if (!n || typeof n !== "object") return;
  if (n.insight && n.note && n.producer) {
    const k = key(n.producer);
    const blurb = k && pr[k].blurb ? pr[k].blurb.hr : "";
    const a = words(n.note.hr), b = words(blurb);
    if (a.size >= 4 && b.size) {
      const shared = [...a].filter((w) => b.has(w));
      rows.push({ p: n.producer, name: n.name, pct: shared.length / a.size, shared, note: n.note.hr });
    }
  }
  for (const v of Object.values(n)) walk(v);
};
walk(wines);
rows.sort((x, y) => y.pct - x.pct);
console.log("bottles whose note repeats their producer card (top 12):\n");
for (const r of rows.slice(0, 12))
  console.log(`  ${Math.round(r.pct * 100)}%  ${r.p} — ${r.name}\n        shared: ${r.shared.join(", ")}\n        note: ${r.note.slice(0, 110)}…\n`);

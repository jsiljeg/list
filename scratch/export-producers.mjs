/* Rebuilds scratch/producers-export.json from the live data, which is what
   build-producers-doc.mjs turns into the owner's proof sheet.

   The original export script was never kept, so the sheet silently went stale
   the moment a blurb changed. Run this first, then build-producers-doc.mjs.

   Producer -> record matching copies producerInfo() in js/app.js: the longest
   producers.json key *contained in* the producer string wins, which is why
   "Clai" must not beat "Clairin" and why "Čečavac & Gašpar" gets its own
   record rather than falling back to "Čečavac". */
import fs from "node:fs";
import { joinList } from "../scripts/lib/list.mjs";

const PROD = JSON.parse(fs.readFileSync("data/producers.json", "utf8")).producers;
const KEYS = Object.keys(PROD).sort((a, b) => b.length - a.length);
const recordFor = (name) => {
  const n = String(name || "").toLowerCase();
  const k = KEYS.find((key) => n.includes(key.toLowerCase()));
  return k ? { key: k, rec: PROD[k] } : { key: null, rec: null };
};

const { list, missing } = joinList();
if (missing.length) throw new Error("unresolved refs: " + missing.join(", "));

/* One bucket per producer string, in the order the list introduces them. */
const byProducer = new Map();
for (const sec of list.sections)
  for (const cat of sec.categories)
    for (const g of cat.groups)
      for (const it of g.items) {
        const p = it.producer || "";
        if (!byProducer.has(p)) byProducer.set(p, []);
        byProducer.get(p).push({
          name: it.name,
          kind: (it.insight && it.insight.kind) === "spirit" ? "spirit" : "wine",
          country: (it.insight && it.insight.country) || g.country || "",
          style: (it.insight && it.insight.style) || "",
          where: `${sec.id} ${it.price != null ? it.price + "€" : "—"}`,
        });
      }

const out = [];
for (const [producer, wines] of byProducer) {
  const { key, rec } = recordFor(producer);
  /* A wine sold by the glass and by the bottle is one entry listed twice; the
     sheet wants one line reading "glass 8€ · bottle-red 45€". */
  const merged = new Map();
  for (const w of wines) {
    const prev = merged.get(w.name);
    if (prev) prev.where += " · " + w.where;
    else merged.set(w.name, { ...w });
  }
  const kinds = new Set([...merged.values()].map((w) => w.kind));
  out.push({
    producer,
    key,
    region: (rec && rec.region) || "",
    hr: (rec && rec.blurb && rec.blurb.hr) || "",
    en: (rec && rec.blurb && rec.blurb.en) || "",
    country: [...merged.values()].map((w) => w.country).find(Boolean) || "",
    kind: kinds.size === 1 ? [...kinds][0] : "mixed",
    wines: [...merged.values()],
  });
}

fs.writeFileSync("scratch/producers-export.json", JSON.stringify(out, null, 1) + "\n");
const noBlurb = out.filter((p) => !p.hr).map((p) => p.producer || "(unnamed)");
console.log(`${out.length} producers exported, ${out.length - noBlurb.length} with a blurb`);
if (noBlurb.length) console.log("no blurb: " + noBlurb.join(", "));

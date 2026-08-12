/* Croatian estates, their Croatian blurb, and what the guest reads first. */
import { joinList } from "../scripts/lib/list.mjs";
import { readFileSync } from "node:fs";
const wines = joinList().list;
const producers = JSON.parse(readFileSync("data/producers.json", "utf8")).producers;

/* producers.json is keyed by short forms; resolve the way the app does. */
const keyFor = (name) => {
  let best = null;
  for (const k of Object.keys(producers))
    if (name && name.toLowerCase().includes(k.toLowerCase()) && (!best || k.length > best.length)) best = k;
  return best;
};

const hr = new Map();
const walk = (n) => {
  if (!n || typeof n !== "object") return;
  if (n.insight && n.producer && n.insight.country === "FR") {
    const k = keyFor(n.producer);
    if (k && !hr.has(k)) hr.set(k, { key: k, producer: n.producer, wines: 0 });
    if (k) hr.get(k).wines++;
  }
  for (const v of Object.values(n)) walk(v);
};
walk(wines);

const firstSentence = (s) => {
  const m = s.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
};
const rows = [...hr.values()].map((r) => {
  const b = producers[r.key] && producers[r.key].blurb && producers[r.key].blurb.hr;
  return { ...r, blurb: b || "" };
}).filter((r) => r.blurb);

rows.sort((a, b) => b.wines - a.wines);
console.log(`${rows.length} Croatian estates with a Croatian blurb\n`);
for (const r of rows) {
  const first = firstSentence(r.blurb);
  const years = [...new Set(r.blurb.match(/\b(1[0-9]|20)\d{2}\b/g) || [])];
  const opensOnYear = /\b(1[0-9]|20)\d{2}\b/.test(first);
  const opensOnFounding = /osnov|utemelj|obitelj.*(generacij|naraštaj)|generacij|naraštaj|tradicij|hektar/i.test(first);
  const flag = opensOnYear ? "YEAR" : opensOnFounding ? "FACT" : "";
  console.log(`--- ${r.key}  (${r.wines} wine${r.wines > 1 ? "s" : ""}, ${r.blurb.length} chars, years: ${years.join("/") || "none"}) ${flag ? "<<< " + flag : ""}`);
  console.log(`    ${first}`);
}

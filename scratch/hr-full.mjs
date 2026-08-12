import { readFileSync } from "node:fs";
const producers = JSON.parse(readFileSync("data/producers.json", "utf8")).producers;
const keys = process.argv.slice(2);
for (const k of keys) {
  const p = producers[k];
  if (!p || !p.blurb || !p.blurb.hr) { console.log(`### ${k}: none`); continue; }
  console.log(`\n### ${k}  (${p.blurb.hr.length} chars)`);
  console.log(p.blurb.hr);
}

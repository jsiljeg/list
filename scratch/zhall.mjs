/* Every category on the list, wine and not, in the Chinese view. */
import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 700 } });
p.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await p.goto("http://127.0.0.1:4173");
await p.click('#lang-buttons button[data-lang="zh"]');
await p.click("#story-enter");
await p.waitForSelector("#app:not(.hidden)");
const mode = process.argv[2];
console.log(await p.evaluate((mode) => {
  const cjk = (s) => /[\u3400-\u9FFF]/.test(s);
  const out = [];
  for (const s of DATA.sections) {
    if (mode === "nonwine" && !["spirits", "rakija-beer", "other"].includes(s.id)) continue;
    if (mode === "hr") { /* every Croatian wine */ }
    for (const c of s.categories) {
      const rows = [];
      for (const g of c.groups) for (const i of g.items) {
        const ins = i.insight; if (!ins) continue;
        if (mode === "hr" && (ins.country !== "HR" || ins.kind === "spirit")) continue;
        const raw = ins.region || "", ter = i.terroir || "";
        const parts = [];
        for (const [label, v] of [["reg", raw], ["ter", ter]]) {
          if (!v) continue;
          const o = localizeRegion(v);
          parts.push(`${label}: ${cjk(o) ? "" : "LAT "}${o}`);
        }
        if (parts.length) rows.push(`      ${i.producer} ${i.name}\n         ${parts.join("\n         ")}`);
      }
      if (rows.length) out.push(`  --- ${s.id}/${c.id} (${T().categories[c.id]}) ---\n` + rows.join("\n"));
    }
  }
  return out.join("\n");
}, mode));
await b.close();

/* For every dish x band: how many bottles, how many glasses, and how much the
   two lists overlap. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4193;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, baseURL: `http://127.0.0.1:${PORT}` });
const page = await ctx.newPage();
await page.goto("/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.setItem("theatrium-lang", "hr"));
await page.goto("/index.html", { waitUntil: "load" });
await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
const enter = page.locator("#story-enter");
if (await enter.isVisible()) await enter.click();

const out = await page.evaluate(() => {
  const strip = (n) => String(n).replace(/\s*[–—-]\s*\d+(?:[.,]\d+)?\s*l\s*$/i, "");
  const res = [];
  for (const d of MENU.dishes) {
    for (const k of ["b1", "b2", "b3", "any"]) {
      helperState.dish = d; helperState.picks = null; helperState.mode = "bottle";
      renderHelperResults(k);
      const b = helperState.picks.bottles.map((r) => r.item.producer + "|" + strip(r.item.name));
      const g = helperState.picks.glasses.map((r) => r.item.producer + "|" + strip(r.item.name));
      const overlap = b.filter((x) => g.includes(x)).length;
      res.push({ dish: d.name.hr, k, b: b.length, g: g.length, overlap,
                 union: new Set([...b, ...g]).size });
    }
  }
  hideModal();
  return res;
});
const short = out.filter((r) => r.b < 3);
console.log(`bottle answers under three: ${short.length} of ${out.length}`);
for (const r of short) console.log(`   ${r.b} bottles  ${r.k.padEnd(4)} ${r.dish}`);
const dup = out.filter((r) => r.overlap > 0 && r.b >= 3 && r.g >= 3);
console.log(`\nboth lists full but overlapping: ${dup.length}`);
for (const r of dup.slice(0, 10)) console.log(`   overlap ${r.overlap}, union ${r.union}  ${r.k.padEnd(4)} ${r.dish}`);
const glassShort = out.filter((r) => r.g < 3);
console.log(`\nglass answers under three: ${glassShort.length}`);
await browser.close(); server.kill(); process.exit(0);

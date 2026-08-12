/* The full shortage report: every dish x band where either answer cannot fill
   three, with the reason. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4194;
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

const rows = await page.evaluate(() => {
  const BANDS = { b1: "do 60 €", b2: "60–120 €", b3: "120 €+", any: "Ikone 500 €+" };
  const out = [];
  for (const d of MENU.dishes) {
    for (const k of Object.keys(BANDS)) {
      helperState.dish = d; helperState.picks = null; helperState.mode = "bottle";
      renderHelperResults(k);
      out.push({ dish: d.name.hr, band: BANDS[k], key: k,
        b: helperState.picks.bottles.length, g: helperState.picks.glasses.length,
        wines: helperState.picks.bottles.map((r) => r.item.name).join(" · ") });
    }
  }
  hideModal();
  return out;
});
console.log("BOTTLE — cannot fill three:");
for (const r of rows.filter((r) => r.b < 3))
  console.log(`  ${r.b}/3  ${r.band.padEnd(13)} ${r.dish}`);
console.log("\nGLASS — cannot fill three (the glass list ignores the band, so one row per dish):");
const seen = new Set();
for (const r of rows.filter((r) => r.g < 3)) {
  if (seen.has(r.dish)) continue;
  seen.add(r.dish);
  console.log(`  ${r.g}/3  ${r.dish}`);
}
await browser.close(); server.kill(); process.exit(0);

/* Does a rewritten blurb reach an open page within the poll interval? */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const PORT = 4196;
const p = "data/producers.json";
const original = readFileSync(p, "utf8");
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
await page.waitForTimeout(300);
const before = await page.evaluate(() => PRODUCERS["Mount Gay"].blurb.hr.slice(0, 40));
/* edit the file under the running page, exactly as a deploy would */
const edited = JSON.parse(original);
edited.producers["Mount Gay"].blurb.hr = "ZAMIJENJENO USRED SERVISA — " + edited.producers["Mount Gay"].blurb.hr;
writeFileSync(p, JSON.stringify(edited, null, 1) + "\n", "utf8");
/* two poll ticks, driven directly rather than waiting 30s */
await page.evaluate(() => pollData());
await page.waitForTimeout(400);
await page.evaluate(() => pollData());
await page.waitForTimeout(400);
const after = await page.evaluate(() => PRODUCERS["Mount Gay"].blurb.hr.slice(0, 40));
writeFileSync(p, original, "utf8");
console.log("before poll :", before);
console.log("after poll  :", after);
console.log(after.startsWith("ZAMIJENJENO") ? "\n  ✓ a blurb edit reaches an open page without a reload" : "\n  ✗ still needs a reload");
await browser.close(); server.kill(); process.exit(0);

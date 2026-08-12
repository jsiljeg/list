import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4191;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
for (const [name, vp] of [["tablet", { width: 1024, height: 768 }], ["laptop", { width: 1440, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, baseURL: `http://127.0.0.1:${PORT}` });
  const page = await ctx.newPage();
  await page.goto("/index.html", { waitUntil: "load" });
  await page.evaluate(() => localStorage.setItem("theatrium-lang", "hr"));
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
  const enter = page.locator("#story-enter");
  if (await enter.isVisible()) await enter.click();
  await page.waitForTimeout(200);
  await page.locator("#helper-open").click();
  await page.waitForTimeout(600);
  const g = await page.evaluate(() => {
    const r = document.querySelector("#modal-sheet").getBoundingClientRect();
    const cs = getComputedStyle(document.querySelector("#modal"));
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
             vh: window.innerHeight, align: cs.alignItems, pad: cs.paddingTop };
  });
  console.log(`${name} step 1 (dish picker): top ${g.top}, bottom ${g.bottom}, height ${g.h} of ${g.vh}  [align-items: ${g.align}, padding-top ${g.pad}]`);
  await page.screenshot({ path: `scratch/shots/helper-step1-${name}.png` });
  await ctx.close();
}
await browser.close(); server.kill(); process.exit(0);

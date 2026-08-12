import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4183;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
for (const [name, vp, lg] of [["phone", { width: 390, height: 844 }, "hr"], ["tablet", { width: 1024, height: 768 }, "de"]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, baseURL: `http://127.0.0.1:${PORT}` });
  const page = await ctx.newPage();
  await page.goto("/index.html", { waitUntil: "load" });
  await page.evaluate((l) => localStorage.setItem("theatrium-lang", l), lg);
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
  const enter = page.locator("#story-enter");
  if (await enter.isVisible()) await enter.click();
  await page.waitForTimeout(200);
  await page.locator("#search-toggle").click();
  await page.fill("#search", "Wehlener Sonnenuhr");
  await page.waitForTimeout(400);
  await page.locator(".item").first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `scratch/shots/waiter-${name}-card.png` });
  await page.locator(".detail-waiter").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `scratch/shots/waiter-${name}.png` });
  await ctx.close();
}
await browser.close(); server.kill(); process.exit(0);

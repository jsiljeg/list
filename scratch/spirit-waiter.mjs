import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4195;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, baseURL: `http://127.0.0.1:${PORT}` });
const page = await ctx.newPage();
await page.goto("/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.setItem("theatrium-lang", "hr"));
await page.goto("/index.html", { waitUntil: "load" });
await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
const enter = page.locator("#story-enter");
if (await enter.isVisible()) await enter.click();
await page.waitForTimeout(200);
for (const [label, query] of [["rum", "Sajous"], ["beer", "Pils"], ["water", "Jana"], ["wine", "Sagul"]]) {
  if (!(await page.locator("#search-bar.open").count())) await page.locator("#search-toggle").click();
  await page.fill("#search", query);
  await page.waitForTimeout(350);
  await page.locator(".item").first().click();
  await page.waitForTimeout(250);
  const btn = await page.locator(".detail-waiter").innerText().catch(() => "(no button)");
  if (await page.locator(".detail-waiter").count()) {
    await page.locator(".detail-waiter").click();
    await page.waitForTimeout(250);
    const hint = await page.locator(".waiter-hint").innerText();
    const shelf = await page.locator(".waiter-shelf").innerText().catch(() => "—");
    const price = await page.locator(".waiter-price").innerText().catch(() => "—");
    console.log(`${label.padEnd(6)} button "${btn}"  shelf "${shelf.replace(/\n/g, "/")}"  price ${price}  hint "${hint}"`);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}
await browser.close(); server.kill(); process.exit(0);

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4181;
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
await page.locator("#helper-open").click();
await page.locator(".helper-opt[data-dish]", { hasText: "Foie gras" }).first().click();
await page.locator(".helper-opt[data-k='b2']").click();
await page.waitForTimeout(500);
await page.screenshot({ path: "scratch/shots/stack-bottle.png" });
await page.locator(".helper-flip").click();
await page.waitForTimeout(500);
await page.screenshot({ path: "scratch/shots/stack-glass.png" });
await browser.close(); server.kill(); process.exit(0);

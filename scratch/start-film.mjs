/* A filmstrip of the language screen loading on a phone, plus whether the page
   is scrollable at all — a page taller than the visible area is what lets the
   address bar collapse, which moves everything. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
const PORT = 4187;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
mkdirSync("scratch/shots/film", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, baseURL: `http://127.0.0.1:${PORT}` });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 60, downloadThroughput: 3e6 / 8, uploadThroughput: 1e6 / 8 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.goto("/index.html", { waitUntil: "commit" }).catch(() => {});
await page.waitForTimeout(120);
const t0 = Date.now();
for (let i = 0; i < 12; i++) {
  await page.screenshot({ path: `scratch/shots/film/f${String(i).padStart(2, "0")}-${Date.now() - t0}ms.png` });
  await page.waitForTimeout(90);
}
const geom = await page.evaluate(() => ({
  scrollH: document.documentElement.scrollHeight,
  clientH: document.documentElement.clientHeight,
  bodyH: Math.round(document.body.getBoundingClientRect().height),
  startH: Math.round(document.getElementById("start").getBoundingClientRect().height),
  scrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight
}));
console.log(geom);
await browser.close(); server.kill(); process.exit(0);

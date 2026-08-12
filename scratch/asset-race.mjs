/* What the first screen is waiting for, in order. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4188;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: `http://127.0.0.1:${PORT}` });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, latency: 60, downloadThroughput: 3e6 / 8, uploadThroughput: 1e6 / 8 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.goto("/index.html", { waitUntil: "load" });
await page.waitForTimeout(2500);
const rows = await page.evaluate(() => performance.getEntriesByType("resource")
  .map((e) => ({ n: e.name.split("/").slice(-1)[0].split("?")[0], s: Math.round(e.startTime), e: Math.round(e.responseEnd), b: e.transferSize }))
  .sort((a, b) => a.e - b.e));
for (const r of rows) console.log(`  ${String(r.e).padStart(5)}ms end  (start ${String(r.s).padStart(5)})  ${String(r.b).padStart(7)} B  ${r.n}`);
const shift = await page.evaluate(() => new Promise((res) => {
  let total = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) total += e.value; }).observe({ type: "layout-shift", buffered: true });
  setTimeout(() => res(total), 300);
}));
console.log(`\n  cumulative layout shift: ${shift.toFixed(4)}`);
await browser.close(); server.kill(); process.exit(0);

/* Who wins the race: the guest's tap, or the face? All times are in-page
   milliseconds since navigation start, so they are directly comparable. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4185;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
for (const [name, vp] of [["phone", { width: 390, height: 844 }], ["tablet", { width: 1024, height: 768 }]]) {
  for (const thr of [false, true]) {
    const ctx = await browser.newContext({ viewport: vp, baseURL: `http://127.0.0.1:${PORT}` });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    if (thr) {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false, latency: 70, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    await page.goto("/index.html", { waitUntil: "commit" });
    await page.locator(".lang-btn").first().waitFor({ state: "visible" });
    const t = await page.evaluate(() => {
      const e = performance.getEntriesByName(location.origin + "/assets/atrium-face.webp")[0];
      return {
        langScreen: Math.round(performance.now()),
        webpStart: e ? Math.round(e.startTime) : null,
        webpEnd: e ? Math.round(e.responseEnd) : null
      };
    });
    console.log(`${name}${thr ? " throttled" : "         "}: language screen at ${t.langScreen}ms, ` +
      `face ${t.webpStart}->${t.webpEnd}ms  =>  ${t.webpEnd <= t.langScreen ? "face ready before the guest can tap" : `face still ${t.webpEnd - t.langScreen}ms away`}`);
    await ctx.close();
  }
}
await browser.close(); server.kill(); process.exit(0);

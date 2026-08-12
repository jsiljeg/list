/* When does the nail face actually appear after the language tap?
   Taps the language button the instant it exists — the worst case, and what a
   returning guest who knows the screen does — then samples the splash every
   80ms and reports the first frame where the face has painted. Run with
   THROTTLE=1 for a restaurant-grade connection. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const PORT = 4182;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore"
});
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch();
for (const vpName of ["phone", "tablet"]) {
  const vp = vpName === "phone" ? { width: 390, height: 844 } : { width: 1024, height: 768 };
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, baseURL: `http://127.0.0.1:${PORT}` });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (process.env.THROTTLE) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency: 70, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  /* A cold visit: no service worker, no HTTP cache. */
  await page.goto("/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("theatrium-lang", ""));
  await ctx.clearCookies();
  await page.goto("about:blank");
  await page.goto("/index.html", { waitUntil: "commit" });

  /* Tap the first language the moment it is clickable. */
  await page.locator(".lang-btn").first().waitFor({ state: "visible" });
  const tapped = Date.now();
  await page.locator(".lang-btn").first().click();

  const shots = [];
  for (let i = 0; i < 16; i++) {
    const buf = await page.screenshot({ clip: { x: 0, y: 0, width: vp.width, height: vp.height } });
    shots.push({ t: Date.now() - tapped, buf });
    await page.waitForTimeout(40);
  }
  /* No pixel decoding needed: the face is thousands of nail heads, so the
     screenshot's PNG gets dramatically less compressible the moment it paints.
     The byte length is a perfectly good arrival signal. */
  const counts = shots.map((s) => ({ t: s.t, lit: s.buf.length }));
  const base = Math.min(...counts.map((c) => c.lit));
  const peak = Math.max(...counts.map((c) => c.lit));
  const arrived = counts.find((c) => c.lit > base + (peak - base) * 0.5);
  console.log(`\n${vpName}${process.env.THROTTLE ? " (1.6 Mbps, 4x CPU)" : " (unthrottled)"}`);
  console.log("  " + counts.map((c) => `${c.t}ms:${c.lit}`).join("  "));
  console.log(`  face visible from ~${arrived ? arrived.t : "?"}ms after the tap`);

  const timing = await page.evaluate(() => {
    const e = performance.getEntriesByName(location.origin + "/assets/atrium-face.webp")[0];
    const nav = performance.getEntriesByType("navigation")[0];
    return e ? {
      start: Math.round(e.startTime), end: Math.round(e.responseEnd),
      size: e.transferSize, domInteractive: Math.round(nav.domInteractive)
    } : null;
  });
  console.log(`  webp fetch: ${timing ? `${timing.start}ms -> ${timing.end}ms (${timing.size} B)` : "not in the timeline"}`);
  await ctx.close();
}
await browser.close();
server.kill();
process.exit(0);

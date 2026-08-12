/* How long does the face cost to decode, once the bytes are in cache? That is
   the work primeFace() moves off the moment of the language tap. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4184;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
for (const cpu of [1, 4, 6]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: `http://127.0.0.1:${PORT}` });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto("/index.html", { waitUntil: "load" });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  const ms = await page.evaluate(async () => {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const img = new Image();
      img.src = "assets/atrium-face.webp?" + i;   /* fresh decode each time */
      await img.decode().catch(() => {});
      const t0 = performance.now();
      const img2 = new Image();
      img2.src = img.src;
      await img2.decode().catch(() => {});
      runs.push(performance.now() - t0);
    }
    return runs.map((r) => Math.round(r));
  });
  console.log(`CPU x${cpu}: decode ${ms.join(" / ")} ms`);
  await ctx.close();
}
await browser.close(); server.kill(); process.exit(0);

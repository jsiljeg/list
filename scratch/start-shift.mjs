/* What moves on the language screen, and when.

   Samples the geometry of every element on the first screen from the moment it
   is visible until it has settled, on a cold load with the real font delay in
   the picture. Prints anything that moves more than a pixel, with the
   timestamps, so the cause is named rather than guessed at. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const PORT = 4186;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore"
});
await new Promise((r) => setTimeout(r, 800));

const SELECTORS = [
  ["logo", ".start-logo"],
  ["prompt", ".lang-prompt"],
  ["title", "#start-title"],
  ["buttons", "#lang-buttons"],
  ["btn-hr", "#lang-buttons .lang-btn:nth-child(1)"],
  ["btn-en", "#lang-buttons .lang-btn:nth-child(2)"],
  ["btn-zh", "#lang-buttons .lang-btn:nth-child(8)"],
  ["flag-hr", "#lang-buttons .lang-btn:nth-child(1) .flag-img, #lang-buttons .lang-btn:nth-child(1) svg"]
];

const snap = (page, sels) => page.evaluate((ss) => {
  const out = { t: Math.round(performance.now()) };
  for (const [name, sel] of ss) {
    const el = document.querySelector(sel);
    if (!el) { out[name] = null; continue; }
    const r = el.getBoundingClientRect();
    out[name] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  }
  return out;
}, sels);

const browser = await chromium.launch();
for (const [name, vp, slow] of [
  ["phone", { width: 390, height: 844 }, false],
  ["phone slow fonts", { width: 390, height: 844 }, true],
  ["tablet", { width: 1024, height: 768 }, false]
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, baseURL: `http://127.0.0.1:${PORT}` });
  const page = await ctx.newPage();
  /* Google's fonts really are a slow third party on a phone; hold them back so
     the swap lands where a guest would see it. */
  if (slow) await page.route("https://fonts.gstatic.com/**", async (r) => {
    await new Promise((res) => setTimeout(res, 1200));
    await r.continue();
  });
  await page.goto("/index.html", { waitUntil: "commit" });
  await page.evaluate(() => localStorage.removeItem("theatrium-lang")).catch(() => {});
  await page.goto("/index.html", { waitUntil: "commit" });

  const frames = [];
  await page.locator(".lang-btn").first().waitFor({ state: "visible" });
  for (let i = 0; i < 40; i++) {
    frames.push(await snap(page, SELECTORS));
    await page.waitForTimeout(50);
  }
  const last = frames[frames.length - 1];
  console.log(`\n=== ${name}`);
  for (const [key] of SELECTORS) {
    const settled = last[key];
    if (!settled) { console.log(`  ${key}: never appeared`); continue; }
    /* When did it last differ from where it ended up? */
    let lastMove = null, worst = 0;
    for (const f of frames) {
      const v = f[key];
      if (!v) continue;
      const d = Math.max(...v.map((n, i) => Math.abs(n - settled[i])));
      if (d > 1) { lastMove = f.t; worst = Math.max(worst, d); }
    }
    console.log(lastMove
      ? `  ${key.padEnd(8)} MOVES up to ${String(worst).padStart(4)}px, last at ${lastMove}ms  (settles at ${settled.join(",")})`
      : `  ${key.padEnd(8)} steady`);
  }
  await ctx.close();
}
await browser.close();
server.kill();
process.exit(0);

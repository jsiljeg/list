/* Screenshot the app from Node, using the Playwright that is already in
   node_modules. Companion to scripts/shot.py, which needs the Python package —
   and that one refuses to install on the Python 3.9 here (greenlet has no
   wheel). Same idea, fewer states: boot the test server, drive the app past the
   language screen, save PNGs, and report anything the console complained about.

     node scripts/shot.mjs                       list + detail, tablet
     node scripts/shot.mjs --vp phone --out dir

   This is a *look at it* tool, not a test — it asserts nothing. Read the PNGs. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const VIEWPORTS = {
  tablet: { width: 1024, height: 768, isMobile: false },
  phone: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  laptop: { width: 1440, height: 900, isMobile: false }
};

const vpName = arg("--vp", "tablet");
const out = resolve(arg("--out", "shots"));
const base = process.env.BASE || "http://127.0.0.1:4173";

mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...VIEWPORTS[vpName],
  hasTouch: vpName !== "laptop",
  reducedMotion: "reduce"
});
const page = await ctx.newPage();

const problems = [];
page.on("pageerror", (e) => problems.push("page error: " + e));
page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text()); });
page.on("response", (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });

await page.goto(base + "/index.html", { waitUntil: "load" });
await page.screenshot({ path: resolve(out, `${vpName}-start.png`) });

await page.evaluate(() => localStorage.setItem("theatrium-lang", "hr"));
await page.goto(base + "/index.html", { waitUntil: "load" });
await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
const enter = page.locator("#story-enter");
if (await enter.isVisible().catch(() => false)) await enter.click();
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(out, `${vpName}-list.png`) });

const counts = await page.evaluate(() => ({
  sections: DATA.sections.length,
  listings: DATA.sections.flatMap((s) => s.categories.flatMap((c) =>
    c.groups.flatMap((g) => g.items))).length,
  first: DATA.sections[0].categories[0].groups[0].items[0].name
}));

await page.locator("#content .item").first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(out, `${vpName}-detail.png`) });
const sheet = await page.locator(".detail-name").innerText().catch(() => "(none)");

console.log(`${vpName}: ${counts.listings} listings in ${counts.sections} sections`);
console.log(`  first wine: ${counts.first}   detail sheet opened: ${sheet}`);
console.log(problems.length ? "  PROBLEMS:\n   " + problems.join("\n   ") : "  no console/page/network errors");
console.log("  " + out);

await browser.close();

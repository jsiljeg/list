/* Every dish x budget, on the phone: does the helper sheet change height when
   the guest flips bottle <-> glass? Reports the worst offenders. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";

const PORT = 4180;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore"
});
await new Promise((r) => setTimeout(r, 800));

const geom = (page) => page.evaluate(() => {
  const s = document.querySelector("#modal-sheet");
  const r = s.getBoundingClientRect();
  return {
    top: Math.round(r.top), h: Math.round(r.height),
    rows: document.querySelectorAll("#modal-body .item").length,
    asides: document.querySelectorAll("#modal-body .item-aside").length,
    whyH: Math.round(document.querySelector(".helper-why")?.getBoundingClientRect().height || 0),
    flipTop: Math.round(document.querySelector(".helper-flip")?.getBoundingClientRect().top || 0),
    firstRowTop: Math.round(document.querySelector("#modal-body .item")?.getBoundingClientRect().top || 0),
    titleTop: Math.round(document.querySelector(".helper-title").getBoundingClientRect().top)
  };
});

const browser = await chromium.launch();
const ctx = await browser.newContext({
  width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  viewport: { width: 390, height: 844 }, baseURL: `http://127.0.0.1:${PORT}`
});
const page = await ctx.newPage();
await page.goto("/index.html", { waitUntil: "load" });
await page.evaluate(() => localStorage.setItem("theatrium-lang", "hr"));
await page.goto("/index.html", { waitUntil: "load" });
await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
const enter = page.locator("#story-enter");
if (await enter.isVisible()) await enter.click();
await page.waitForTimeout(200);

const dishes = await page.evaluate(() => MENU.dishes.map((d) => dishName(d)));
const budgets = await page.evaluate(() =>
  [...document.querySelectorAll("#modal-body button[data-k]")].map((b) => b.dataset.k));
const BUDGETS = budgets.length ? budgets : ["b1", "b2", "b3", "any"];

const out = [];
for (const dish of dishes) {
  for (const bk of ["b1", "b2", "b3", "any"]) {
    await page.evaluate(() => openHelper());
    await page.waitForTimeout(60);
    await page.evaluate((d) => {
      [...document.querySelectorAll("#modal-body button[data-dish]")]
        .find((x) => x.dataset.dish === d).click();
    }, dish);
    await page.waitForTimeout(60);
    await page.evaluate((k) => {
      document.querySelector(`#modal-body button[data-k="${k}"]`).click();
    }, bk);
    await page.waitForTimeout(120);
    const a = await geom(page);
    await page.locator(".helper-flip").click();
    await page.waitForTimeout(120);
    const b = await geom(page);
    out.push({ dish, bk, a, b, d: b.h - a.h, flipMove: b.flipTop - a.flipTop });
  }
}
await ctx.close();
await browser.close();
server.kill();

out.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
console.log("worst height changes (glass minus bottle):");
for (const r of out.slice(0, 18))
  console.log(`  ${String(r.d).padStart(5)}px  flip moves ${String(r.flipMove).padStart(5)}px  ` +
    `${r.bk.padEnd(4)} rows ${r.a.rows}->${r.b.rows} asides ${r.a.asides}->${r.b.asides} ` +
    `why ${r.a.whyH}->${r.b.whyH}  ${r.dish.slice(0, 34)}`);
const big = out.filter((r) => Math.abs(r.d) > 8);
console.log(`\n${big.length} of ${out.length} combinations change by more than 8px`);
const moved = (f) => out.filter((r) => Math.abs(r.b[f] - r.a[f]) > 2).length;
console.log(`sheet top moves in ${moved("top")} combinations (worst ` +
  `${Math.max(...out.map((r) => Math.abs(r.b.top - r.a.top)))}px)`);
console.log(`title top moves in ${moved("titleTop")}, first suggestion moves in ${moved("firstRowTop")}`);
for (const r of out.filter((x) => Math.abs(x.b.top - x.a.top) > 2))
  console.log(`  TOP MOVED ${r.b.top - r.a.top}px  ${r.bk} ${r.dish}  h ${r.a.h}->${r.b.h}`);
console.log(`rows differ in ${out.filter((r) => r.a.rows !== r.b.rows).length} combinations`);
console.log(`why-line height differs in ${out.filter((r) => r.a.whyH !== r.b.whyH).length}`);
process.exit(0);

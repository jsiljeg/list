import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const PORT = 4192;
const server = spawn(process.execPath, ["tests/serve.mjs"], {
  cwd: "C:/Users/Jure Siljeg/IdeaProjects/personal/list",
  env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const geom = (page) => page.evaluate(() => {
  const r = document.querySelector("#modal-sheet").getBoundingClientRect();
  const m = document.querySelector("#modal");
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
           vh: window.innerHeight, align: getComputedStyle(m).alignItems,
           padTop: getComputedStyle(m).paddingTop, cls: m.className };
});
for (const [name, vp] of [["tablet landscape", { width: 1024, height: 768 }],
                          ["tablet portrait", { width: 768, height: 1024 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, baseURL: `http://127.0.0.1:${PORT}` });
  const page = await ctx.newPage();
  await page.goto("/index.html", { waitUntil: "load" });
  await page.evaluate(() => localStorage.setItem("theatrium-lang", "hr"));
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
  const enter = page.locator("#story-enter");
  if (await enter.isVisible()) await enter.click();
  await page.waitForTimeout(200);
  await page.locator("#helper-open").click();
  await page.waitForTimeout(600);
  console.log(`\n${name}`);
  const g1 = await geom(page);
  console.log(`  1 dish picker : top ${String(g1.top).padStart(4)} bottom ${String(g1.bottom).padStart(4)} h ${g1.h} / ${g1.vh}   [${g1.align}, pad ${g1.padTop}]`);
  await page.locator(".helper-opt[data-dish]", { hasText: "Foie gras" }).first().click();
  await page.waitForTimeout(500);
  const g2 = await geom(page);
  console.log(`  2 budget      : top ${String(g2.top).padStart(4)} bottom ${String(g2.bottom).padStart(4)} h ${g2.h} / ${g2.vh}   [${g2.align}, pad ${g2.padTop}]`);
  await page.screenshot({ path: `scratch/shots/step2-${name.replace(" ", "-")}.png` });
  await page.locator(".helper-opt[data-k='b2']").click();
  await page.waitForTimeout(500);
  const g3 = await geom(page);
  console.log(`  3 answers     : top ${String(g3.top).padStart(4)} bottom ${String(g3.bottom).padStart(4)} h ${g3.h} / ${g3.vh}   [${g3.align}, pad ${g3.padTop}]`);
  console.log(`  modal classes : ${g3.cls}`);
  await ctx.close();
}
await browser.close(); server.kill(); process.exit(0);

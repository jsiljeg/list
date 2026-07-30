/* Page layout and assets.
   Guards: 92c6cbd (the footer floating mid-screen on a category too short to
   fill a tall tablet), 9d93aeb (the flag failing to parse and every flag
   rendering 0x0 — silently, with no console error), 860bc14 (the face fetched
   at the language tap instead of at page load, so the splash landed bare),
   de06836 (two badges must fit one row on a narrow screen), 4d19d29 (the card
   ending where its text ends). */
import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openApp, expectClean, pickSection, box } from "./helpers.mjs";

/* import.meta.dirname needs Node 20.11; this works everywhere. */
const HERE = dirname(fileURLToPath(import.meta.url));

test("the footer sits at the foot of the screen on a short category", async ({ page }) => {
  await openApp(page);
  await pickSection(page, "Ros");
  const gap = await page.evaluate(() =>
    Math.round(window.innerHeight - document.querySelector(".footer").getBoundingClientRect().bottom));
  /* Negative means the footer is below the fold, which is right for a long list.
     A large positive gap is the bug: the footer floating in the middle with the
     background below it. */
  expect(gap, "empty space under the footer").toBeLessThan(8);
});

test("the footer is below the fold on a long category", async ({ page }) => {
  await openApp(page);
  await pickSection(page, "Crna");
  const gap = await page.evaluate(() =>
    Math.round(window.innerHeight - document.querySelector(".footer").getBoundingClientRect().bottom));
  expect(gap).toBeLessThan(0);
});

test("the page never scrolls sideways", async ({ page }) => {
  await openApp(page);
  for (const cat of ["Crna", "Bijela", "Ros"]) {
    await pickSection(page, cat);
    const wide = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(wide, `${cat} makes the page wider than the viewport`).toBe(false);
  }
});

test("the header stays put while the list scrolls", async ({ page }) => {
  await openApp(page);
  await pickSection(page, "Crna");
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(200);
  const top = await page.evaluate(() => Math.round(document.querySelector(".header").getBoundingClientRect().top));
  expect(top, "header scrolled away").toBe(0);
});

test("the Croatian flag actually renders", async ({ page }) => {
  /* The official artwork uses <use xlink:href="#lion">. Without xmlns:xlink on
     the root the file fails to parse, every flag comes back 0x0, and there is no
     console error to notice — just broken-image icons. */
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForTimeout(400);
  const flags = await page.evaluate(() =>
    [...document.querySelectorAll(".flag-img")].map((i) => ({
      w: i.naturalWidth, h: i.naturalHeight, shown: Math.round(i.getBoundingClientRect().width)
    })));
  expect(flags.length, "no Croatian flag on the language screen").toBeGreaterThan(0);
  for (const f of flags) {
    expect(f.w, `flag decoded as ${f.w}x${f.h}`).toBe(60);
    expect(f.h).toBe(40);
    expect(f.shown, "flag rendered at zero width").toBeGreaterThan(10);
  }
});

test("every language button has a flag of the same size", async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForTimeout(300);
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll("#lang-buttons button")].map((b) => {
      const g = b.querySelector("svg, .flag-img");
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    }));
  expect(sizes.includes(null), "a language button has no flag").toBe(false);
  expect(new Set(sizes).size, `flags are different sizes: ${sizes.join(" ")}`).toBe(1);
});

test("the nail face is fetched at page load, not at the language tap", async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForTimeout(900);
  const hit = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .filter((r) => r.name.includes("atrium-face"))
      .map((r) => ({ init: r.initiatorType, end: Math.round(r.responseEnd) })));
  expect(hit.length, "face not requested before the language screen was answered").toBe(1);
  expect(hit[0].init, "face is not coming from the preload link").toBe("link");
});

test("two badges fit one row on the narrowest screen", async ({ page }) => {
  /* de06836. Wines carrying both "Izvrsna berba" and "Rijetka boca" wrapped. */
  test.skip(page.viewportSize().width > 420, "narrow screens only");
  await openApp(page);
  await page.locator("#search-toggle").click();
  await page.fill("#search", "Yquem");
  await page.waitForTimeout(400);
  await page.locator(".item").first().click();
  await page.waitForTimeout(300);
  const rows = await page.evaluate(() => {
    const tags = [...document.querySelectorAll(".detail-tags .wine-tag")];
    return new Set(tags.map((t) => Math.round(t.getBoundingClientRect().top))).size;
  });
  if (rows > 0) expect(rows, "badges wrapped onto more than one row").toBeLessThanOrEqual(1);
});

test("no request 404s anywhere in a normal walk through the app", async ({ page }) => {
  const bag = await openApp(page);
  for (const cat of ["Bijela", "Crna", "Ros", "Deser"]) await pickSection(page, cat);
  await page.locator("#search-toggle").click();
  await page.fill("#search", "Barolo");
  await page.waitForTimeout(400);
  await page.locator(".item").first().click();
  await page.waitForTimeout(400);
  expectClean(bag);
});

test("every file referenced by the page exists", async ({ page, request }) => {
  await openApp(page);
  const refs = await page.evaluate(() => {
    const out = new Set();
    for (const el of document.querySelectorAll("[src], link[href]")) {
      const v = el.getAttribute("src") || el.getAttribute("href");
      if (v && !/^(https?:|data:|#)/.test(v)) out.add(v);
    }
    return [...out];
  });
  expect(refs.length).toBeGreaterThan(3);
  for (const r of refs) {
    const res = await request.get(new URL(r, "http://127.0.0.1:4173/").pathname);
    expect(res.status(), `${r} is missing`).toBe(200);
  }
});

test("no asset in assets/ has been left behind unreferenced", () => {
  /* Tidiness rather than a bug guard, but it is the check that would have caught
     assets/atrium-bowl.webp rotting in the repo after the mark was removed. */
  const ROOT = resolve(HERE, "..");
  const sources = ["index.html", "qr.html", "css/style.css", "js/app.js", "manifest.webmanifest", "sw.js"]
    .map((f) => { try { return readFileSync(resolve(ROOT, f), "utf8"); } catch { return ""; } })
    .join(" ");
  /* The QR files are print deliverables — qr.html embeds the png and the svg is
     what goes to a printer — so they are referenced by intent even when a grep
     of the app does not find them. */
  const KEEP = new Set(["qr.png", "qr.svg"]);
  const orphans = readdirSync(resolve(ROOT, "assets")).filter((f) => !KEEP.has(f) && !sources.includes(f));
  expect(orphans, "unreferenced files in assets/").toEqual([]);
});

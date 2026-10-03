/* The line under a search hit describes the wine, not its shelf
   (owner, 2026-10-03). It read "Bijela vina · Bijela vina · Francuska" on
   every bottled white, red, rosé and dessert wine, gave the glass and
   sparkling shelves no country at all, and said nothing about the wine.
   searchContext() in js/app.js builds it now; this checks every listing on the
   list, in all eight languages:

   - no segment repeats ("Bijela vina · Bijela vina", "Champagne … Champagne");
   - every wine names its country, and nothing prints a raw key or "undefined";
   - a glass pour says so, a bottle does not;
   - Champagne is only ever the place, never the type (owner: it is a region);
   - every sparkling wine shows body and dosage, and a rosé reads as rosé —
     including Selosse's, which is filed as a prestige cuvée. */
import { test, expect } from "@playwright/test";
import { openApp, expectClean } from "./helpers.mjs";

const LANGS = ["hr", "en", "it", "fr", "de", "zh", "sl", "es"];

test("every listing's search line, in every language", async ({ page }) => {
  const bag = await openApp(page);
  const problems = await page.evaluate((langs) => {
    const bad = [];
    for (const l of langs) {
      lang = l;                                     /* the app's own global */
      const t = T();
      DATA.sections.forEach((sec) => sec.categories.forEach((cat) => cat.groups.forEach((g) => g.items.forEach((item) => {
        const line = searchContext(item, sec, cat, g, t);
        const at = `${l} ${item.producer} — ${item.name}: "${line}"`;
        if (!line || /undefined|null|[a-z]+_[a-z]+/.test(line)) { bad.push(`${at} — empty, or a raw key`); return; }
        const segs = line.split(" · ").map((s) => s.trim().toLowerCase());
        if (new Set(segs).size !== segs.length) bad.push(`${at} — a segment repeats`);
        const ins = item.insight;
        if (!ins || ins.kind) return;
        if (ins.country && !line.includes(t.countries[ins.country])) bad.push(`${at} — no country`);
        if ((sec.id === "glass") !== line.startsWith(t.sections.glass)) bad.push(`${at} — glass marker wrong`);
        if (/^(sparkling|champagne)/.test(ins.style)) {
          const what = sec.id === "glass" ? segs[1] : segs[0];
          if (/champagne|香槟/.test(what)) bad.push(`${at} — Champagne used as the type, not the place`);
          if (!line.includes(t.bodies[ins.body])) bad.push(`${at} — no body`);
          if (!line.includes(ins.dosage)) bad.push(`${at} — no dosage`);
          if (/\bros[eé]\b/i.test(item.name) || /rose$/.test(ins.style))
            if (!line.includes(t.styles.sparkling_rose)) bad.push(`${at} — a rosé not called one`);
        }
      }))));
    }
    lang = "hr";
    return bad;
  }, LANGS);
  expect(problems.slice(0, 20), `${problems.length} problems`).toEqual([]);
  expectClean(bag);
});

test("a search shows the new line on the row", async ({ page }) => {
  await openApp(page);
  await page.click("#search-toggle");
  await page.fill("#search", "Carillon");
  const row = page.locator("#content .item").filter({ hasText: "Murgers" }).first();
  await expect(row).toContainText("Bijelo · bogato · Burgundija, Francuska");
  await expect(row).not.toContainText("Bijela vina · Bijela vina");
});

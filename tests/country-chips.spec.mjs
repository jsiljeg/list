/* Country chips on the bottle shelves (owner, 2026-11-24, after Mano's list).
   Guards the commit that added them: a chip per country with its count, a
   filter rather than a jump, and the filter dropped on leaving the section. */
import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const pick = (page, sec) => page.click(`#nav button[data-sec="${sec}"]`);

test("white bottles: one chip per country, counts add up, a tap filters", async ({ page }) => {
  await openApp(page);
  await pick(page, "bottle-white");
  const chips = page.locator(".country-chip");
  expect(await chips.count()).toBeGreaterThan(3);
  const nums = await page.locator(".country-chip .country-chip-n").allTextContents();
  const [all, ...rest] = nums.map(Number);
  expect(rest.reduce((a, b) => a + b, 0)).toBe(all);
  expect(await page.locator("#content .item").count()).toBe(all);

  await page.click('.country-chip[data-cc="IT"]');
  const it = Number(await page.locator('.country-chip[data-cc="IT"] .country-chip-n').textContent());
  expect(await page.locator("#content .item").count()).toBe(it);
  expect(await page.locator("#content h3.country").allTextContents()).toEqual(["Italija"]);

  await pick(page, "bottle-red");
  await pick(page, "bottle-white");
  expect(await page.locator("#content .item").count()).toBe(all);
});

test("sparkling is not grouped by country, and still gets chips from the wines", async ({ page }) => {
  await openApp(page);
  await pick(page, "bottle-sparkling");
  await expect(page.locator('.country-chip[data-cc="FR"]')).toBeVisible();
  await page.click('.country-chip[data-cc="FR"]');
  const n = Number(await page.locator('.country-chip[data-cc="FR"] .country-chip-n').textContent());
  expect(await page.locator("#content .item").count()).toBe(n);
});

test("the glass list and the spirits get no chips", async ({ page }) => {
  await openApp(page);
  for (const sec of ["glass", "spirits"]) {
    await pick(page, sec);
    expect(await page.locator(".country-chip").count()).toBe(0);
  }
});

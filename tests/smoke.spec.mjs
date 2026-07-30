/* The walk a guest actually takes. If any of this breaks the list is unusable,
   so it runs on every viewport and asserts hard on console noise — a JS error
   partway through render leaves a half-drawn list that looks like a data
   problem. */
import { test, expect } from "@playwright/test";
import { openApp, expectClean, pickSection, openWine } from "./helpers.mjs";
import { I18N_LANGS } from "./langs.mjs";

test("language screen, story splash, list", async ({ page }) => {
  const bag = { errors: [], console: [], bad: [] };
  page.on("pageerror", (e) => bag.errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") bag.console.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) bag.bad.push(`${r.status()} ${r.url()}`); });

  await page.goto("/index.html", { waitUntil: "load" });
  await expect(page.locator("#start")).toBeVisible();
  await expect(page.locator("#lang-buttons button")).toHaveCount(I18N_LANGS.length);

  await page.locator("#lang-buttons button").first().click();
  await expect(page.locator("#story-screen")).toBeVisible();
  await expect(page.locator("#story-body")).not.toBeEmpty();

  await page.locator("#story-enter").click();
  await expect(page.locator("#app")).toBeVisible();
  await expect(page.locator("#nav button").first()).toBeVisible();
  await expect(page.locator(".item").first()).toBeVisible();
  expectClean(bag);
});

test("the chosen language is remembered", async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.locator("#lang-buttons button").nth(1).click();   // English
  await page.locator("#story-enter").click();
  const stored = await page.evaluate(() => localStorage.getItem("theatrium-lang"));
  expect(stored).toBe("en");
  await page.reload({ waitUntil: "load" });
  /* Second visit skips the language screen entirely. */
  await expect(page.locator("#start")).toBeHidden();
});

test("every language renders the list without errors", async ({ page }) => {
  for (const lang of I18N_LANGS) {
    const bag = await openApp(page, { lang });
    await expect(page.locator(".item").first(), `${lang}: no wines rendered`).toBeVisible();
    await expect(page.locator("#subtitle")).not.toBeEmpty();
    expectClean(bag);
    page.removeAllListeners("pageerror");
    page.removeAllListeners("console");
    page.removeAllListeners("response");
  }
});

test("every section renders something", async ({ page }) => {
  const bag = await openApp(page);
  const chips = page.locator("#nav button");
  const n = await chips.count();
  expect(n, "no nav chips").toBeGreaterThan(5);
  for (let i = 0; i < n; i++) {
    await chips.nth(i).click();
    await page.waitForTimeout(260);
    const label = (await chips.nth(i).innerText()).trim();
    const content = await page.locator("#content").innerText();
    expect(content.length, `${label} rendered an empty page`).toBeGreaterThan(20);
  }
  expectClean(bag);
});

test("the four mode buttons each show something", async ({ page }) => {
  const bag = await openApp(page);
  for (const id of ["picks-toggle", "rated-toggle", "pride-toggle"]) {
    await page.locator(`#${id}`).click();
    await page.waitForTimeout(320);
    expect((await page.locator("#content").innerText()).length, `${id} rendered nothing`).toBeGreaterThan(20);
    await page.locator(`#${id}`).click();
    await page.waitForTimeout(200);
  }
  await page.locator("#helper-open").click();
  await expect(page.locator("#modal")).not.toHaveClass(/hidden/);
  await page.keyboard.press("Escape");
  expectClean(bag);
});

test("a wine card shows its insight fields", async ({ page }) => {
  const bag = await openApp(page);
  await openWine(page, "Dom Pérignon 2015");
  const body = await page.locator("#modal-body").innerText();
  for (const label of ["SORTA", "REGIJA", "TIJELO", "AROME I OKUSI", "UZ JELA"]) {
    expect(body, `card is missing ${label}`).toContain(label);
  }
  expectClean(bag);
});

test("tapping the logo returns to the language picker", async ({ page }) => {
  const bag = await openApp(page);
  await page.locator("#home-logo").click();
  await expect(page.locator("#start")).toBeVisible();
  expectClean(bag);
});

test("the regions view renders", async ({ page }) => {
  const bag = await openApp(page);
  await pickSection(page, "Regije");
  await expect(page.locator(".region-app").first()).toBeVisible();
  expectClean(bag);
});

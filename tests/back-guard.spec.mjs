/* The back button.
   Owner, 2026-07-30: a tablet on a restaurant table catches the back gesture by
   accident — a thumb near the bezel, a swipe that started too close to the edge.
   Leaving the list drops the guest on a blank tab and they have to find the QR
   code again. One press asks, two leave. */
import { test, expect } from "@playwright/test";
import { openApp, openWine } from "./helpers.mjs";

test.describe("touch devices", () => {
  test.skip(({ hasTouch }) => !hasTouch, "the guard is for touch devices only");

  test("one back press keeps the app and asks", async ({ page }) => {
    await openApp(page);
    await page.goBack();
    await page.waitForTimeout(300);
    await expect(page.locator("#app"), "the app was left on the first press").toBeVisible();
    await expect(page.locator("#exit-hint.show")).toBeVisible();
    await expect(page.locator("#exit-hint")).toHaveText(/natrag|back|indietro|retour|zur|返回|nazaj|atr/i);
  });

  test("the hint fades and the guard rearms", async ({ page }) => {
    await openApp(page);
    await page.goBack();
    await expect(page.locator("#exit-hint.show")).toBeVisible();
    await page.waitForTimeout(2600);
    await expect(page.locator("#exit-hint.show")).toHaveCount(0);
    /* Rearmed: a later stray press must ask again rather than leave. */
    await page.goBack();
    await page.waitForTimeout(300);
    await expect(page.locator("#app")).toBeVisible();
  });

  test("two presses in a row do leave", async ({ page }) => {
    /* Start somewhere that is recognisably not the list, so "left the app" is a
       fact about the URL rather than about whatever the previous entry held —
       openApp itself loads index.html twice to set the language. */
    await page.goto("/qr.html", { waitUntil: "load" });
    await openApp(page);
    await page.goBack();
    await page.waitForTimeout(250);
    await expect(page.locator("#exit-hint.show"), "the first press should ask").toBeVisible();
    await page.goBack();
    await page.waitForTimeout(600);
    for (let i = 0; i < 6 && page.url().includes("index.html"); i++) {
      await page.goBack();
      await page.waitForTimeout(250);
    }
    expect(page.url(), "two presses never got out of the list").toContain("qr.html");
  });

  test("back closes an open wine card instead of asking", async ({ page }) => {
    /* The card pushes its own entry, so back is the natural way out of it and
       must not be spent on the exit prompt. */
    await openApp(page);
    await openWine(page, "Barolo");
    await page.goBack();
    await page.waitForTimeout(350);
    await expect(page.locator("#modal")).toHaveClass(/hidden/);
    await expect(page.locator("#exit-hint.show")).toHaveCount(0);
    await expect(page.locator("#app")).toBeVisible();
  });
});

test("a pointer device is not guarded", async ({ page, hasTouch }) => {
  /* On a laptop the back button is deliberate, and a browser that refuses to go
     back the first time is worse than the problem it solves. */
  test.skip(hasTouch, "pointer devices only");
  await openApp(page);
  await page.goBack();
  await page.waitForTimeout(400);
  await expect(page.locator("#exit-hint.show")).toHaveCount(0);
});

/* Gestures.
   Guards: d800fea (swipe dead zones on tablet widths), 87bc6bf (page panning,
   scroll jump, dead ends), 6ce8a75 (left-swipe pan), 32e668d (swipe between
   sections), f982ff1/547126a (swipe between wines), 854e935 (swipe-to-close).

   Every one of those was a gesture that worked on one viewport and not another,
   or worked in the middle of the screen and not at the edge. So: real touch
   input through CDP, and always from the edge. */
import { test, expect } from "@playwright/test";
import { openApp, expectClean, pickSection, openWine, swipe, box } from "./helpers.mjs";

test.describe("swipe between sections", () => {
  test.skip(({ hasTouch }) => !hasTouch, "touch only");

  test("works from the very edge of the screen, long category", async ({ page }, info) => {
    const bag = await openApp(page);
    await pickSection(page, "Crna");
    const before = await page.evaluate(() => currentSection);
    const { height, width } = page.viewportSize();
    await swipe(page, { x: width - 8, y: height * 0.5 }, { x: 8, y: height * 0.5 });
    expect(await page.evaluate(() => currentSection), "edge swipe changed nothing").not.toBe(before);
    expectClean(bag);
  });

  test("works from the edge on a category too short to fill the screen", async ({ page }) => {
    /* Rosé is nine wines. Before the fix the bottom of this screen was footer,
       which sat outside the swipe area entirely. */
    const bag = await openApp(page);
    await pickSection(page, "Ros");
    const before = await page.evaluate(() => currentSection);
    const { height, width } = page.viewportSize();
    await swipe(page, { x: width - 8, y: height * 0.5 }, { x: 8, y: height * 0.5 });
    expect(await page.evaluate(() => currentSection)).not.toBe(before);
    expectClean(bag);
  });

  test("works over the footer", async ({ page }) => {
    await openApp(page);
    await pickSection(page, "Ros");
    const foot = await box(page, ".footer");
    expect(foot, "footer should be on screen for a short category").not.toBeNull();
    const before = await page.evaluate(() => currentSection);
    const { width } = page.viewportSize();
    await swipe(page, { x: width - 20, y: foot.y + foot.h / 2 }, { x: 20, y: foot.y + foot.h / 2 });
    expect(await page.evaluate(() => currentSection), "swipe over the footer did nothing").not.toBe(before);
  });

  test("the chip strip keeps its own gesture", async ({ page }) => {
    /* The strip scrolls sideways. If the section swipe steals that, the guest
       cannot reach the chips that are off-screen. */
    await openApp(page);
    const nav = await box(page, "#nav");
    const before = await page.evaluate(() => currentSection);
    const { width } = page.viewportSize();
    await swipe(page, { x: width - 40, y: nav.y + nav.h / 2 }, { x: 40, y: nav.y + nav.h / 2 });
    expect(await page.evaluate(() => currentSection), "swiping the chips changed section").toBe(before);
  });

  test("the mode buttons keep their own gesture", async ({ page }) => {
    await openApp(page);
    const tools = await box(page, "#picks-toggle");
    const before = await page.evaluate(() => currentSection);
    const { width } = page.viewportSize();
    await swipe(page, { x: width - 40, y: tools.y + tools.h / 2 }, { x: 40, y: tools.y + tools.h / 2 });
    expect(await page.evaluate(() => currentSection), "swiping the tools changed section").toBe(before);
  });

  test("the tabs are a ring — the last leads back to the first", async ({ page }) => {
    /* 87bc6bf: stopping dead at either end read as the gesture having failed. */
    await openApp(page);
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#nav button")).map((b) => b.dataset.sec));
    await page.evaluate((id) => { currentSection = id; renderNav(); renderContent(); }, ids.at(-1));
    await page.waitForTimeout(250);
    const { height, width } = page.viewportSize();
    await swipe(page, { x: width - 8, y: height * 0.5 }, { x: 8, y: height * 0.5 });
    expect(await page.evaluate(() => currentSection), "no wrap-around at the end").toBe(ids[0]);
  });

  test("the page never pans sideways", async ({ page }) => {
    /* 87bc6bf/6ce8a75: the section animation slides the list 40px, and without
       overflow clipping the browser panned the whole screen with the finger. */
    await openApp(page);
    const { height, width } = page.viewportSize();
    await swipe(page, { x: width - 8, y: height * 0.5 }, { x: 8, y: height * 0.5 });
    const scrolled = await page.evaluate(() => ({
      x: window.scrollX,
      docWider: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    }));
    expect(scrolled.x, "page panned horizontally").toBe(0);
    expect(scrolled.docWider, "document is wider than the viewport").toBe(false);
  });

  test("a new section starts at the top", async ({ page }) => {
    /* 87bc6bf: the scroll jump — you swiped and landed half-way down. */
    await openApp(page);
    await pickSection(page, "Crna");
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(150);
    const { height, width } = page.viewportSize();
    await swipe(page, { x: width - 8, y: height * 0.5 }, { x: 8, y: height * 0.5 });
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(40);
  });
});

test.describe("swipe inside the wine card", () => {
  test.skip(({ hasTouch }) => !hasTouch, "touch only");

  test("sideways steps to the next wine, even starting on the backdrop", async ({ page }) => {
    /* On a tablet the card is 700px inside a 1024px screen; the 160px each side
       used to be dead. */
    const bag = await openApp(page);
    const first = await openWine(page, "Meursault");
    const { height, width } = page.viewportSize();
    await swipe(page, { x: width - 6, y: height * 0.5 }, { x: 6, y: height * 0.5 });
    const second = await page.locator(".detail-name").innerText();
    expect(second, "swipe from the backdrop did not step").not.toBe(first);
    expectClean(bag);
  });

  test("sideways steps back again", async ({ page }) => {
    await openApp(page);
    const first = await openWine(page, "Meursault");
    const sheet = await box(page, "#modal-sheet");
    await swipe(page, { x: sheet.x + sheet.w - 30, y: sheet.y + 200 }, { x: sheet.x + 30, y: sheet.y + 200 });
    const second = await page.locator(".detail-name").innerText();
    await swipe(page, { x: sheet.x + 30, y: sheet.y + 200 }, { x: sheet.x + sheet.w - 30, y: sheet.y + 200 });
    const third = await page.locator(".detail-name").innerText();
    expect(second).not.toBe(first);
    expect(third, "stepping back did not return").toBe(first);
  });

  test("dragging the card down closes it", async ({ page }) => {
    await openApp(page);
    await openWine(page, "Meursault");
    const sheet = await box(page, "#modal-sheet");
    const { height } = page.viewportSize();
    await swipe(page, { x: sheet.x + sheet.w / 2, y: sheet.y + 60 },
                      { x: sheet.x + sheet.w / 2, y: sheet.y + 60 + height * 0.6 });
    await expect(page.locator("#modal")).toHaveClass(/hidden/);
  });

  test("dragging the backdrop down does not close it", async ({ page }) => {
    /* Only the card is draggable. Throwing the card off-screen from a gesture
       that started outside it is how the sheet used to get stuck mid-drag. */
    await openApp(page);
    await openWine(page, "Meursault");
    const sheet = await box(page, "#modal-sheet");
    const { height } = page.viewportSize();
    const x = sheet.x > 20 ? sheet.x / 2 : 4;
    await swipe(page, { x, y: height * 0.25 }, { x, y: height * 0.85 });
    await expect(page.locator("#modal")).not.toHaveClass(/hidden/);
  });

  test("the card is never left displaced after a gesture", async ({ page }) => {
    /* 6ce8a75 and 854e935: a half-finished drag left the sheet — and the ✕ with
       it — pushed off the screen, so nothing could be tapped. */
    await openApp(page);
    await openWine(page, "Meursault");
    const sheet = await box(page, "#modal-sheet");
    await swipe(page, { x: sheet.x + sheet.w / 2, y: sheet.y + 60 }, { x: sheet.x + sheet.w / 2, y: sheet.y + 100 });
    const t = await page.evaluate(() => getComputedStyle(document.getElementById("modal-sheet")).transform);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"], `sheet left at ${t}`).toContain(t);
    await expect(page.locator(".modal-close")).toBeVisible();
  });
});

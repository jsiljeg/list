/* data/unavailable.json — hiding a wine that ran out, without deleting it.

   Guards the feature added for the owner's "86 it tonight, pour it tomorrow"
   case. The filter runs once on load and rebuilds DATA, which is why the
   index test below matters most: every detail sheet is opened by an
   si/ci/gi/ii path into DATA, so a filter that removed a card from the DOM
   but not from DATA would open the wrong wine. */
import { test, expect } from "@playwright/test";
import { openApp, expectClean, wines } from "./helpers.mjs";

const everyWine = wines.sections.flatMap((s) => s.categories.flatMap((c) =>
  c.groups.flatMap((g) => g.items.map((i) => ({ name: i.name, producer: i.producer })))));

/** Serve a substitute unavailable.json for this page only. */
async function hide(page, rules) {
  await page.route("**/data/unavailable.json*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ hidden: rules }) }));
}

const names = (page) => page.locator("#content .item .item-name").allTextContents();

test("baseline: the wine is on the list before anything hides it", async ({ page }) => {
  const bag = await openApp(page);
  expect((await names(page)).join(" | ")).toContain("Blanc de Blancs");
  expectClean(bag);
});

test("a hidden wine leaves the list, the search and DATA", async ({ page }) => {
  await hide(page, [{ producer: "Meneghetti", name: "Blanc de Blancs" }]);
  const bag = await openApp(page);

  expect((await names(page)).join(" | ")).not.toContain("Blanc de Blancs");

  /* Not merely hidden from the rendered column — gone from the model, so
     search, the badge counts and Filho's selection all agree. */
  const inData = await page.evaluate(() =>
    DATA.sections.some((s) => s.categories.some((c) => c.groups.some((g) =>
      g.items.some((i) => i.name === "Blanc de Blancs")))));
  expect(inData).toBe(false);

  if (!(await page.locator("#search-bar.open").count())) await page.locator("#search-toggle").click();
  await page.fill("#search", "Meneghetti");
  await page.waitForTimeout(350);
  expect((await page.locator("#content").innerText()).includes("Blanc de Blancs")).toBe(false);
  expectClean(bag);
});

test("hiding a wine does not shift the wine below it", async ({ page }) => {
  /* Bregh Rose sits between Terbotz and Blanc de Blancs in glass/sparkling.
     With stale indices, tapping the third card would open the second wine. */
  await hide(page, [{ name: "Bregh Rose" }]);
  const bag = await openApp(page);

  const card = page.locator("#content .item").filter({ hasText: "Blanc de Blancs" }).first();
  await card.click();
  await expect(page.locator("#modal")).toBeVisible();
  await expect(page.locator(".detail-name")).toContainText("Blanc de Blancs");
  expectClean(bag);
});

test("a category emptied by hiding disappears from the nav", async ({ page }) => {
  /* spirits/vodka holds exactly one bottle. An empty chip that opens onto
     blank space reads as a broken app, not as a sold-out shelf. */
  await hide(page, [{ name: "Stolichnaya" }]);
  const bag = await openApp(page);
  const cats = await page.evaluate(() =>
    DATA.sections.flatMap((s) => s.categories.map((c) => c.id)));
  expect(cats).not.toContain("vodka");
  expectClean(bag);
});

test("`where` limits the hiding to the glass or the bottle list", async ({ page }) => {
  /* Meneghetti Red 2020 is poured by the glass and sold by the bottle. */
  await hide(page, [{ producer: "Meneghetti", name: "Red 2020", where: "glass" }]);
  const bag = await openApp(page);
  const where = await page.evaluate(() =>
    DATA.sections.filter((s) => s.categories.some((c) => c.groups.some((g) =>
      g.items.some((i) => i.name === "Red 2020" && i.producer === "Meneghetti")))).map((s) => s.id));
  expect(where).toEqual(["bottle-red"]);
  expectClean(bag);
});

test("hiding everything is treated as a mistake, and the full list survives", async ({ page }) => {
  await hide(page, everyWine);
  const bag = await openApp(page);
  const count = await page.evaluate(() =>
    DATA.sections.flatMap((s) => s.categories.flatMap((c) =>
      c.groups.flatMap((g) => g.items))).length);
  expect(count).toBeGreaterThan(300);
  expectClean(bag);
});

test("a broken or missing unavailable.json does not take the list down", async ({ page }) => {
  await page.route("**/data/unavailable.json*", (route) => route.fulfill({ status: 404, body: "" }));
  const bag = await openApp(page);
  expect((await names(page)).length).toBeGreaterThan(0);
  /* The 404 is the point of this test, so only the fatal half of expectClean. */
  expect(bag.errors, "uncaught page errors").toEqual([]);
  expect(bag.console.filter((c) => !/404/.test(c))).toEqual([]);
});

/* ---------- polling: the change has to reach a tablet already in use ---------- */

test("a wine hidden mid-session disappears without a reload", async ({ page }) => {
  /* The gap this closes: the app read the 86 list once, at load. A tablet on
     the charger picked a change up on the 3-minute idle reload, but one a guest
     was actually reading never reloaded, so a wine 86'd at the start of a long
     browse could still be ordered at the end of it. */
  let rules = [];
  await page.route("**/data/unavailable.json*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ hidden: rules }) }));
  const bag = await openApp(page);
  expect((await names(page)).join(" | ")).toContain("Blanc de Blancs");

  rules = [{ producer: "Meneghetti", name: "Blanc de Blancs" }];
  await page.evaluate(() => pollHidden());          /* the 30s tick, without the wait */
  await page.waitForTimeout(250);

  expect((await names(page)).join(" | ")).not.toContain("Blanc de Blancs");
  expectClean(bag);
});

test("a wine that comes back reappears without a reload", async ({ page }) => {
  /* dropHidden() runs against FULL, the untouched merged list, precisely so
     that deleting the line puts the wine back. Filtering DATA in place would
     be one-way. */
  let rules = [{ producer: "Meneghetti", name: "Blanc de Blancs" }];
  await page.route("**/data/unavailable.json*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ hidden: rules }) }));
  const bag = await openApp(page);
  expect((await names(page)).join(" | ")).not.toContain("Blanc de Blancs");

  rules = [];
  await page.evaluate(() => pollHidden());
  await page.waitForTimeout(250);

  expect((await names(page)).join(" | ")).toContain("Blanc de Blancs");
  expectClean(bag);
});

test("an open detail sheet is never rebuilt underneath the guest", async ({ page }) => {
  /* Sheets are addressed by an si/ci/gi/ii path into DATA. Re-filtering while
     one is open would leave the ‹ › arrows stepping onto the wrong wines — and
     snatching a card away from someone mid-read is worse than the wait. */
  let rules = [];
  await page.route("**/data/unavailable.json*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ hidden: rules }) }));
  const bag = await openApp(page);

  await page.locator("#content .item").filter({ hasText: "Terbotz" }).first().click();
  await expect(page.locator(".detail-name")).toContainText("Terbotz");

  rules = [{ name: "Bregh Rose" }];
  await page.evaluate(() => pollHidden());
  await page.waitForTimeout(250);

  /* Still the wine they opened, and the list behind it untouched for now. */
  await expect(page.locator(".detail-name")).toContainText("Terbotz");
  expect(await page.evaluate(() => hidePending !== null), "should be queued, not applied").toBe(true);

  await page.locator("#modal .detail-close, #modal-backdrop").first().click();
  await page.waitForTimeout(350);
  expect((await names(page)).join(" | ")).not.toContain("Bregh Rose");
  expect(await page.evaluate(() => hidePending)).toBe(null);
  expectClean(bag);
});

test("polling keeps the guest's place: section, search and scroll", async ({ page }) => {
  let rules = [];
  await page.route("**/data/unavailable.json*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ hidden: rules }) }));
  const bag = await openApp(page);

  if (!(await page.locator("#search-bar.open").count())) await page.locator("#search-toggle").click();
  await page.fill("#search", "Meneghetti");
  await page.waitForTimeout(350);
  const before = await page.locator("#content .item").count();

  rules = [{ name: "Stolichnaya" }];                /* nothing to do with the query */
  await page.evaluate(() => pollHidden());
  await page.waitForTimeout(250);

  expect(await page.inputValue("#search"), "the query survived the re-render").toBe("Meneghetti");
  expect(await page.locator("#content .item").count()).toBe(before);
  expectClean(bag);
});

test("an unreachable 86 list leaves the tablet showing what it has", async ({ page }) => {
  /* Restaurant wi-fi drops. The poll must fail quietly, not blank the list. */
  const bag = await openApp(page);
  const before = (await names(page)).length;
  await page.route("**/data/unavailable.json*", (route) => route.abort());
  await page.evaluate(() => pollHidden());
  await page.waitForTimeout(250);
  expect((await names(page)).length).toBe(before);
  expect(bag.errors, "uncaught page errors").toEqual([]);
});

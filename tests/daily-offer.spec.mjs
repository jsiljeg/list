/* The kitchen's daily offer in the sommelier ("Pomozi mi odabrati").

   Guards the branch wine-list-daily-offer (web/DAILY-OFFER.md). Owner,
   2026-10-02: the day's dishes belong only in the pairing recommendations —
   the same parity the list already has with the kitchen's menu — and nowhere
   else on the list. So:

   - today's tagged dishes appear as the first group in the dish picker, in
     the guest's language, and answer with the ordinary pairing flow;
   - an untagged dish is not offered (it could only answer with nothing);
   - Filhov izbor is untouched;
   - when the feed is down, empty or not today's, the helper is exactly the
     menu it always was — the tablets must never depend on the website. */
import { test, expect } from "@playwright/test";
import { openApp, expectClean } from "./helpers.mjs";

// the service day, rolling over at 03:00 UTC like the website and js/app.js
const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const feed = (date = today) => ({
  date,
  offer: {
    date,
    dishes: [
      { course: "mains", name: { hr: "Brancin s blitvom", en: "Sea bass with Swiss chard" },
        pairings: ["white_fish", "grilled_fish"], styles: ["white_mineral", "white_fresh"], wines: [] },
      { course: "starters", name: { hr: "Jelo bez oznaka" }, pairings: [], styles: [], wines: [] },
    ],
  },
});

async function helper(page) {
  await page.click("#helper-open");
  await expect(page.locator(".helper")).toBeVisible();
}

test("today's dishes lead the dish picker and get the usual pairing answer", async ({ page }) => {
  const bag = await openApp(page, { daily: feed() });
  await helper(page);
  await expect(page.locator(".helper-course").first()).toHaveClass(/helper-daily/);
  const first = page.locator(".helper-opts").first().locator(".helper-opt[data-dish]");
  await expect(first).toHaveText(["Brancin s blitvom"]);                 // the untagged dish is not offered
  await first.click();
  await page.locator(".helper-opt[data-k]").last().click();              // no budget limit
  await expect(page.locator(".helper-fordish").first()).toHaveText("Brancin s blitvom");
  await expect(page.locator("#modal-body .item").first()).toBeVisible();
  expectClean(bag);
});

test("the dish name follows the guest's language", async ({ page }) => {
  await openApp(page, { lang: "en", daily: feed() });
  await helper(page);
  await expect(page.locator(".helper-opts").first().locator(".helper-opt")).toHaveText(["Sea bass with Swiss chard"]);
});

test("Filhov izbor does not carry the daily offer", async ({ page }) => {
  await openApp(page, { daily: feed() });
  await page.click("#picks-toggle");
  await expect(page.locator("#content")).not.toContainText("Brancin s blitvom");
});

test("no offer, an old offer, or no feed at all: the picker is the menu alone", async ({ page }) => {
  for (const daily of [{ offer: null }, feed("2020-01-01")]) {
    await openApp(page, { daily });
    await helper(page);
    await expect(page.locator(".helper-daily")).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await page.route("https://theatrium.devinos.hr/api/dnevna-ponuda*", (r) => r.abort());
  await page.reload();
  await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
  const enter = page.locator("#story-enter");
  if (await enter.isVisible()) await enter.click();
  await helper(page);
  await expect(page.locator(".helper-daily")).toHaveCount(0);
});

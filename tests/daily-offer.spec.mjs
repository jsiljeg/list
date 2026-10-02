/* "Danas iz kuhinje" — the chef's daily offer at the top of Filhov izbor.

   Guards the branch wine-list-daily-offer (web/DAILY-OFFER.md). The feed is a
   different site, so the one property that matters most is that the list is
   unchanged when the feed is down, empty, or not today's — the tablets must
   never depend on the website. Then: wines are found in the list's own data
   (an unknown or 86'd wine is simply absent, never a bare dish), rows open
   the ordinary card, and the dish name follows the guest's language. */
import { test, expect } from "@playwright/test";
import { openApp, expectClean } from "./helpers.mjs";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(new Date());
const feed = (date = today) => ({
  date,
  offer: {
    date,
    dishes: [
      { course: "mains", name: { hr: "Brancin s blitvom", en: "Sea bass with Swiss chard" },
        description: { hr: "blitva, mladi krumpir", en: "chard, new potatoes" },
        wines: [{ name: "Friulano 2023", producer: "Vie di Romans" }, { name: "Chablis 2022", producer: "Pattes Loup" }] },
      { course: "starters", name: { hr: "Jelo bez vina s karte" },
        wines: [{ name: "Ne postoji 2020", producer: "Nitko" }] },
    ],
  },
});

async function picks(page) {
  await page.click("#picks-toggle");
  await page.waitForTimeout(300);
}

test("the daily offer leads Filhov izbor, with rows that open the card", async ({ page }) => {
  const bag = await openApp(page, { daily: feed() });
  await picks(page);
  const block = page.locator(".cat.daily");
  await expect(block).toHaveCount(1);
  await expect(block.locator("h3")).toHaveText(["Brancin s blitvom"]);   // the dish with no listed wine is left out
  await expect(block.locator(".item")).toHaveCount(2);
  await block.locator(".item.clickable").first().click();
  await expect(page.locator(".detail-name").first()).toContainText("Friulano");
  expectClean(bag);
});

test("the dish name follows the guest's language", async ({ page }) => {
  await openApp(page, { lang: "en", daily: feed() });
  await picks(page);
  await expect(page.locator(".cat.daily h3")).toHaveText(["Sea bass with Swiss chard"]);
});

test("nothing changes when there is no offer, an old one, or no feed at all", async ({ page }) => {
  for (const daily of [{ offer: null }, feed("2020-01-01")]) {
    await openApp(page, { daily });
    await picks(page);
    await expect(page.locator(".cat.daily")).toHaveCount(0);
    await expect(page.locator(".cat")).toHaveCount(1);
  }
  await page.route("https://theatrium.devinos.hr/api/dnevna-ponuda*", (r) => r.abort());
  await page.reload();
  await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
  const enter = page.locator("#story-enter");
  if (await enter.isVisible()) await enter.click();
  await picks(page);
  await expect(page.locator(".cat.daily")).toHaveCount(0);
});

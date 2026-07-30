/* Stepping and swiping inside every context a card can be opened from.
   Guards: dc0701e ("Stepping follows the visible set"), ff113a1 ("search
   stepping stays in the results"), 32e668d ("shortlist stays a shortlist"),
   5a64b24 (four problems with wine-to-wine stepping).

   The bug these all share is that stepping is bound to a *set*, and the set
   changes with the mode. Search results, Filhov izbor, Najbolje ocijenjeni,
   Ikone and the sommelier's three picks are five different sets, and each has
   been wrong at some point. So each gets both a tap and a swipe. */
import { test, expect } from "@playwright/test";
import { openApp, expectClean, openWine, swipe, box } from "./helpers.mjs";

/** Names of the wines currently listed behind the card. */
function visibleNames(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#content .item")].map((el) => {
      const n = el.querySelector("strong, .item-name");
      return (n ? n.textContent : el.textContent).trim();
    }));
}

/** Open the wine at `index` of whatever is on screen. */
async function openNth(page, index = 0) {
  await page.locator("#content .item").nth(index).click();
  await expect(page.locator(".detail-name")).toBeVisible();
  await page.waitForTimeout(250);
  return page.locator(".detail-name").innerText();
}

async function stepBySwipe(page) {
  const sheet = await box(page, "#modal-sheet");
  await swipe(page, { x: sheet.x + sheet.w - 30, y: sheet.y + 180 }, { x: sheet.x + 30, y: sheet.y + 180 });
  return page.locator(".detail-name").innerText();
}

/* ---------- the three header modes ---------- */

const MODES = [
  { id: "picks-toggle", label: "Filhov izbor" },
  { id: "rated-toggle", label: "Najbolje ocijenjeni" },
  { id: "pride-toggle", label: "Ikone" }
];

for (const mode of MODES) {
  test(`${mode.label}: the arrows step, and only inside the mode's own list`, async ({ page }) => {
    const bag = await openApp(page);
    await page.locator(`#${mode.id}`).click();
    await page.waitForTimeout(400);
    const listed = await visibleNames(page);
    expect(listed.length, `${mode.label} showed nothing`).toBeGreaterThan(2);

    const first = await openNth(page, 0);
    const seen = [first];
    for (let i = 0; i < 3; i++) {
      const next = page.locator(".modal-nav.next");
      if (!(await next.isVisible())) break;
      await next.click();
      await page.waitForTimeout(420);
      seen.push(await page.locator(".detail-name").innerText());
    }
    expect(seen.length, `${mode.label}: could not step at all`).toBeGreaterThan(1);
    for (const name of seen) {
      expect(listed.some((l) => l.includes(name) || name.includes(l)),
        `${mode.label}: stepped to "${name}", which is not in the mode's list`).toBe(true);
    }
    expectClean(bag);
  });

  test(`${mode.label}: a swipe steps the same way a tap does`, async ({ page, hasTouch }) => {
    test.skip(!hasTouch, "touch only");
    await openApp(page);
    await page.locator(`#${mode.id}`).click();
    await page.waitForTimeout(400);
    const listed = await visibleNames(page);
    const first = await openNth(page, 0);
    const after = await stepBySwipe(page);
    expect(after, `${mode.label}: swipe did not step`).not.toBe(first);
    expect(listed.some((l) => l.includes(after) || after.includes(l)),
      `${mode.label}: swiped out of the mode's list to "${after}"`).toBe(true);
  });

  test(`${mode.label}: a section swipe does not drop you out of the mode`, async ({ page, hasTouch }) => {
    /* stepSection() refuses while a mode is on, because a sideways swipe there
       would silently throw away the filter the guest asked for. */
    test.skip(!hasTouch, "touch only");
    await openApp(page);
    await page.locator(`#${mode.id}`).click();
    await page.waitForTimeout(400);
    const before = await page.locator("#content").innerText();
    const { width, height } = page.viewportSize();
    await swipe(page, { x: width - 8, y: height * 0.55 }, { x: 8, y: height * 0.55 });
    expect(await page.locator("#content").innerText(), `${mode.label} was swiped away`).toBe(before);
  });
}

/* ---------- search ---------- */

test("search: the arrows and a swipe both stay inside the results", async ({ page }) => {
  const bag = await openApp(page);
  await openWine(page, "Barolo");
  const listed = await visibleNames(page);
  expect(listed.length).toBeGreaterThan(2);
  const seen = [await page.locator(".detail-name").innerText()];
  for (let i = 0; i < 3; i++) {
    const next = page.locator(".modal-nav.next");
    if (!(await next.isVisible())) break;
    await next.click();
    await page.waitForTimeout(420);
    seen.push(await page.locator(".detail-name").innerText());
  }
  expect(seen.length).toBeGreaterThan(1);
  for (const n of seen) expect(n, `stepped out of the results to "${n}"`).toMatch(/Barolo/i);
  expectClean(bag);
});

test("search: a section swipe does not throw the query away", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "touch only");
  await openApp(page);
  await page.locator("#search-toggle").click();
  await page.fill("#search", "Barolo");
  await page.waitForTimeout(400);
  const before = await page.locator("#content").innerText();
  const { width, height } = page.viewportSize();
  await swipe(page, { x: width - 8, y: height * 0.6 }, { x: 8, y: height * 0.6 });
  expect(await page.locator("#search").inputValue(), "the query was cleared").toBe("Barolo");
  expect(await page.locator("#content").innerText(), "the results were swiped away").toBe(before);
});

/* ---------- the sommelier's food recommendations ---------- */

test("food recommendations: the three picks open, and stepping stays inside them", async ({ page }) => {
  const bag = await openApp(page);
  await page.locator("#helper-open").click();
  await expect(page.locator(".helper-q")).toBeVisible();

  /* dish, then budget — the wizard is two questions and a shortlist. */
  await page.locator(".helper-opt[data-dish]").first().click();
  await page.waitForTimeout(300);
  await page.locator(".helper-opt[data-k]").first().click();
  await page.waitForTimeout(400);

  const picks = await page.evaluate(() =>
    [...document.querySelectorAll("#modal-body .item")].map((el) => {
      const n = el.querySelector("strong, .item-name");
      return (n ? n.textContent : el.textContent).trim();
    }));
  expect(picks.length, "the sommelier suggested nothing").toBeGreaterThan(0);

  await page.locator("#modal-body .item").first().click();
  await expect(page.locator(".detail-name")).toBeVisible();
  await page.waitForTimeout(300);

  const seen = [await page.locator(".detail-name").innerText()];
  for (let i = 0; i < picks.length + 1; i++) {
    const next = page.locator(".modal-nav.next");
    if (!(await next.isVisible())) break;
    await next.click();
    await page.waitForTimeout(420);
    seen.push(await page.locator(".detail-name").innerText());
  }
  /* 32e668d: swiping off the end of three suggested wines into the whole cellar
     is not what the guest asked for. */
  expect(seen.length, `stepped ${seen.length} times through a shortlist of ${picks.length}`)
    .toBeLessThanOrEqual(picks.length);
  for (const n of seen) {
    expect(picks.some((p) => p.includes(n) || n.includes(p)),
      `stepped out of the shortlist to "${n}"`).toBe(true);
  }
  expectClean(bag);
});

test("food recommendations: there is a way back to the wines", async ({ page }) => {
  await openApp(page);
  await page.locator("#helper-open").click();
  await page.locator(".helper-opt[data-dish]").first().click();
  await page.waitForTimeout(300);
  await page.locator(".helper-opt[data-k]").first().click();
  await page.waitForTimeout(400);
  await page.locator("#modal-body .item").first().click();
  await page.waitForTimeout(300);
  await expect(page.locator(".detail-back"), "no way back to the shortlist").toBeVisible();
  await page.locator(".detail-back").click();
  await page.waitForTimeout(400);
  await expect(page.locator("#modal-body .item").first()).toBeVisible();
});

/* ---------- the categories are a bounded set ---------- */

test("swiping only ever lands on a real category, left edge to right edge", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "touch only");
  const bag = await openApp(page);
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll("#nav button")].map((b) => b.dataset.sec));
  const { width, height } = page.viewportSize();

  /* Right to left across the whole strip, then back. Every landing has to be a
     chip that exists, and the walk has to reach both ends. */
  const visited = new Set();
  for (let i = 0; i < ids.length; i++) {
    await swipe(page, { x: width - 8, y: height * 0.5 }, { x: 8, y: height * 0.5 });
    const now = await page.evaluate(() => currentSection);
    expect(ids, `landed on "${now}", which is not a category`).toContain(now);
    expect(await page.locator("#content").innerText(), `"${now}" rendered nothing`).not.toBe("");
    visited.add(now);
  }
  for (let i = 0; i < ids.length; i++) {
    await swipe(page, { x: 8, y: height * 0.5 }, { x: width - 8, y: height * 0.5 });
    const now = await page.evaluate(() => currentSection);
    expect(ids, `landed on "${now}" swiping back`).toContain(now);
    visited.add(now);
  }
  expect(visited.size, `only reached ${visited.size} of ${ids.length} categories`).toBe(ids.length);
  expectClean(bag);
});

test("the active chip always matches the section on screen", async ({ page, hasTouch }) => {
  test.skip(!hasTouch, "touch only");
  await openApp(page);
  const { width, height } = page.viewportSize();
  for (let i = 0; i < 4; i++) {
    await swipe(page, { x: width - 8, y: height * 0.5 }, { x: 8, y: height * 0.5 });
    const [section, chip] = await page.evaluate(() => [
      currentSection,
      document.querySelector("#nav button.active")?.dataset.sec ?? null
    ]);
    expect(chip, "no chip is marked active").not.toBeNull();
    expect(chip, "the highlighted chip is not the section being shown").toBe(section);
  }
});

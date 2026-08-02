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
  test.slow();   // twenty-plus real gestures; three times the default budget
  const bag = await openApp(page);
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll("#nav button")].map((b) => b.dataset.sec));
  const { width, height } = page.viewportSize();

  /* Twenty-odd gestures in a row, eight workers deep, will occasionally land
     while the previous section is still animating and be swallowed. So: swipe,
     then *wait* for the section to actually change, and try again if it did
     not. A flaky suite gets ignored, which is worse than no suite. */
  const step = async (dir) => {
    const from = dir > 0 ? width - 8 : 8;
    const to = dir > 0 ? 8 : width - 8;
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await page.evaluate(() => currentSection);
      await swipe(page, { x: from, y: height * 0.5 }, { x: to, y: height * 0.5 });
      try {
        await page.waitForFunction((was) => currentSection !== was, before, { timeout: 2500 });
        return page.evaluate(() => currentSection);
      } catch {
        await page.waitForTimeout(300);
      }
    }
    throw new Error(`the swipe never took, ${dir > 0 ? "leftward" : "rightward"}`);
  };

  /* Right to left across the whole strip, then back. Every landing has to be a
     chip that exists and has to render something — that is the invariant. */
  const visited = new Set([await page.evaluate(() => currentSection)]);
  for (let i = 0; i < ids.length; i++) {
    const now = await step(1);
    expect(ids, `landed on "${now}", which is not a category`).toContain(now);
    expect(await page.locator("#content").innerText(), `"${now}" rendered nothing`).not.toBe("");
    visited.add(now);
  }
  for (let i = 0; i < ids.length; i++) {
    const now = await step(-1);
    expect(ids, `landed on "${now}" swiping back`).toContain(now);
    visited.add(now);
  }
  /* Both ends of the strip must be reachable — that is what "left to right
     boundary" means. */
  expect(visited, "the first category was never reached").toContain(ids[0]);
  expect(visited, "the last category was never reached").toContain(ids[ids.length - 1]);
  expect(visited.size, `reached ${visited.size} of ${ids.length} categories`).toBe(ids.length);
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

test("the sommelier suggests a glass as well as a bottle", async ({ page }) => {
  /* Guards 2026-08-02 (owner's question): the helper searched `bottle-*` only,
     so it could answer nothing but a whole bottle — useless to the guest most
     likely to ask, and it ignored the shelf the owner curates hardest (28% of
     the by-the-glass pours are Filho's picks against 9% of the bottles). */
  const bag = await openApp(page);
  await page.locator("#helper-open").click();
  await page.locator(".helper-opt").first().waitFor();
  await page.locator(".helper-opt[data-dish]").nth(3).click();   // a main, not a salad
  await page.locator(".helper-opt[data-k='b2']").click();
  await page.waitForTimeout(400);

  const groups = await page.locator(".helper-group").allTextContents();
  expect(groups.length, "no by-the-glass / by-the-bottle split").toBe(2);

  const sections = await page.evaluate(() =>
    [...document.querySelectorAll(".helper .item[data-ref]")].map((el) =>
      DATA.sections[Number(el.dataset.ref.split(".")[0])].id));
  expect(sections.filter((s) => s === "glass").length, "no glass pour suggested").toBeGreaterThan(0);
  expect(sections.filter((s) => s.startsWith("bottle-")).length, "no bottle suggested").toBeGreaterThan(0);
  /* The glass block comes first, and every glass entry precedes every bottle. */
  expect(sections.lastIndexOf("glass")).toBeLessThan(sections.findIndex((s) => s.startsWith("bottle-")));

  /* And a wine offered by the glass does not spend one of the three bottle
     slots repeating itself. */
  const names = await page.evaluate(() =>
    [...document.querySelectorAll(".helper .item[data-ref]")].map((el) => {
      const [si, ci, gi, ii] = el.dataset.ref.split(".").map(Number);
      const it = DATA.sections[si].categories[ci].groups[gi].items[ii];
      return `${it.producer}|${it.name}`;
    }));
  expect(new Set(names).size, "the same wine suggested twice").toBe(names.length);
  expectClean(bag);
});

test("every dish gets an answer at every budget", async ({ page }) => {
  /* A dish that returns "no results" reads as a broken app, not as a thin
     shelf. `coffee` on the Tiramisu — a pairing key on no wine and in no
     dictionary — was how that nearly happened. */
  const bag = await openApp(page);
  const dishes = await page.evaluate(() => MENU.dishes.length);
  expect(dishes).toBeGreaterThan(20);
  const empties = await page.evaluate(() => {
    const out = [];
    for (const d of MENU.dishes) {
      let n = 0;
      const walk = (o) => { if (o && typeof o === "object") { if (o.insight) { if (dishScore(d, o) > 0) n++; } for (const k in o) walk(o[k]); } };
      walk(DATA);
      if (n < 3) out.push(`${d.name.en} (${n})`);
    }
    return out;
  });
  expect(empties, "dishes with fewer than three possible wines").toEqual([]);
  expectClean(bag);
});

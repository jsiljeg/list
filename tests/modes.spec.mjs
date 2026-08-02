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

test("the sommelier answers in one list, and offers the glass quietly", async ({ page }) => {
  /* Guards 2026-08-02, third attempt at this and the one the owner kept. The
     helper could only ever answer with a whole bottle; then it showed two
     glasses under every price band, which repeated the same wines four times
     and read as an error. Now: the budget question is the four bands it always
     was, the answer is three bottles and nothing else, and the glass is
     offered two quiet ways — a second price on the row when the same wine is
     poured by the glass, and one link to flip the whole answer over. */
  const bag = await openApp(page);
  const sectionOf = () => page.evaluate(() =>
    [...document.querySelectorAll(".helper .item[data-ref]")].map((el) =>
      DATA.sections[Number(el.dataset.ref.split(".")[0])].id));

  await page.locator("#helper-open").click();
  await page.locator(".helper-opt[data-dish]").first().waitFor();
  await page.locator(".helper-opt[data-dish]").nth(3).click();
  const keys = await page.locator(".helper-opt[data-k]").evaluateAll((els) => els.map((e) => e.dataset.k));
  expect(keys, "back to the four price bands the owner asked for").toEqual(["b1", "b2", "b3", "any"]);

  await page.locator(".helper-opt[data-k='b2']").click();
  await page.waitForTimeout(400);
  const bottles = await sectionOf();
  expect(bottles.length, "no suggestions at all").toBeGreaterThan(0);
  expect(bottles.every((s) => s.startsWith("bottle-")), `a glass leaked into the bottle answer: ${bottles}`).toBe(true);
  expect(await page.locator(".helper-group").count(), "one list needs no headings").toBe(0);

  /* The flip turns the whole answer into glasses, and back. */
  await page.locator(".helper-flip").click();
  await page.waitForTimeout(400);
  const glasses = await sectionOf();
  expect(glasses.length, "the flip returned nothing").toBeGreaterThan(1);
  expect(glasses.every((s) => s === "glass"), `a bottle leaked into the glass answer: ${glasses}`).toBe(true);
  await page.locator(".helper-flip").click();
  await page.waitForTimeout(400);
  expect((await sectionOf()).every((s) => s.startsWith("bottle-")), "the flip does not flip back").toBe(true);
  expectClean(bag);
});

test("the glass price on a suggestion is the real one, and only where it exists", async ({ page }) => {
  /* The inline offer is only honest if the wine really is poured by the glass
     at that price — it is read from the `glass` section of the same list, so a
     wine 86'd off one shelf and not the other must not keep advertising. */
  await openApp(page);
  const bad = await page.evaluate(() => {
    const truth = new Map();
    const sec = DATA.sections.find((s) => s.id === "glass");
    for (const c of sec.categories) for (const g of c.groups) for (const it of g.items)
      truth.set(`${it.producer}|${it.name}`, it.price);
    const out = [];
    /* Every bottle that also has a glass twin must price the glass below it. */
    for (const s of DATA.sections) {
      if (!s.id.startsWith("bottle-")) continue;
      for (const c of s.categories) for (const g of c.groups) for (const it of g.items) {
        const p = truth.get(`${it.producer}|${it.name}`);
        if (p != null && !(p > 0 && p < it.price))
          out.push(`${it.producer} — ${it.name}: glass ${p}, bottle ${it.price}`);
      }
    }
    return out;
  });
  expect(bad, "a by-the-glass price that is not below its bottle price").toEqual([]);
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

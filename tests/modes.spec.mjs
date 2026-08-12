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

test("the sommelier's sheet stays where the guest left it", async ({ page }) => {
  /* Guards 2026-08-12 — the owner, on a phone: tapping "Ipak bocu?" /
     "Radije na čašu?" made the window feel like it resized. It did. The sheet
     was centred, so any change in its height moved *both* edges by half of it,
     and the heights genuinely differ: measured across all 120 dish x budget
     combinations at 390px, 91 changed by more than 8px on the flip alone. Foie
     gras at b2 is the worst of them — three bottles against a single glass,
     278px — and it moved the flip button 140px out from under the thumb that
     had just tapped it. The wizard's own steps did it too: the dish list is
     long and the budget question is three buttons.

     One pixel of tolerance for sub-pixel layout; the bug was two orders of
     magnitude bigger than that. */
  const bag = await openApp(page);
  const sheetTop = () => page.evaluate(() =>
    Math.round(document.querySelector("#modal-sheet").getBoundingClientRect().top));
  const held = async (was, what) =>
    expect(Math.abs((await sheetTop()) - was), what).toBeLessThanOrEqual(2);

  await page.locator("#helper-open").click();
  await page.locator(".helper-opt[data-dish]").first().waitFor();
  /* Past the sheet's own 220ms entry animation, which slides it up 24px — read
     during it, the anchor is 24px low and everything after it "moves". */
  await page.waitForTimeout(400);
  const anchor = await sheetTop();

  await page.locator(".helper-opt[data-dish]", { hasText: "Foie gras" }).first().click();
  await page.waitForTimeout(300);
  await held(anchor, "the sheet moved between the dish list and the budget question");

  await page.locator(".helper-opt[data-k='b2']").click();
  await page.waitForTimeout(400);
  await held(anchor, "the sheet moved when the suggestions arrived");

  await page.locator(".helper-flip").click();
  await page.waitForTimeout(400);
  await held(anchor, "the sheet moved on the flip to glasses");

  await page.locator(".helper-flip").click();
  await page.waitForTimeout(400);
  await held(anchor, "the sheet moved on the flip back to bottles");

  /* The bottom edge does still move — a one-wine answer is shorter than a
     three-wine one — so the tap that flipped the list can end up over the
     backdrop, where a second tap would close the sommelier and lose both the
     dish and the budget. The backdrop ignores that beat. */
  /* Both clicks in one evaluate: the guard is 600ms wide and a round-trip per
     click is enough to outrun it on a loaded machine, which is a flaky test
     rather than a working app. */
  await page.evaluate(() => {
    document.querySelector(".helper-flip").click();
    document.getElementById("modal-backdrop").click();
  });
  await expect(page.locator("#modal"), "a tap in the wake of the flip closed the sommelier")
    .not.toHaveClass(/hidden/);
  /* A guest who actually wants out is never that fast, and still gets out. */
  await page.waitForTimeout(700);
  await page.locator("#modal-backdrop").click({ position: { x: 5, y: 5 } });
  await expect(page.locator("#modal"), "the backdrop stopped closing the sheet at all").toHaveClass(/hidden/);
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

test("coming back from a wine restores the sommelier's own frame", async ({ page }) => {
  /* Guards 2026-08-02 (owner, on a laptop): after opening a suggestion and
     tapping "Natrag na prijedloge", the sheet came back taller and no longer
     centred, and the ‹ › stepping arrows were still on screen — tapping one
     opened a wine from behind the suggestions.

     One cause for both. A wine card puts the modal in `detail-mode`, which is
     top-aligned and 87vh, and turns the arrows on; the back path re-rendered
     only `#modal-body` and left the frame as the card had set it. Both helper
     screens now go through `showModal()`, which is the one place that knows
     how to put the frame back.

     Updated 2026-08-12: this used to assert the suggestions come back
     *centred*, which is the behaviour the owner then found on a phone — a
     centred sheet moves both its edges by half of every height change. The
     sommelier has its own `helper-mode` frame now, anchored like the card but
     still sized to its content, so what the test guards is unchanged: the
     frame the guest left is the frame they come back to. */
  const bag = await openApp(page);
  const frame = () => page.evaluate(() => {
    const r = document.getElementById("modal-sheet").getBoundingClientRect();
    const cl = document.getElementById("modal").classList;
    return {
      detail: cl.contains("detail-mode"), helper: cl.contains("helper-mode"),
      top: Math.round(r.top), height: Math.round(r.height),
      arrows: [...document.querySelectorAll(".modal-nav")].filter((b) => !b.classList.contains("hidden")).length
    };
  });

  await page.locator("#helper-open").click();
  await page.locator(".helper-opt[data-dish]").nth(3).click();
  await page.locator(".helper-opt[data-k='b2']").click();
  await page.waitForTimeout(400);
  const before = await frame();
  expect(before.detail, "the suggestions are not a wine card").toBe(false);
  expect(before.helper, "the suggestions should be in the sommelier's own frame").toBe(true);
  expect(before.arrows, "no stepping arrows over the suggestions").toBe(0);

  await page.locator(".helper .item.clickable").first().click();
  await page.waitForTimeout(500);
  expect((await frame()).detail, "a wine card should be in detail mode").toBe(true);

  await page.locator(".detail-back").click();
  await page.waitForTimeout(500);
  const after = await frame();
  expect(after.detail, "detail-mode survived the way back").toBe(false);
  expect(after.arrows, "stepping arrows survived the way back").toBe(0);
  expect(after.helper, "the sommelier's frame did not come back").toBe(true);
  expect(Math.abs(after.height - before.height), "the sheet came back a different height").toBeLessThan(6);
  expect(Math.abs(after.top - before.top), "the sheet came back at a different height on screen").toBeLessThan(6);
  expectClean(bag);
});

test("the flip is a toggle, not a reroll, and offers different wines", async ({ page }) => {
  /* Guards 2026-08-02 (owner). Three rows either way, so the sheet never
     resizes under the guest; the same three bottles come back when you flip
     back, because the scoring's random tie-break otherwise reshuffled them;
     and the glass list skips whatever the bottle rows already advertised
     inline, so "Radije na čašu?" is three *more* options rather than the same
     wines again. */
  await openApp(page);
  const shown = () => page.evaluate(() =>
    [...document.querySelectorAll(".helper .item")].map((e) => ({
      id: (e.querySelector(".item-producer")?.childNodes[0].textContent.trim() || "") + "|" +
          e.querySelector(".item-name").textContent.trim(),
      aside: !!e.querySelector(".item-aside")
    })));

  for (const dish of [1, 3, 11]) {
    await page.locator("#helper-open").click();
    await page.locator(".helper-opt[data-dish]").nth(dish).click();
    await page.evaluate((i) => { document.body.dataset.dishIdx = String(i); }, dish);
    await page.locator(".helper-opt[data-k='b1']").click();
    await page.waitForTimeout(350);
    const bottles = await shown();
    expect(bottles.length, "a bottle answer should be three rows").toBe(3);

    await page.locator(".helper-flip").click();
    await page.waitForTimeout(350);
    const glasses = await shown();
    expect(glasses.length, "a glass answer should be three rows too").toBe(3);
    const advertised = new Set(bottles.filter((b) => b.aside).map((b) => b.id));
    const repeats = glasses.filter((g) => advertised.has(g.id)).map((g) => g.id);
    /* A repeat is allowed only where dropping it would leave a short list —
       three rows beats three *different* rows when the shelf cannot supply
       both. So it is a failure only when there were enough others to use. */
    const spare = await page.evaluate((adv) => {
      const d = MENU.dishes[Number(document.body.dataset.dishIdx)];
      const sec = DATA.sections.find((s) => s.id === "glass");
      let n = 0;
      for (const c of sec.categories) for (const g of c.groups) for (const it of g.items) {
        if (!it.insight) continue;
        const shares = (it.insight.pairings || []).some((p) => (d.pairings || []).includes(p));
        if (shares && !adv.includes(`${it.producer}|${it.name}`)) n++;
      }
      return n;
    }, [...advertised]);
    if (spare >= 3)
      expect(repeats, `the glass list repeats a wine already offered inline (${spare} others were free)`).toEqual([]);
    expect(glasses.every((g) => !g.aside), "a glass row should not advertise a glass").toBe(true);

    await page.locator(".helper-flip").click();
    await page.waitForTimeout(350);
    expect((await shown()).map((b) => b.id), "flipping back rerolled the bottles")
      .toEqual(bottles.map((b) => b.id));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
});

test("changing the budget answers with bottles, even from the glass view", async ({ page }) => {
  /* Guards 2026-08-02 (owner): flipping to glasses and then tapping
     "Promijeni budžet" asked a bottle question and came back with the same
     glass list — because a glass is not budget-filtered, so picking a new band
     changed nothing on screen. It reads as the app ignoring you. */
  const bag = await openApp(page);
  const sections = () => page.evaluate(() =>
    [...document.querySelectorAll(".helper .item[data-ref]")].map((el) =>
      DATA.sections[Number(el.dataset.ref.split(".")[0])].id));

  await page.locator("#helper-open").click();
  await page.locator(".helper-opt[data-dish]").nth(3).click();
  await page.locator(".helper-opt[data-k='b2']").click();
  await page.waitForTimeout(350);
  await page.locator(".helper-flip").click();
  await page.waitForTimeout(350);
  expect((await sections()).every((s) => s === "glass"), "should be showing glasses").toBe(true);

  await page.locator(".helper-budget").click();
  await page.locator(".helper-opt[data-k='b1']").click();
  await page.waitForTimeout(400);
  const after = await sections();
  expect(after.length, "a new budget returned nothing").toBeGreaterThan(0);
  expect(after.every((s) => s.startsWith("bottle-")), `still on glasses after changing the budget: ${after}`).toBe(true);
  await expect(page.locator(".helper-flip")).toContainText("čašu");
  expectClean(bag);
});

test("the same dish does not always get the same three bottles", async ({ page }) => {
  /* Guards 2026-08-02 (owner: "does that mean some bottles would be preferred
     against the others all the time?"). It did: the tie-break was 0.4, which
     only shuffled *exact* ties, so 25 of 120 dish x budget combinations were
     locked to one trio for ever and 80 bottles could never be suggested for
     anything. Widening it to one scoring step (3) lets comparable wines take
     turns without letting a materially worse match through — measured, the
     number of bottles the sommelier can ever propose went from 196 to 251.

     Sirloin steak at 60-120 € has a wide pool; ten openings showed at least
     seven different wines in every trial, so five is a safe floor. */
  await openApp(page);
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    await page.locator("#helper-open").click();
    await page.locator(".helper-opt[data-dish]", { hasText: "Sirloin steak" }).click();
    await page.locator(".helper-opt[data-k='b2']").click();
    await page.waitForTimeout(120);
    for (const n of await page.locator(".helper .item-name").allTextContents()) seen.add(n.trim());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }
  expect(seen.size, `only ${seen.size} different wines over ten openings`).toBeGreaterThanOrEqual(5);
});

test("a suggested wine names the food on its own card", async ({ page }) => {
  /* Guards 2026-08-02 (owner): "I don't want to have some wine recommendation
     for some food, but not to have that food in wine description". The score
     is three points per shared pairing *plus* three for the style, so a wine
     could be proposed on style alone — and 15.7% of all suggestions were. The
     guest tapped a wine recommended for their pea soup and read "beef, game,
     aged cheese".

     The fallback is deliberate and narrow: where *no* wine in the band shares
     a food, style-only beats an empty answer. That is four of 120
     combinations, all in the Ikone band where the shelf is tiny by design —
     so this checks the two bands with deep shelves, across every course. */
  test.setTimeout(90_000);
  await openApp(page);
  const dishes = await page.evaluate(() =>
    ["starters", "soups", "mains", "desserts"].flatMap((c) =>
      MENU.dishes.filter((d) => d.course === c).slice(0, 2).map((d) => d.name.hr)));
  const bad = [];
  for (const dish of dishes) {
    for (const k of ["b1", "b2"]) {
      await page.locator("#helper-open").click();
      await page.locator(".helper-opt[data-dish]", { hasText: dish }).first().click();
      await page.locator(`.helper-opt[data-k='${k}']`).click();
      await page.waitForTimeout(120);
      const rows = await page.evaluate((name) => {
        const d = MENU.dishes.find((x) => x.name.hr === name);
        return [...document.querySelectorAll(".helper .item[data-ref]")].map((el) => {
          const [si, ci, gi, ii] = el.dataset.ref.split(".").map(Number);
          const it = DATA.sections[si].categories[ci].groups[gi].items[ii];
          return { n: `${it.producer} — ${it.name}`,
                   shared: (it.insight.pairings || []).filter((p) => (d.pairings || []).includes(p)).length };
        });
      }, dish);
      expect(rows.length, `${dish} @ ${k} suggested nothing`).toBeGreaterThan(0);
      for (const r of rows) if (!r.shared) bad.push(`${dish} @ ${k}: ${r.n}`);
      await page.locator("#modal-close").click();
      await page.waitForTimeout(120);
    }
  }
  expect(bad, "suggested on style alone, with none of the dish's foods on the card").toEqual([]);
});

test("the suggestions say which foods they share with the dish", async ({ page }) => {
  /* Added 2026-08-02, in place of printing the kitchen's ingredient list here.
     The ingredients are 30 dishes x 8 languages that go stale the day the
     kitchen changes, and they tell a guest what they already know — they
     ordered the dish. What they cannot know is why *these* wines. */
  await openApp(page);
  await page.locator("#helper-open").click();
  await page.locator(".helper-opt[data-dish]").nth(3).click();
  await page.locator(".helper-opt[data-k='b2']").click();
  await page.waitForTimeout(400);
  const why = await page.locator(".helper-why").innerText();
  expect(why.length, "no explanation under the dish").toBeGreaterThan(6);
  /* Every word in it must be a food the dish actually asked for. */
  const ok = await page.evaluate((text) => {
    const d = MENU.dishes.find((x) => x.name[lang] === document.querySelector(".helper-fordish").firstChild.textContent.trim());
    const names = (d.pairings || []).map((p) => (I18N[lang].pairings[p] || p).toLowerCase());
    return text.split(":")[1].split(",").map((s) => s.trim().toLowerCase())
      .every((s) => names.some((n) => n.includes(s) || s.includes(n)));
  }, why);
  expect(ok, `"${why}" names a food the dish did not ask for`).toBe(true);
});

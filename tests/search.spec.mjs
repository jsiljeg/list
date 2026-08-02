/* Search.
   Guards: 2c9b0b1 (matching mid-word turned "burgun" into 94 hits because
   SEARCH_ALIAS feeds every Pinot its German names), the same commit's move of
   "brunello" from the sangiovese alias to the montalcino one, 4b03b95
   ("riesling" must never return Graševina), 0ef6aa0 (a synonym finds every wine
   of the variety), 1ff8119 + 4e58164 (a region under any of its names).

   Search is pure logic, so these drive itemHay/hayMatch directly over the whole
   dataset rather than typing into the box — faster, and it counts every hit
   rather than the handful that fit on screen. */
import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

test.describe.configure({ mode: "parallel" });

/** How many wines a query finds, and their names. */
async function find(page, query) {
  return page.evaluate((raw) => {
    const q = raw.toLowerCase();
    const qf = fold(q);
    const names = [];
    const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
    walk(DATA, (it) => {
      const hay = itemHay(it);
      if (hayMatch(hay, q) || (qf !== q && hayMatch(hay, qf))) names.push(it.name);
    });
    return names;
  }, query);
}

test("every spelling of Burgundy finds the same wines", async ({ page }) => {
  /* "burgun" used to match spätburgunder, grauburgunder, weissburgunder and
     blauburgunder mid-word and returned the entire Pinot family. */
  await openApp(page);
  const bourg = await find(page, "bourg");
  for (const q of ["burgun", "burgundija", "burgundy", "勃艮第"]) {
    const hits = await find(page, q);
    expect(hits.length, `"${q}" found ${hits.length}, "bourg" found ${bourg.length}`).toBe(bourg.length);
  }
  expect(bourg.length, "no Burgundy found at all").toBeGreaterThan(20);
});

test("the German synonyms still find their Pinots when typed in full", async ({ page }) => {
  await openApp(page);
  for (const q of ["blauburgunder", "spätburgunder", "crni pinot"]) {
    expect((await find(page, q)).length, `"${q}" found nothing`).toBeGreaterThan(0);
  }
  expect((await find(page, "grauburgunder")).length, "grauburgunder should find Pinot Grigio").toBeGreaterThan(0);
});

test("brunello returns Montalcino, not every Sangiovese", async ({ page }) => {
  await openApp(page);
  const hits = await find(page, "brunello");
  const sangiovese = await find(page, "sangiovese");
  expect(hits.length, "brunello is matching the whole Sangiovese shelf").toBeLessThan(sangiovese.length);
  /* Soldera's Case Basse never says Brunello on the label but is Sangiovese from
     Montalcino, and the montalcino alias is what reaches it. */
  expect(hits.some((n) => n.includes("Case Basse")), "Case Basse missing from brunello").toBe(true);
  expect(hits.every((n) => /Brunello|Case Basse/.test(n)), `unexpected hits: ${hits}`).toBe(true);
});

test("riesling never returns Graševina", async ({ page }) => {
  /* 4b03b95. They are unrelated grapes and Croatian calls one of them
     "graševina", which used to carry "rizling" in its alias text. */
  await openApp(page);
  const hits = await find(page, "riesling");
  expect(hits.length).toBeGreaterThan(0);
  const grasevina = await page.evaluate((names) => {
    const out = [];
    const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
    walk(DATA, (it) => { if (names.includes(it.name) && /gra[sš]evina/i.test(it.insight.grape || "")) out.push(it.name); });
    return out;
  }, hits);
  expect(grasevina, "riesling returned Graševina").toEqual([]);
});

test("a region is found under any of its names", async ({ page }) => {
  /* 1ff8119 and 4e58164: a Croatian guest types Pijemont, a German Piemont, a
     Frenchman Piémont — all one shelf. */
  await openApp(page);
  const groups = [
    ["toscana", "tuscany", "toskana"],
    ["piemonte", "piedmont", "piemont"],
    ["bourgogne", "burgundija"],
    ["dalmacija", "dalmatia"],
    ["istra", "istria"]
  ];
  for (const spellings of groups) {
    const counts = [];
    for (const q of spellings) counts.push((await find(page, q)).length);
    expect(Math.min(...counts), `${spellings[0]} found nothing`).toBeGreaterThan(0);
    /* Not exact equality: an exonym can legitimately reach one wine more. The
       English name of Dalmatinska zagora contains "Dalmatia", so "dalmatia"
       finds Baraka's Malena and "dalmacija" does not. What matters is that no
       spelling is a dead end or wildly out of step with its siblings. */
    const spread = Math.max(...counts) - Math.min(...counts);
    expect(spread, `${spellings.join("/")} gave ${counts.join("/")}`).toBeLessThanOrEqual(2);
  }
});

test("diacritics are optional", async ({ page }) => {
  await openApp(page);
  for (const [bare, exact] of [["plesivica", "plešivica"], ["peljesac", "pelješac"], ["cara", "čara"]]) {
    const a = (await find(page, bare)).length;
    const b = (await find(page, exact)).length;
    if (b > 0) expect(a, `"${bare}" should reach what "${exact}" reaches`).toBeGreaterThanOrEqual(b);
  }
});

test("a Chinese query still works", async ({ page }) => {
  /* CJK has no word boundaries, so hayMatch falls back to a substring search.
     If that branch ever goes, the whole Chinese view loses search. */
  await openApp(page, { lang: "zh" });
  for (const q of ["勃艮第", "霞多丽", "雷司令"]) {
    expect((await find(page, q)).length, `"${q}" found nothing`).toBeGreaterThan(0);
  }
});

test("the search box itself finds and opens a wine", async ({ page }) => {
  /* One end-to-end pass through the real UI, so a broken input binding cannot
     hide behind the unit-level checks above. */
  const bag = await openApp(page);
  await page.locator("#search-toggle").click();
  await page.fill("#search", "Dom Pérignon");
  await page.waitForTimeout(400);
  await expect(page.locator(".item").first()).toBeVisible();
  await page.locator(".item").first().click();
  await expect(page.locator(".detail-name")).toContainText("Dom Pérignon");
  expect(bag.errors).toEqual([]);
});

test("a query that matches nothing says so", async ({ page }) => {
  await openApp(page);
  await page.locator("#search-toggle").click();
  await page.fill("#search", "qqzzxx");
  await page.waitForTimeout(400);
  await expect(page.locator(".no-results")).toBeVisible();
});

test("the style of a wine is searchable, and wines come before spirits", async ({ page }) => {
  /* Guards 2026-08-02: the wine vocabulary was missing from the haystack while
     the spirit vocabulary was in it, so "orange" and "narančasto" found nothing
     and "macerat" found thirteen gins, vermouths and liqueurs and not one of
     the eleven orange wines. */
  await openApp(page);
  const orange = await find(page, "orange");
  expect(orange.length, '"orange" found nothing').toBeGreaterThanOrEqual(11);
  for (const q of ["macerirano", "narančasto", "macerato", "skin contact", "amber"]) {
    const hits = await find(page, q);
    expect(hits.length, `"${q}" found nothing`).toBeGreaterThanOrEqual(11);
  }
  /* Other styles answer to their own words too, in more than one language. */
  for (const q of ["pjenušavo", "trocken", "dolce", "desertno"]) {
    expect((await find(page, q)).length, `"${q}" found nothing`).toBeGreaterThan(0);
  }

  /* And the order on screen: a wine list answers "macerat" with wines first.
     The gins that macerate botanicals are the footnote, not the answer. */
  await page.locator("#search-toggle").click();
  await page.fill("#search", "macerat");
  await page.waitForTimeout(400);
  const kinds = await page.evaluate(() =>
    [...document.querySelectorAll(".item[data-ref]")].map((el) => {
      const [si, ci, gi, ii] = el.dataset.ref.split(".").map(Number);
      const it = DATA.sections[si].categories[ci].groups[gi].items[ii];
      return it.insight && !it.insight.kind ? "wine" : "other";
    }));
  expect(kinds.filter((k) => k === "wine").length, "no wines in the results").toBeGreaterThanOrEqual(11);
  expect(kinds.filter((k) => k === "other").length, "no spirits in the results").toBeGreaterThan(0);
  expect(kinds.indexOf("other"), "a spirit came before a wine")
    .toBe(kinds.lastIndexOf("wine") + 1);
});

test("Croatian shows Friuli, and Furlanija still finds it", async ({ page }) => {
  /* Guards 2026-08-02 (owner): the Croatian region line said "Furlanija" while
     every Croatian note said Friuli. The exonym stays searchable. */
  await openApp(page);
  expect(await page.evaluate(() => REGION_I18N["Friuli"].hr)).toBe("Friuli");
  expect(await page.evaluate(() => REGION_I18N["Friuli"].sl)).toBe("Furlanija");
  const friuli = await find(page, "friuli");
  expect(friuli.length, "no Friuli wines").toBeGreaterThan(5);
  expect((await find(page, "furlanija")).length, "the exonym stopped finding them")
    .toBeGreaterThanOrEqual(friuli.length);
});

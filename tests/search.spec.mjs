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

test("a wine is searchable by what it goes with and what it smells of", async ({ page }) => {
  /* Guards 2026-08-02: for a restaurant list, the food words were the odd gap —
     twenty of twenty-two a guest might type ("janjetina", "tartufi",
     "kamenice", "pršut", "biftek") returned nothing, though every one is
     already translated into eight languages in i18n.js. */
  await openApp(page);
  for (const q of ["janjetina", "tartufi", "truffles", "kamenice", "pršut", "biftek",
                   "gljive", "kavijar", "riba", "sir", "cheese", "oysters", "lamb"]) {
    expect((await find(page, q)).length, `"${q}" found nothing`).toBeGreaterThan(0);
  }
  /* Aromas too — a guest browsing by flavour rather than by grape. */
  for (const q of ["vanilija", "borovnica", "papar", "čokolada", "petrolej", "vanilla", "pepper"]) {
    expect((await find(page, q)).length, `"${q}" found nothing`).toBeGreaterThan(0);
  }
});

test("what a wine is outranks what it tastes of", async ({ page }) => {
  /* Guards 2026-08-02: once aromas became searchable, "orange" matched both the
     eleven orange wines and every wine with orange peel in its aromas, and the
     weaker sense buried the stronger one. Results are blocked: wines before
     spirits, and within each, identity before flavour. */
  await openApp(page);
  await page.locator("#search-toggle").click();
  for (const q of ["orange", "rose"]) {
    await page.fill("#search", q);
    await page.waitForTimeout(400);
    const tiers = await page.evaluate((query) =>
      [...document.querySelectorAll(".item[data-ref]")].map((el) => {
        const [si, ci, gi, ii] = el.dataset.ref.split(".").map(Number);
        const it = DATA.sections[si].categories[ci].groups[gi].items[ii];
        const wine = it.insight && !it.insight.kind ? 0 : 1;
        const core = hayMatch(itemCore(it), query) ? 0 : 1;
        return wine * 2 + core;
      }), q);
    expect(tiers.length, `"${q}" found nothing`).toBeGreaterThan(3);
    /* The block index must never decrease going down the list. */
    for (let i = 1; i < tiers.length; i++)
      expect(tiers[i], `"${q}" ranked block ${tiers[i]} after block ${tiers[i - 1]}`)
        .toBeGreaterThanOrEqual(tiers[i - 1]);
    expect(tiers[0], `"${q}" does not start with a wine matched on identity`).toBe(0);
  }
});

test("body words stay out of the haystack", async ({ page }) => {
  /* Guards 2026-08-02: body was added with style and sweetness and had to come
     back out. "Srednje puno" contains "puno", so a query of "puno" matched 276
     of 308 wines; English "medium" starts with "med", so a Croatian looking for
     honey got every wine that merely has a body. Correct, and useless. */
  await openApp(page);
  const all = await find(page, "");
  expect((await find(page, "puno")).length, '"puno" matches almost everything')
    .toBeLessThan(all.length / 3);
  const med = await find(page, "med");
  expect(med.length, '"med" is swallowed by "medium"').toBeLessThan(all.length / 2);
  expect(med.length, '"med" should still find the honeyed wines').toBeGreaterThan(10);
  /* The useful half survives through the style string. */
  expect((await find(page, "lagano")).length, '"lagano" found nothing').toBeGreaterThan(0);
});

test("a grape found under the name the guest knows", async ({ page }) => {
  /* Guards 2026-08-02: each of these was typed at the real app and returned
     nothing while the wine was on the shelf under another name. */
  await openApp(page);
  for (const [q, expected] of [["rebula", "ribolla"], ["maraština", "rukatac"], ["grenache", "garnacha"]]) {
    const hits = await find(page, q);
    expect(hits.length, `"${q}" found nothing, but we pour ${expected}`).toBeGreaterThan(0);
  }
  /* Colour and bubbles the way they are actually said, not as the card's
     adjective agreeing with *vino*. */
  for (const q of ["pjenušac", "bijela", "crna vina", "magnum", "parker"]) {
    expect((await find(page, q)).length, `"${q}" found nothing`).toBeGreaterThan(0);
  }
});

test("the flavour half of the results is labelled", async ({ page }) => {
  /* Guards 2026-08-02 (owner: "do we really want to search aromas?"). The
     results were never wrong, but a guest who typed "orange" and got 45 rows
     had no way to know the first twelve were the answer and the rest merely
     smell of it. The heading is the whole fix — and it appears only when both
     halves have content, so the common single-sense query stays clean. */
  await openApp(page);
  await page.locator("#search-toggle").click();

  await page.fill("#search", "orange");
  await page.waitForTimeout(400);
  expect(await page.locator(".search-group").count(), '"orange" needs its divider').toBe(1);
  const label = await page.locator(".search-group").innerText();
  expect(label.length, "the divider has no text").toBeGreaterThan(3);
  /* Everything above the divider is an identity match, everything below is not. */
  const split = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".cat > *")];
    const at = rows.findIndex((el) => el.classList.contains("search-group"));
    const core = (el) => {
      const [si, ci, gi, ii] = el.dataset.ref.split(".").map(Number);
      return hayMatch(itemCore(DATA.sections[si].categories[ci].groups[gi].items[ii]), "orange");
    };
    return {
      above: rows.slice(0, at).filter((e) => e.dataset.ref).every(core),
      below: rows.slice(at + 1).filter((e) => e.dataset.ref).every((e) => !core(e))
    };
  });
  expect(split.above, "a flavour-only match above the divider").toBe(true);
  expect(split.below, "an identity match below the divider").toBe(true);

  /* A query with only one sense gets no heading at all. */
  for (const q of ["barolo", "tartufi", "selosse"]) {
    await page.fill("#search", q);
    await page.waitForTimeout(300);
    expect(await page.locator(".search-group").count(), `"${q}" should need no divider`).toBe(0);
  }
});

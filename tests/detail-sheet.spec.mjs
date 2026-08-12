/* The wine card.
   Guards: 1bde40f (glass icon under the close button), a1c3c86 (the flute
   touching the ✕ by 3px), 15c3efd (rating chips over the glass on laptop),
   2b1367c (wasted width in the ratings row), 0c44fd1 (dead space in the header
   when a wine has a short name and no badges), 4f9d534 (sheet shrinking then
   re-growing), 2ea1995/d80385a (the frame set before it paints), dc0701e (the
   sheet moving under you while stepping), ff113a1 (stepping stays in results).

   The overlap bugs came back three separate times, each on a viewport nobody
   checked, so these run on all three. */
import { test, expect } from "@playwright/test";
import { openApp, expectClean, openWine, pickSection, box, overlaps } from "./helpers.mjs";

/* Wines chosen to cover the shapes that broke before: a long name with a full
   row of critic scores, a short name with nothing at all, the tallest glass in
   the set, and one with two badges. */
const CASES = [
  { q: "Dom Pérignon 2015", why: "seven critic scores + the flute, the tallest glass" },
  { q: "Terbotz", why: "short name, no ratings — the dead-space case" },
  { q: "Château d'Yquem", why: "long name that wraps, seven scores, sweet glass" },
  { q: "Meursault 2020", why: "the wide Chardonnay glass" },
  { q: "Brunello di Montalcino 2018", why: "Winewings Bordeaux" }
];

for (const { q, why } of CASES) {
  test(`glass icon clears the close button — ${q} (${why})`, async ({ page }) => {
    const bag = await openApp(page);
    await openWine(page, q);
    const close = await box(page, ".modal-close");
    const glass = await box(page, ".detail-glass");
    expect(glass, "no glass icon rendered").not.toBeNull();
    expect(overlaps(close, glass), `✕ ${JSON.stringify(close)} overlaps glass ${JSON.stringify(glass)}`).toBe(false);
    expect(glass.y - close.bottom, "glass sits too close under the ✕").toBeGreaterThanOrEqual(2);
    expectClean(bag);
  });

  test(`nothing overlaps the glass icon — ${q}`, async ({ page }) => {
    /* 15c3efd: the rating chips grew into the glass on wide viewports. Check
       every block in the card's header region, not just the chips. */
    await openApp(page);
    await openWine(page, q);
    const glass = await box(page, ".detail-glass");
    const hits = await page.evaluate(() => {
      const g = document.querySelector(".detail-glass").getBoundingClientRect();
      const sel = ".detail-name, .detail-producer, .detail-rec, .detail-price, .detail-style, .rating-chip, .wine-tag";
      /* Measure the ink, not the block. `.detail-name` is a full-width block
         whose text stops well short of the icon, so comparing element boxes
         reports an overlap nobody can see. Range rects give the glyphs. */
      const inkRects = (el) => {
        const out = [];
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            const r = document.createRange();
            r.selectNodeContents(node);
            out.push(...r.getClientRects());
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            out.push(node.getBoundingClientRect());
          }
        }
        return out.length ? out : [el.getBoundingClientRect()];
      };
      const bad = [];
      for (const el of document.querySelectorAll(sel)) {
        for (const r of inkRects(el)) {
          if (!r.width || !r.height) continue;
          if (r.left < g.right - 1 && g.left < r.right - 1 && r.top < g.bottom - 1 && g.top < r.bottom - 1) {
            bad.push(el.className + " :: " + el.textContent.trim().slice(0, 40));
            break;
          }
        }
      }
      return bad;
    });
    expect(hits, `these overlap the glass at ${JSON.stringify(glass)}`).toEqual([]);
  });
}

test("the card opens scrolled to the top", async ({ page }) => {
  /* Recorded in CLAUDE.md: opening a second wine after scrolling the first left
     the new card half-way down. */
  await openApp(page);
  await openWine(page, "Meursault 2020");
  await page.evaluate(() => { document.getElementById("modal-sheet").scrollTop = 400; });
  await page.waitForTimeout(120);
  await page.locator(".modal-close").click();
  await page.waitForTimeout(300);
  await openWine(page, "Chablis 2022");
  expect(await page.evaluate(() => document.getElementById("modal-sheet").scrollTop)).toBe(0);
});

test("no dead space above the producer when a wine has no badges", async ({ page }) => {
  /* 0c44fd1: clearing the glass icon inflated the header, which showed as a gap
     under the producer name on wines with nothing else in the header. */
  await openApp(page);
  await openWine(page, "Terbotz");
  const gap = await page.evaluate(() => {
    const head = document.querySelector(".detail-header").getBoundingClientRect();
    const text = document.querySelector(".detail-head-text").getBoundingClientRect();
    return Math.round(head.bottom - text.bottom);
  });
  /* Some slack is fine — the icon is 60px tall and has to fit. What must not
     happen is the header growing far past what the icon needs. */
  expect(gap, "header is much taller than its content").toBeLessThan(70);
});

test("the frame does not resize between wines", async ({ page }) => {
  /* 4f9d534 and ff113a1: the sheet shrank then re-grew as you stepped, which
     read as the card jumping under your thumb. */
  await openApp(page);
  await openWine(page, "Meursault");
  const first = await box(page, "#modal-sheet");
  await page.locator(".modal-nav.next").click();
  await page.waitForTimeout(600);
  const second = await box(page, "#modal-sheet");
  expect(Math.abs(second.x - first.x), "card moved sideways").toBeLessThan(2);
  expect(Math.abs(second.w - first.w), "card changed width").toBeLessThan(2);
  expect(Math.abs(second.y - first.y), "card moved vertically").toBeLessThan(2);
});

test("the arrows step and hide only at the ends", async ({ page }) => {
  const bag = await openApp(page);
  /* "Meursault" and not "Meursault 2020": a search with a single hit has no
     neighbours, so both arrows are correctly hidden and there is nothing to
     test. */
  await openWine(page, "Meursault");
  const before = await page.locator(".detail-name").innerText();
  await expect(page.locator(".modal-nav.next")).toBeVisible();
  await page.locator(".modal-nav.next").click();
  await page.waitForTimeout(500);
  expect(await page.locator(".detail-name").innerText()).not.toBe(before);
  await page.locator(".modal-nav.prev").click();
  await page.waitForTimeout(500);
  expect(await page.locator(".detail-name").innerText()).toBe(before);
  expectClean(bag);
});

test("stepping from a search result stays inside the results", async ({ page }) => {
  /* ff113a1: stepping used to walk off into the whole cellar. */
  await openApp(page);
  await openWine(page, "Chablis");
  const names = new Set();
  for (let i = 0; i < 4; i++) {
    names.add(await page.locator(".detail-name").innerText());
    const next = page.locator(".modal-nav.next");
    if (!(await next.isVisible())) break;
    await next.click();
    await page.waitForTimeout(450);
  }
  names.add(await page.locator(".detail-name").innerText());
  for (const n of names) expect(n, `${n} is not a Chablis`).toContain("Chablis");
});

test("Escape and the ✕ both close the card", async ({ page }) => {
  await openApp(page);
  await openWine(page, "Meursault");
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal")).toHaveClass(/hidden/);
  await openWine(page, "Meursault");
  await page.locator(".modal-close").click();
  await expect(page.locator("#modal")).toHaveClass(/hidden/);
});

test("the card you hold up says what to order and nothing else", async ({ page }) => {
  /* Added 2026-08-12 (owner asked how a guest tells the waiter which wine).
     Half this list is unpronounceable to the guest reading it, and we pour
     more than one Prüm, so "the Prüm" is ambiguous. The card carries the four
     things an order needs — producer, wine, shelf, price — in type that reads
     across a table.

     The shelf word is the one thing that is deliberately bilingual: it is read
     by the waiter, who reads Croatian, while the guest may have chosen German
     an hour ago. Croatian leads, the guest's own word follows. */
  const bag = await openApp(page, { lang: "de" });
  await openWine(page, "Wehlener Sonnenuhr");
  const card = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      name: q(".detail-name").textContent.trim(),
      producer: q(".detail-producer") ? q(".detail-producer").textContent.trim() : "",
      price: q(".detail-price") ? q(".detail-price").textContent.trim() : ""
    };
  });

  await page.locator(".detail-waiter").click();
  await expect(page.locator(".waiter-name")).toBeVisible();
  await expect(page.locator(".waiter-name")).toHaveText(card.name);
  await expect(page.locator(".waiter-producer")).toHaveText(card.producer);
  await expect(page.locator(".waiter-price")).toHaveText(card.price);
  /* Croatian first for the waiter, German second for the guest who is holding
     it up — a bottle from a bottle section. */
  await expect(page.locator(".waiter-shelf")).toHaveText(/boca\s·\sFlasche/i);
  /* Nothing to step onto while somebody else is reading it. */
  expect(await page.locator(".modal-nav:not(.hidden)").count(),
    "the ‹ › arrows are live on the card held up to a waiter").toBe(0);

  await page.locator(".detail-back").click();
  await expect(page.locator(".detail-name"), "no way back to the wine").toHaveText(card.name);
  expectClean(bag);
});

test("a wine by the glass says so on the card held up", async ({ page }) => {
  /* The shelf line is read off the section the guest opened the wine from, so
     the same wine says "boca" from the bottle list and "čaša" from the glass
     list — which is the distinction the waiter needs and the one an 86 already
     makes (data/unavailable.json takes a `where`). */
  await openApp(page);
  await pickSection(page, "čašu");
  await page.locator("#content .item").first().click();
  await expect(page.locator(".detail-name")).toBeVisible();
  await page.locator(".detail-waiter").click();
  await expect(page.locator(".waiter-shelf")).toHaveText(/čaša/i);
});

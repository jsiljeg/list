/* Shared fixtures for the regression suite. */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { joinList, library as readLibrary } from "../scripts/lib/list.mjs";

/* import.meta.dirname needs Node 20.11; this works everywhere. */
const HERE = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(HERE, "..");

/* ---------- data, read straight off disk ----------
   `wines` is the library joined to the Theatrium list, i.e. exactly the shape
   the old data/wines.json had — so every spec written before the split still
   reads the same tree, and the invariants in data.spec.mjs still apply to what
   a guest actually sees rather than to the library in the abstract. */
export const wines = joinList().list;
export const library = readLibrary();
export const producers = JSON.parse(readFileSync(resolve(ROOT, "data/producers.json"), "utf8")).producers;

/** Every item that carries an `insight`, flattened out of the section tree. */
export function allItems(node = wines, out = []) {
  if (node && typeof node === "object") {
    if (node.insight) out.push(node);
    for (const k of Object.keys(node)) allItems(node[k], out);
  }
  return out;
}

/* ---------- page setup ---------- */

/**
 * Load the app past the language screen and the story splash, and start
 * collecting the failures that should never happen: page errors, console
 * errors, and requests that 404. Assert with `expectClean(bag)`.
 */
export async function openApp(page, { lang = "hr" } = {}) {
  const bag = { errors: [], console: [], bad: [] };
  page.on("pageerror", (e) => bag.errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") bag.console.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) bag.bad.push(`${r.status()} ${r.url()}`); });

  await page.goto("/index.html", { waitUntil: "load" });
  await page.evaluate((l) => localStorage.setItem("theatrium-lang", l), lang);
  await page.goto("/index.html", { waitUntil: "load" });
  /* `let DATA` in a classic script is a global binding but not a window
     property, so it has to be reached as a bare identifier. */
  await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
  const enter = page.locator("#story-enter");
  if (await enter.isVisible()) await enter.click();
  await expect(page.locator("#app")).toBeVisible();
  await page.waitForTimeout(150);
  return bag;
}

export function expectClean(bag) {
  expect(bag.errors, "uncaught page errors").toEqual([]);
  expect(bag.console, "console errors").toEqual([]);
  expect(bag.bad, "requests that failed").toEqual([]);
}

/** Click the nav chip whose label contains `text`. Returns its section id. */
export async function pickSection(page, text) {
  const chips = page.locator("#nav button");
  const n = await chips.count();
  for (let i = 0; i < n; i++) {
    const c = chips.nth(i);
    if ((await c.innerText()).includes(text)) {
      await c.click();
      await page.waitForTimeout(320);
      return page.evaluate(() => currentSection);
    }
  }
  throw new Error(`no nav chip matching ${text}`);
}

/** Search for `query` and open the first hit. */
export async function openWine(page, query) {
  /* Toggling blindly closed the bar again when it was already open, which is how
     three of these tests first "failed" on a perfectly good app. */
  if (!(await page.locator("#search-bar.open").count())) await page.locator("#search-toggle").click();
  await expect(page.locator("#search")).toBeVisible();
  await page.fill("#search", query);
  await page.waitForTimeout(350);
  const first = page.locator(".item").first();
  await expect(first, `nothing found for "${query}"`).toBeVisible();
  await first.click();
  await expect(page.locator(".detail-name")).toBeVisible();
  await page.waitForTimeout(250);
  return page.locator(".detail-name").innerText();
}

/* ---------- gestures ---------- */

/**
 * A real one-finger swipe, dispatched through the browser's input pipeline
 * rather than as synthetic TouchEvents. This distinction is not academic: the
 * first version of the swipe tests used synthetic events down the middle of a
 * phone and passed while the tablet edges were completely dead.
 */
export async function swipe(page, from, to, { steps = 12, pause = 12 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x, y: from.y, id: 1 }]
  });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + (to.x - from.x) * (i / steps), y: from.y + (to.y - from.y) * (i / steps), id: 1 }]
    });
    await page.waitForTimeout(pause);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(500);
}

export function box(page, selector) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  }, selector);
}

/** Do two rectangles overlap by more than `slack` px in both axes? */
export function overlaps(a, b, slack = 0) {
  if (!a || !b) return false;
  return a.x < b.right - slack && b.x < a.right - slack &&
         a.y < b.bottom - slack && b.y < a.bottom - slack;
}

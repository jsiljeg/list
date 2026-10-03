/* The anchor price ("sidrena cijena") follows one switch.

   Owner, 2026-10-03: the requirement was postponed by a month, so the line
   under every price is hidden until it is due — hidden, not deleted.
   SHOW_ANCHOR in js/app.js is the switch. This spec reads it from the source
   and checks the screen agrees with it in both directions, so turning it off
   cannot leave a stray date on the card, and turning it back on next month
   cannot quietly print nothing.

   The data side (every listing keeps its frozen anchor) is in data.spec.mjs
   and validate.mjs and runs regardless of the switch. */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openApp, expectClean } from "./helpers.mjs";

const app = readFileSync(resolve(process.cwd(), "js/app.js"), "utf8");
const m = app.match(/const SHOW_ANCHOR = (true|false);/);
const SHOW = m && m[1] === "true";

test("the switch exists, exactly once", () => {
  expect(m, "const SHOW_ANCHOR = true|false; not found in js/app.js").not.toBeNull();
  expect(app.match(/const SHOW_ANCHOR =/g)).toHaveLength(1);
});

test(`list rows, the wine card and the notice follow SHOW_ANCHOR (${SHOW ? "on" : "off"})`, async ({ page }) => {
  const bag = await openApp(page);
  const rows = await page.locator("#content .item-anchor").count();
  if (SHOW) expect(rows).toBeGreaterThan(0); else expect(rows).toBe(0);

  await page.locator("#content .item.clickable").first().click();
  await expect(page.locator(".detail-price").first()).toBeVisible();
  await expect(page.locator(".detail-anchor")).toHaveCount(SHOW ? 1 : 0);

  const legal = await page.locator("#legal").innerText();
  if (SHOW) expect(legal).toMatch(/2026/); else expect(legal).not.toMatch(/10\.09\.2026/);
  expectClean(bag);
});

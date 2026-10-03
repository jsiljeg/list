/* The tablets update themselves (owner, 2026-10-03: "I don't have access to
   tablets... not aggressively while a guest is scrolling, but at some point
   without waiting too long").

   The deploy stamps a code fingerprint into index.html and version.json
   (scripts/site-files.sh); js/app.js compares them every 30 s and, when they
   differ, reloads only at a safe moment. What this guards:

   - the language screen — where a tablet used to sit all day on old code —
     reloads after one idle minute, and not before;
   - inside the list nothing is hurried: no reload at one or two idle minutes;
   - no new version, no reload, however long the tablet idles there;
   - a version that still mismatches after the reload (a stale CDN) does not
     put the screen into a reload loop.

   The source page says app-version "dev", which turns all of this off, so the
   page is rewritten here to carry a real stamp. The clock is Playwright's, so
   minutes pass in milliseconds. */
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1024, height: 768 } });

async function boot(page, { served = "v2", lang = null } = {}) {
  const state = { served, loads: 0 };
  await page.route("https://theatrium.devinos.hr/api/dnevna-ponuda*", (r) => r.fulfill({
    status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ offer: null }) }));
  await page.route("**/index.html", async (route) => {
    state.loads++;
    const res = await route.fetch();
    const html = (await res.text()).replace('<meta name="app-version" content="dev">', '<meta name="app-version" content="v1">');
    await route.fulfill({ response: res, body: html });
  });
  await page.route("**/version.json*", (r) => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ code: state.served }) }));
  await page.clock.install();
  if (lang) await page.addInitScript((l) => { try { localStorage.setItem("theatrium-lang", l); } catch (e) {} }, lang);
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
  return state;
}

const minutes = (n) => n * 60 * 1000;
/* Let the 30-second beats run in fake time, then give the real network a
   moment to answer the fetches those beats made. */
async function idle(page, ms) {
  for (let t = 0; t < ms; t += 30000) {
    await page.clock.runFor(30000);
    await page.waitForTimeout(40);
  }
}

test("the language screen reloads into a new version after one idle minute — not before", async ({ page }) => {
  const s = await boot(page);
  await expect(page.locator("#start")).toBeVisible();
  await idle(page, 30000);
  expect(s.loads, "reloaded before a full idle minute").toBe(1);
  await idle(page, minutes(1.5));
  await expect.poll(() => s.loads).toBe(2);
});

test("inside the list, a new version waits for the usual three idle minutes", async ({ page }) => {
  const s = await boot(page, { lang: "hr" });
  const enter = page.locator("#story-enter");
  if (await enter.isVisible()) await enter.click();
  await expect(page.locator("#app")).toBeVisible();
  await idle(page, minutes(2));
  expect(s.loads, "a guest in the list was reloaded before three idle minutes").toBe(1);
});

test("no new version, no reload on the language screen", async ({ page }) => {
  const s = await boot(page, { served: "v1" });
  await expect(page.locator("#start")).toBeVisible();
  await idle(page, minutes(5));
  expect(s.loads).toBe(1);
});

test("a version that still mismatches after the reload does not loop", async ({ page }) => {
  /* index.html is always stamped v1 here and version.json always says v2 —
     exactly what a stale CDN copy of the page would look like. */
  const s = await boot(page);
  await idle(page, minutes(1.5));
  await expect.poll(() => s.loads).toBe(2);
  await page.waitForFunction(() => typeof DATA !== "undefined" && !!DATA);
  await idle(page, minutes(5));
  expect(s.loads, "reloaded again within ten minutes for the same version").toBe(2);
});

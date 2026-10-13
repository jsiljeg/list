/* /admin Troškovi → Prihodi (2026-10-13, commit "Prihodi: the till's bills
 * from Remaris"). The income API on theatrium.devinos.hr is faked with
 * page.route(). Guards: the month's income, payments and sales groups are
 * drawn; Pregled leads with what to look at, its result is net of PDV and
 * its rubrike (Hrana, Vino, Žestoko) set sold against bought; the PDV tab's izlazni PDV is
 * total − net per tax group, its rate off the label or, where Remaris prints
 * none (drinks), from total ÷ net; and the server's
 * cleanBill() keys a bill by year + fiscal number (numbers restart each
 * January) and rejects a row that is not a bill. */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { cleanBill } from "../web/functions/_lib/sales.js";

const month = new Date().toISOString().slice(0, 7);
const summary = {
  month, months: [{ m: month, n: 3, total: 1130, vat: 150 }],
  days: [{ day: `${month}-01`, n: 2, total: 1000 }, { day: `${month}-02`, n: 1, total: 130 }],
  pays: [{ pay: "Visa", n: 2, total: 1000 }, { pay: "Gotovina", n: 1, total: 130 }],
  groups: [{ grp: "Glavna jela", tax: "H (HRANA IZLAZ 13%)", total: 800, net: 707.96, qty: 20 }, { grp: "Vina na čaše", tax: "P (PIĆE IZLAZ)", total: 330, net: 264, qty: 30 }],
  items: [{ name: "BEEF WELLINGTON", grp: "Glavna jela", tax: "H (HRANA IZLAZ 13%)", qty: 20, total: 800, net: 707.96 }],
  weekdays: [{ wd: 1, days: 1, n: 2, total: 1000 }, { wd: 2, days: 1, n: 1, total: 130 }],
  dayparts: [{ part: "vecera", n: 3, total: 1130 }],
  leaks: [{ waiter: "Ana", storno_n: 0, storno: 0, disc: 120, free_n: 0, free: 0 }],
  waiters: [{ waiter: "Ana", n: 30, total: 900, wine: 300, wine_bills: 20 }, { waiter: "Ivo", n: 30, total: 230, wine: 30, wine_bills: 3 }],
  taxes: [{ tax: "H (HRANA IZLAZ 13%)", total: 800, net: 707.96 }, { tax: "P (PIĆE IZLAZ)", total: 330, net: 264 }],
  custs: [{ cust: "LIGNUM DRUŠTVO S OGRANIČENOM", oib: "1", n: 1, total: 130, virman: 130 }],
  state: { last_ok: new Date().toISOString(), error: "" },
};

test("Prihodi shows the month from Remaris, and Pregled and PDV use it", async ({ page }) => {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ sha: "x", content: Buffer.from(JSON.stringify({ hidden: [] })).toString("base64") }) }));
  await page.route("https://theatrium.devinos.hr/**", (r) => {
    const u = r.request().url();
    if (u.includes("/api/prihodi")) return r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(u.includes(`mjesec=${month}`) ? summary : { ...summary, days: [], pays: [], groups: [], taxes: [], custs: [] }) });
    const done = { id: "r1", status: "done", source: "mer", vendor: "X d.o.o.", doc_date: `${month}-01`, total: 400, vat: 50,
      items: [{ name: "a", total: 400, category: "meso", vat_rate: 25, doc_total: 350 }], created_at: `${month}-01T08:00:00Z` };
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [done], limits: {} }) });
  });
  await page.goto("/admin.html");
  await page.fill("#pin", "7777"); await page.click("#pin-go");
  await page.fill("#token", "github_pat_fake"); await page.click("#token-go");
  await page.waitForSelector("#main:not(.hidden)");
  await page.click('[data-tab="troskovi"]');
  await page.click('[data-sub="pregled"]');
  /* net of PDV on both sides (2026-10-14): 707,96 + 264 sold − (400 − 50) bought */
  await expect(page.locator(".card.bal")).toContainText("972 €");
  await expect(page.locator(".card.bal .sum")).toContainText("622 €");
  /* Filho, 2026-10-14: only break-even, the average bill and wine per bill —
     discounts and storno are not shown ("nebitno") */
  await expect(page.locator(".fc").first()).toContainText("Prag isplativosti");
  await expect(page.locator(".fc", { hasText: "Prosječni račun" })).toBeVisible();
  await expect(page.locator(".fc", { hasText: "Vino po računu" })).toBeVisible();
  await expect(page.locator(".fc", { hasText: "Popusti" })).toHaveCount(0);
  /* Filho's rubrike, net: food sold 708 */
  const hrana = page.locator(".rub", { hasText: "Hrana" });
  await expect(hrana).toContainText("708 €");
  await expect(page.locator(".rub", { hasText: "Vino" })).toContainText("264 €");
  await page.click('.seg3 [data-sub="prihodi"]');
  await expect(page.locator(".big b")).toHaveText("1.130 €");
  /* payments are not shown (owner, 2026-10-14); rubrike open onto the sales groups */
  await expect(page.locator("#tab-troskovi")).not.toContainText("Visa");
  await page.click('[data-rub="vino"]');
  await expect(page.locator("#tab-troskovi")).toContainText("Vina na čaše");
  await expect(page.locator(".days > span")).toHaveCount(2);
  await expect(page.locator("#tab-troskovi")).toContainText("Beef wellington");
  await expect(page.locator(".wt")).toContainText("Ivo");
  await page.click('.seg3 [data-sub="pdv"]');
  /* 800 − 707,96 + 330 − 264 = 158,04 izlazni; − 50 pretporez = 108,04 */
  await expect(page.locator(".card.vat").first()).toContainText("108,04 €");
  await expect(page.locator(".card.vat").nth(2)).toContainText("158,04 €");
  /* Remaris prints the rate only on food; drinks' "P (PIĆE IZLAZ)" is 25% by its own sums */
  await expect(page.locator(".card.vat").nth(2)).toContainText("25%");
  await expect(page.locator(".card.vat").nth(2)).not.toContainText("bez porezne grupe");
});

test("a bill is keyed by year and fiscal number, and junk is refused", () => {
  const b = cleanBill({ no: "4179/P3/1", day: "2026-10-01", at: "2026-10-01T12:41:24.150000", pay: "Gotovina",
    total: 20, vat: 2.3, lines: [{ name: "COUVERT", qty: 1, total: 2, tax: "H (HRANA IZLAZ 13%)" }] });
  expect(b.id).toBe("2026/4179/P3/1");
  expect(b.lines[0].tax).toBe("H (HRANA IZLAZ 13%)");
  expect(cleanBill({ no: "x", day: "2026-10-01", at: "2026-10-01T12:00" })).toBeNull();
  expect(cleanBill({ no: "1/P3/1", day: "1.10.2026", at: "2026-10-01T12:00" })).toBeNull();
});

/* Vinska karta i blagajna (2026-10-14): a till name reaches its list wine
   only when every word of it is the wine's — "PINOT GRIGIO" must never land
   on a Pinot Noir, "ETNA ROSSO" on the Etna Bianco. Guarded at the source,
   since the matcher runs in the page against the live list. */
test("the till-to-list wine matcher is strict and never guesses", () => {
  const src = readFileSync(new URL("../js/admin-expenses.js", import.meta.url), "utf8");
  expect(src).toContain("if (rest.length && nm.length < rest.length) continue;");
  expect(src).toContain("return c.length && !(c[1] && c[1].sc === c[0].sc) ? c[0].w : null;");
});

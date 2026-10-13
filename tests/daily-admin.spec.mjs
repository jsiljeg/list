/* /admin "Ponuda" tab — Filho publishes the daily offer himself (2026-10-13,
 * commit "Dnevna ponuda in /admin"). The inbox on theatrium.devinos.hr is
 * faked with page.route(); GitHub is faked just enough to pass the gate.
 *
 * Guards: a ready preview shows every dish with its wines resolved from the
 * list, a price typed and a wine removed travel in the Objavi body, and the
 * menu photo is never sent as a market photo (photos: []). */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const lib = JSON.parse(readFileSync(new URL("../library/wines.json", import.meta.url), "utf8")).wines;
const refs = Object.keys(lib).filter((r) => lib[r].insight && !lib[r].insight.kind).slice(0, 3);
const offer = {
  title: { hr: "Danas na meniju" }, intro: {},
  dishes: [
    { course: "starters", name: { hr: "Bijeli tartuf" }, description: { hr: "Pašta ili risotto" }, price: null,
      pairings: ["truffles", "risotto"], styles: ["white_rich"], wines: refs.slice(0, 2) },
    { course: "mains", name: { hr: "File srnetine" }, description: { hr: "" }, price: null,
      pairings: ["game"], styles: ["red_full"], wines: refs.slice(2, 3) },
  ],
};
const item = { id: "20261013-aabbccddeeff", date: "2026-10-13", status: "ready", created_at: "2026-10-13T09:40:00Z",
  updated_at: "2026-10-13T09:44:00Z", text: "", remark: "", photos: [], runs: 1,
  result: { offer, notes: "", dropped: [] }, run_url: "", error: "", created_by: "" };

test("a ready daily offer can be priced, trimmed and published from /admin", async ({ page }) => {
  const posts = [];
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ sha: "x", content: Buffer.from(JSON.stringify({ hidden: [] })).toString("base64") }) }));
  await page.route("https://theatrium.devinos.hr/**", (r) => {
    const req = r.request(), u = req.url();
    if (req.method() === "POST") { posts.push({ u, body: JSON.parse(req.postData() || "{}") }); return r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); }
    if (u.includes("/api/kuhinja/citaj")) return r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ today: "2026-10-13", items: [item], limits: { enabled: true, today: 1, dailyCap: 6, month: 1, monthlyCap: 60 } }) });
    if (u.includes("/api/kuhinja/ponuda")) return r.fulfill({ status: 200, contentType: "application/json", body: '{"date":"2026-10-13","offer":null}' });
    return r.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' });
  });
  await page.goto("/admin.html");
  await page.fill("#pin", "7777");
  await page.click("#pin-go");
  await page.fill("#token", "github_pat_fake");
  await page.click("#token-go");
  await page.waitForSelector("#main:not(.hidden)");
  await page.click('[data-tab="ponuda"]');
  await expect(page.locator(".d-dish")).toHaveCount(2);
  await expect(page.locator(".d-dish").first()).toContainText(lib[refs[0]].name);

  await page.click('[data-rmw="0:0"]');
  await page.fill('[data-price="0"]', "32,50");
  await page.dispatchEvent('[data-price="0"]', "change");
  await page.click('[data-act="objavi"]');
  await expect.poll(() => posts.length).toBe(1);
  const { u, body } = posts[0];
  expect(u).toContain(`/api/kuhinja/citaj/${item.id}/objavi`);
  expect(body.offer.dishes[0].price).toBe(32.5);
  expect(body.offer.dishes[0].wines).toEqual([refs[1]]);
  expect(body.offer.photos).toEqual([]);
});

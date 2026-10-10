/* admin.html — the 86 board the staff actually use.

   Every GitHub call is intercepted, so these never touch the real repo and
   never need a token. The fake holds one file in memory and hands back the
   contents-API envelope; a second route serves that same file at the path the
   *tablets* read, which is what the page verifies publication against.

   Guards two things found while building it, both about not making the board
   useless mid-service: the first version locked every switch for the whole
   receipt (~40s a wine, so you could not 86 three things at once), and the
   30-second tablet countdown then held the *next* flip hostage — worst on an
   un-hide, which is the one thing that should never be slow. */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

/* One board, one viewport: it is the bar tablet, not the guest's phone. */
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1024, height: 768 } });

const PIN = "7777";

/** Fake GitHub + the published files, wired to the same in-memory documents.
    Two files since prices came to the board (2026-10-10): the 86 list and the
    wine list, each with its own sha, told apart by path. `state.list` starts
    as the real lists/theatrium.json. */
async function board(page) {
  const list = JSON.parse(readFileSync(new URL("../lists/theatrium.json", import.meta.url), "utf8"));
  const state = { file: { _: "test", hidden: [] }, sha: "sha0", puts: [], list, listSha: "L0", listPuts: [] };
  await page.route("https://api.github.com/**", (route) => {
    const req = route.request();
    const isList = req.url().includes("lists/theatrium.json");
    if (req.method() === "GET") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          sha: isList ? state.listSha : state.sha,
          content: Buffer.from(JSON.stringify(isList ? state.list : state.file), "utf8").toString("base64")
        })
      });
    }
    const body = JSON.parse(req.postData());
    const doc = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
    if (isList) {
      state.list = doc; state.listPuts.push(body.message); state.listSha = "L" + state.listPuts.length;
      state.listBody = Buffer.from(body.content, "base64").toString("utf8");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: { sha: state.listSha } }) });
    }
    state.file = doc;
    state.puts.push(body.message);
    state.sha = "sha" + state.puts.length;
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ content: { sha: state.sha } })
    });
  });
  /* Deliberately origin-scoped: "**\/data/unavailable.json*" also matches the
     GitHub contents URL, which silently fed the page the wrong shape and cost
     an hour. */
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/data\/unavailable\.json/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.file) }));
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/lists\/theatrium\.json/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.list) }));

  await page.goto("/admin.html");
  await page.fill("#pin", PIN);
  await page.click("#pin-go");
  await page.fill("#token", "github_pat_fake");
  await page.click("#token-go");
  await page.waitForFunction(() => document.querySelectorAll(".row").length > 0, null, { timeout: 20000 });
  return state;
}

const hidden = (state) => state.file.hidden.map((r) => `${r.name}/${r.where || "all"}`);

test("the PIN gate stands between the page and the board", async ({ page }) => {
  await page.goto("/admin.html");
  await expect(page.locator("#main")).toBeHidden();
  await page.fill("#pin", "0000");
  await page.click("#pin-go");
  await expect(page.locator("#pin-err")).toHaveText(/Pogrešan/);
  await expect(page.locator("#main")).toBeHidden();
});

test("every wine with a producer gets a switch", async ({ page }) => {
  await board(page);
  const n = await page.locator(".row").count();
  expect(n).toBeGreaterThan(300);
  await expect(page.locator("#n-hidden")).toHaveText("0");
});

test("a wine sold both ways gets its own glass and bottle buttons", async ({ page }) => {
  const state = await board(page);
  await page.fill("#q", "Meneghetti");
  await page.waitForTimeout(200);
  /* Blanc de Blancs is glass-only; White and Red 2020 are both. */
  expect(await page.locator(".scope button").count()).toBe(4);

  await page.locator(".row").filter({ hasText: "Red 2020" }).locator(".scope button").first().click();
  await page.waitForTimeout(600);
  expect(hidden(state)).toEqual(["Red 2020/glass"]);
});

test("three flips in a row are all accepted, and batched", async ({ page }) => {
  /* The bug: the board locked until the whole receipt had run, so the second
     and third wine you ran out of simply could not be entered. */
  const state = await board(page);
  await page.fill("#q", "Meneghetti");
  await page.waitForTimeout(200);
  for (const name of ["Blanc de Blancs", "White 2023", "Red 2020"]) {
    await page.locator(".row").filter({ hasText: name }).locator(".sw").click();
    await page.waitForTimeout(120);
  }
  await expect(page.locator("#n-hidden")).toHaveText("3");
  await page.waitForFunction(() => document.getElementById("s2").className === "done", null, { timeout: 60000 });
  expect(state.file.hidden.length).toBe(3);
  expect(state.puts.length, "batched, not one commit per tap").toBeLessThan(3);
});

test("an un-hide during the tablet countdown is not made to wait it out", async ({ page }) => {
  const state = await board(page);
  await page.fill("#q", "Blanc de Blancs");
  await page.waitForTimeout(200);
  await page.locator(".row").first().locator(".sw").click();
  await page.waitForFunction(() => document.getElementById("s2").className === "done", null, { timeout: 60000 });
  await page.waitForFunction(() => /\(\d+s\)/.test(document.getElementById("s3").textContent), null, { timeout: 10000 });

  const t0 = Date.now();
  await page.locator(".row").first().locator(".sw").click();
  await page.waitForFunction(() => document.querySelectorAll(".row.off").length === 0, null, { timeout: 8000 });
  await page.waitForTimeout(1000);
  expect(hidden(state)).toEqual([]);
  expect(Date.now() - t0, "should not sit through the 30s countdown").toBeLessThan(10000);
});

test("the receipt reports publication, it does not assume it", async ({ page }) => {
  /* If the deploy never lands, step 2 must never go green. */
  const state = await board(page);
  await page.unroute(/^http:\/\/127\.0\.0\.1:\d+\/data\/unavailable\.json/);
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/data\/unavailable\.json/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ hidden: [] }) }));

  await page.fill("#q", "Blanc de Blancs");
  await page.waitForTimeout(200);
  await page.locator(".row").first().locator(".sw").click();
  await page.waitForFunction(() => document.getElementById("s1").className === "done", null, { timeout: 20000 });
  await page.waitForTimeout(6000);
  expect(await page.locator("#s2").getAttribute("class"), "must stay pending, not go green").toBe("now");
  expect(state.puts.length).toBe(1);
});

test("the commit message says what actually happened", async ({ page }) => {
  /* It described the *button*, so every scoped click read "Vraćeno na kartu"
     even while hiding something — and the GitHub history is the record of what
     ran out and when. It now describes the resulting state, which is right for
     every transition including glass→both, which is neither a hide nor an
     un-hide. */
  const state = await board(page);
  await page.fill("#q", "Red 2020");
  await page.waitForTimeout(200);
  const row = page.locator(".row").filter({ hasText: "Meneghetti" });

  await row.locator(".scope button").first().click();
  await expect.poll(() => state.puts.at(-1)).toMatch(/^Nema na čašu:/);
  expect(state.file.hidden.map((r) => r.where)).toEqual(["glass"]);
});

test("hiding the bottle does not put the glass pour back", async ({ page }) => {
  /* The scoped branch rebuilt the rule from scratch, so a second click wiped
     the first: with the glass 86'd, "nema na bocu" quietly re-listed the glass. */
  const state = await board(page);
  await page.fill("#q", "Red 2020");
  await page.waitForTimeout(200);
  const scope = page.locator(".row").filter({ hasText: "Meneghetti" }).locator(".scope button");

  await scope.first().click();
  await expect.poll(() => state.file.hidden.length).toBe(1);
  await scope.nth(1).click();
  await expect.poll(() => JSON.stringify(state.file.hidden.map((r) => r.where || "all"))).toBe('["all"]');

  /* and turning one back on leaves the other off */
  await scope.first().click();
  await expect.poll(() => JSON.stringify(state.file.hidden.map((r) => r.where || "all"))).toBe('["bottle"]');
});

/* ---------- prices (2026-10-10) ---------- */

const priceOf = (list, ref, sec) => {
  for (const s of list.sections) if (!sec || s.id === sec) for (const c of s.categories) for (const g of c.groups)
    for (const it of g.items) if (it.ref === ref) return it;
};

test("a price is edited on the board, and only the price changes", async ({ page }) => {
  /* Owner: "price editing ... so Filho could do it by himself". The anchor is
     the legal reference price and must never move with it, and the file must
     come back byte-identical apart from that one number. */
  const state = await board(page);
  const ref = "marjan-simcic--merlot-opoka-2017";
  const before = JSON.parse(JSON.stringify(priceOf(state.list, ref)));
  await page.fill("#q", "Merlot Opoka");
  await page.waitForTimeout(200);
  await page.locator(".row").filter({ hasText: "Merlot Opoka" }).locator(".price").first().click();
  await page.fill(".pedit input", String(before.price + 10));
  await page.click(".pedit .ok");
  await page.waitForFunction(() => document.getElementById("s2").className === "done", null, { timeout: 60000 });

  const after = priceOf(state.list, ref);
  expect(after.price).toBe(before.price + 10);
  expect(after.anchor, "the anchor is never edited").toBe(before.anchor);
  expect(state.listPuts).toEqual([`Cijena: Marjan Simčič Merlot Opoka 2017: ${before.price} → ${before.price + 10} €`]);
  const disk = readFileSync(new URL("../lists/theatrium.json", import.meta.url), "utf8");
  const lines = (t) => t.replace(/\r/g, "").split("\n");
  const changed = lines(state.listBody).filter((l, i) => l !== lines(disk)[i]);
  expect(changed, "only the price line differs").toEqual([`         "price": ${before.price + 10},`]);
});

test("a price that is not a price is refused, and a big jump asks first", async ({ page }) => {
  const state = await board(page);
  await page.fill("#q", "Merlot Opoka");
  await page.waitForTimeout(200);
  const dialogs = [];
  page.on("dialog", (d) => { dialogs.push(d.type()); d.type() === "confirm" ? d.dismiss() : d.accept(); });

  await page.locator(".row").filter({ hasText: "Merlot Opoka" }).locator(".price").first().click();
  await page.fill(".pedit input", "sto pedeset");
  await page.click(".pedit .ok");
  await page.waitForTimeout(300);
  expect(dialogs).toEqual(["alert"]);

  await page.fill(".pedit input", "1500");          /* 150 → 1500: one zero too many */
  await page.click(".pedit .ok");
  await page.waitForTimeout(600);
  expect(dialogs).toEqual(["alert", "confirm"]);
  expect(state.listPuts, "dismissed, so nothing written").toEqual([]);
});

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

/* A wine sold both ways: its switch opens one line of choices (hide all,
   only the glass, only the bottle). Since 2026-10-10 they are shown only
   while choosing, so the row stays two lines. */
const choose = async (page, name, what) => {
  const row = page.locator(".row").filter({ hasText: name });
  await row.locator(".sw").click();
  await row.locator(what === "all" ? ".nema.all" : `.nema[data-w="${what}"]`).click();
};

test("a wine sold both ways gets its own glass and bottle choices", async ({ page }) => {
  const state = await board(page);
  await page.fill("#q", "Meneghetti");
  await page.waitForTimeout(200);
  /* Blanc de Blancs is glass-only; White and Red 2020 are both. */
  expect(await page.locator('.sw[data-both="1"]').count()).toBe(2);
  expect(await page.locator(".nema").count(), "no choices until asked").toBe(0);

  await choose(page, "Red 2020", "glass");
  await page.waitForTimeout(600);
  expect(hidden(state)).toEqual(["Red 2020/glass"]);
  expect(await page.locator(".nema").count(), "the choices close after one").toBe(0);
});

test("three flips in a row are all accepted, and batched", async ({ page }) => {
  /* The bug: the board locked until the whole receipt had run, so the second
     and third wine you ran out of simply could not be entered. */
  const state = await board(page);
  await page.fill("#q", "Meneghetti");
  await page.waitForTimeout(200);
  await page.locator(".row").filter({ hasText: "Blanc de Blancs" }).locator(".sw").click();
  await page.waitForTimeout(120);
  for (const name of ["White 2023", "Red 2020"]) {
    await choose(page, name, "all");
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
  await choose(page, "Red 2020", "glass");
  await expect.poll(() => state.puts.at(-1)).toMatch(/^Nema na čašu:/);
  expect(state.file.hidden.map((r) => r.where)).toEqual(["glass"]);
});

test("hiding the bottle does not put the glass pour back", async ({ page }) => {
  /* The scoped branch rebuilt the rule from scratch, so a second click wiped
     the first: with the glass 86'd, "nema na bocu" quietly re-listed the glass. */
  const state = await board(page);
  await page.fill("#q", "Red 2020");
  await page.waitForTimeout(200);
  await choose(page, "Red 2020", "glass");
  await expect.poll(() => state.file.hidden.length).toBe(1);
  await choose(page, "Red 2020", "bottle");          /* "sakrij bocu" too */
  await expect.poll(() => JSON.stringify(state.file.hidden.map((r) => r.where || "all"))).toBe('["all"]');

  /* and bringing one back leaves the other off */
  await choose(page, "Red 2020", "glass");           /* "vrati čašu" */
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

/* ---------- Dodaj vino (2026-10-10; "Novo vino" until the owner renamed it) ---------- */

test("Dodaj vino: a bottle is sent, a question is answered, the card is previewed in Croatian", async ({ page }) => {
  /* The inbox lives on the restaurant site; here it is an in-memory fake at
     the real URL, so nothing reaches Cloudflare or GitHub. */
  await board(page);
  const inbox = { items: [], posts: [] };
  const lib = JSON.parse(readFileSync(new URL("../library/wines.json", import.meta.url), "utf8")).wines;
  await page.route("https://theatrium.devinos.hr/api/vina**", async (route) => {
    const req = route.request(), url = new URL(req.url());
    const send = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(b) });
    if (req.headers().authorization !== "Bearer github_pat_fake") return send({ error: "key" }, 401);
    if (url.pathname.endsWith("/foto/1")) return route.fulfill({ status: 404, body: "" });
    if (req.method() === "GET") return send({ items: inbox.items, limits: { enabled: true, today: inbox.items.length, dailyCap: 5, month: 1, monthlyCap: 60 } });
    inbox.posts.push({ path: url.pathname, body: req.postData() || "" });
    if (url.pathname === "/api/vina") {
      inbox.items.unshift({ id: "r1", status: "needs_info", created_at: "2026-10-10T10:00:00Z", price_bottle: 130, price_glass: null,
        vol: null, photos: [1], questions: ["Koliko je alkohola na etiketi?"], answers: [], result: null });
      return send({ ok: true }, 201);
    }
    if (url.pathname.endsWith("/odgovor")) {
      Object.assign(inbox.items[0], { status: "ready", questions: [], result: {
        draft: { wine: lib["le-ragose--amarone-classico-riserva-2013"], listings: [{ after: "x", price: 130 }] }, gaps: ["Parker nije provjeren"] } });
      return send({ ok: true });
    }
    return send({ ok: true });
  });

  await page.click('.tabs button[data-tab="novo"]');
  const img = (name) => ({ name, mimeType: "image/png", buffer: readFileSync(new URL("../assets/qr.png", import.meta.url)) });
  await page.setInputFiles("#n-front", img("front.png"));
  await page.setInputFiles("#n-back", img("back.png"));
  await page.fill("#n-bottle", "130");
  await page.click("#n-send");
  await expect(page.locator("#novo-msg")).toContainText("Poslano", { timeout: 15000 });
  const sent = inbox.posts[0].body;
  expect(sent).toContain('name="price_bottle"');
  expect(sent).toContain("130");
  expect(sent, "the photo is re-encoded as JPEG before it leaves").toContain("image/jpeg");

  await page.fill("[data-answer='0']", "16%");
  await page.click('[data-act="odgovor"]');
  await expect(page.locator(".pv")).toBeVisible();
  const pv = await page.locator(".pv").innerText();
  expect(pv).toContain("ostale sorte 10%");
  expect(pv, "aromas in Croatian, not keys").toContain("višnja");
  expect(pv, "body is not printed twice").toContain("Crno · puno · suho");
  expect(pv).toContain("Parker nije provjeren");
  expect(inbox.posts[1].body).toContain("16%");
});

test("NOVO is switched on the board, on every listing of that wine", async ({ page }) => {
  /* Owner, 2026-10-10: Filho decides when a wine stops being news. */
  const state = await board(page);
  const ref = "marjan-simcic--merlot-opoka-2017";
  await page.fill("#q", "Merlot Opoka");
  await page.waitForTimeout(200);
  const chip = page.locator(".row").filter({ hasText: "Merlot Opoka" }).locator(".novo");
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await page.waitForFunction(() => document.getElementById("s2").className === "done", null, { timeout: 60000 });
  expect(priceOf(state.list, ref).new).toBe(true);
  expect(state.listPuts).toEqual(["NOVO: Marjan Simčič Merlot Opoka 2017 — dodano"]);
});

test("Dodaj vino: Filho corrects the preview — a price at once, a word through a run", async ({ page }) => {
  await board(page);
  const lib = JSON.parse(readFileSync(new URL("../library/wines.json", import.meta.url), "utf8")).wines;
  const posts = [];
  const item = { id: "r2", status: "ready", created_at: "2026-10-10T10:00:00Z", price_bottle: 130, price_glass: null,
    vol: null, photos: [], questions: [], answers: [],
    result: { draft: { wine: lib["le-ragose--amarone-classico-riserva-2013"], listings: [] }, gaps: [] } };
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => {
    const req = route.request();
    if (req.method() === "POST") posts.push({ path: new URL(req.url()).pathname, body: JSON.parse(req.postData()) });
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(req.method() === "GET" ? { items: [item], limits: { enabled: true, today: 1, dailyCap: 5, month: 1, monthlyCap: 60 } } : { ok: true }) });
  });
  await page.click('.tabs button[data-tab="novo"]');
  await expect(page.locator(".pv")).toBeVisible();

  await page.click('.pen[data-edit="price_bottle"]');
  await page.fill(".editbox input", "135");
  await page.click(".editbox .ok");
  await page.click('.pen[data-edit="alcohol"]');
  await page.fill(".editbox input", "16,5");
  await page.click(".editbox .ok");
  /* Publishing is not offered while corrections are unsent. */
  await expect(page.locator('[data-act="objavi"]')).toHaveCount(0);
  await page.click('[data-act="ispravak"]');
  await page.waitForTimeout(400);
  expect(posts[0].path).toBe("/api/vina/r2/ispravak");
  expect(posts[0].body.price_bottle).toBe("135");
  expect(posts[0].body.edits).toEqual([{ field: "alcohol", from: "16", to: "16,5" }]);
});

test("the board's views are one choice: Sve, Skriveno or NOVO, never two at once", async ({ page }) => {
  /* Owner, 2026-10-10: two independent toggles had to be undone by hand
     before the other meant anything. Now picking one replaces the other, and
     the Karta tab always comes back to the whole list. */
  await board(page);
  const on = () => page.locator("#views button.on").allTextContents();
  expect((await on()).length).toBe(1);
  await page.click('#views [data-view="novo"]');
  expect(await on()).toEqual([expect.stringMatching(/^NOVO/)]);
  const nNew = await page.locator(".row").count();
  await page.click('#views [data-view="skriveno"]');
  expect(await on()).toEqual([expect.stringMatching(/^Skriveno/)]);
  await page.click('.tabs button[data-tab="povijest"]');
  await page.click('.tabs button[data-tab="karta"]');
  expect(await on()).toEqual([expect.stringMatching(/^Sve/)]);
  expect(await page.locator(".row").count()).toBeGreaterThan(nNew);
});

test("Dodaj vino: every photo slot offers both the camera and the gallery", async ({ page }) => {
  /* Owner, 2026-10-11. With `capture` Android opens only the camera; without
     it newer Android pickers offer no camera at all. So each slot has two
     buttons, "Slikaj" (capture) and "Galerija" (no capture), and either fills
     it. Checked in the rendered form: two slots, each with exactly one of each. */
  await board(page);
  await page.route("https://theatrium.devinos.hr/api/vina**", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [], limits: { enabled: true, today: 0, dailyCap: 5, month: 0, monthlyCap: 60 } }) }));
  await page.click('.tabs button[data-tab="novo"]');
  await page.waitForSelector("#n-send");
  for (const slot of ["n-front", "n-back"]) {
    const tile = page.locator(`#${slot}-tile`);
    expect(await tile.locator('input[capture]').count(), `${slot}: a camera button`).toBe(1);
    expect(await tile.locator('input:not([capture])').count(), `${slot}: a gallery button`).toBe(1);
    await expect(tile.locator(".shot-btn")).toHaveText(["📷 Slikaj", "🖼 Galerija"]);
  }
  /* the gallery one fills the slot just as the camera one does */
  await page.setInputFiles("#n-front", { name: "x.png", mimeType: "image/png",
    buffer: readFileSync(new URL("../assets/qr.png", import.meta.url)) });
  await expect(page.locator("#n-front-tile")).toHaveClass(/has/);
});

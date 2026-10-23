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
/* Every switch asks on a line under the wine — even a wine sold one way
   (owner, 2026-10-11: one tap hid Meneghetti Blanc de Blancs unasked). */
const flip = async (row) => {
  await row.locator(".sw").click();
  await row.locator(".nema.all").click();
};
const choose = async (page, name, what) => {
  const row = page.locator(".row").filter({ hasText: name });
  await row.locator(".sw").click();
  await row.locator(what === "all" ? ".nema.all" : `.nema[data-w="${what}"]`).click();
};

test("a wine sold one way is not hidden by a single tap", async ({ page }) => {
  /* Caught 2026-10-11: tapping Meneghetti Blanc de Blancs (glass only) hid
     it at once, while a wine sold both ways asked first. */
  const state = await board(page);
  await page.fill("#q", "Blanc de Blancs");
  await page.waitForTimeout(200);
  const row = page.locator(".row").first();
  await row.locator(".sw").click();
  await expect(row.locator(".nema.all")).toHaveText("sakrij s karte");
  await row.locator(".nema.cancel").click();
  await page.waitForTimeout(300);
  expect(state.puts, "odustani writes nothing").toEqual([]);
  await expect(page.locator(".row.off")).toHaveCount(0);
});

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
  await flip(page.locator(".row").filter({ hasText: "Blanc de Blancs" }));
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
  await flip(page.locator(".row").first());
  await page.waitForFunction(() => document.getElementById("s2").className === "done", null, { timeout: 60000 });
  await page.waitForFunction(() => /\(\d+s\)/.test(document.getElementById("s3").textContent), null, { timeout: 10000 });

  const t0 = Date.now();
  await flip(page.locator(".row").first());
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
  await flip(page.locator(".row").first());
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
  expect(state.listPuts).toEqual([`Cijena: Marjan Simčič Merlot Opoka 2017: ${before.price} → ${before.price + 10} € — Filho`]);
  const disk = readFileSync(new URL("../lists/theatrium.json", import.meta.url), "utf8");
  const lines = (t) => t.replace(/\r/g, "").split("\n");
  const changed = lines(state.listBody).filter((l, i) => l !== lines(disk)[i]);
  expect(changed, "only the price line differs").toEqual([`         "price": ${before.price + 10},`]);
});

test("a price that is not a price is refused, and a big jump asks first", async ({ page }) => {
  /* Both said on the line under the wine (owner, 2026-10-11: one way of
     confirming, nothing popping up). */
  const state = await board(page);
  await page.fill("#q", "Merlot Opoka");
  await page.waitForTimeout(200);
  const dialogs = [];
  page.on("dialog", (d) => { dialogs.push(d.type()); d.dismiss(); });

  await page.locator(".row").filter({ hasText: "Merlot Opoka" }).locator(".price").first().click();
  await page.fill(".pedit input", "sto pedeset");
  await page.click(".pedit .ok");
  await expect(page.locator(".choose .note")).toContainText("Upišite cijenu");

  await page.fill(".pedit input", "1500");          /* 150 → 1500: one zero too many */
  await page.click(".pedit .ok");
  await expect(page.locator(".choose .note")).toContainText("velika promjena");
  await expect(page.locator(".pedit .ok")).toHaveText("da, 1500 €");
  await expect(page.locator(".pedit input"), "what was typed stays in the field").toHaveValue("1500");
  await page.click(".choose .nema.cancel");
  await page.waitForTimeout(300);
  expect(state.listPuts, "cancelled, so nothing written").toEqual([]);
  expect(dialogs, "nothing pops up").toEqual([]);
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
  /* a field per approved critic, offered on every wine */
  await page.fill('#n-ratings [data-critic="Robert Parker"]', "95");
  await page.fill('#n-ratings [data-critic="James Suckling"]', "96");
  await page.click("#n-send");
  await expect(page.locator("#novo-msg")).toContainText("Poslano", { timeout: 15000 });
  const sent = inbox.posts[0].body;
  expect(sent).toContain('name="price_bottle"');
  expect(sent).toContain("130");
  expect(sent, "the photo is re-encoded as JPEG before it leaves").toContain("image/jpeg");
  expect(sent).toContain('name="ratings"');
  expect(sent).toContain("Robert Parker 95, James Suckling 96");

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
  /* confirmed on the line under the wine, like hiding: "odustani" changes
     nothing, "uključi NOVO" switches it */
  await chip.click();
  await page.click(".choose .nema.cancel");
  await page.waitForTimeout(300);
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  expect(state.listPuts).toEqual([]);
  await chip.click();
  await expect(page.locator(".novo-yes")).toHaveText("uključi NOVO");
  await page.click(".novo-yes");
  await page.waitForFunction(() => document.getElementById("s2").className === "done", null, { timeout: 60000 });
  expect(priceOf(state.list, ref).new).toBe(true);
  expect(state.listPuts).toEqual(["NOVO: Marjan Simčič Merlot Opoka 2017 — dodano — Filho"]);
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

test("Dodaj vino: Filho's answers stay on the card while the run works", async ({ page }) => {
  /* 2026-10-15: he answered, the run started, and nothing on the card said
     his answers had arrived — the new run resets its own steps. */
  await board(page);
  const item = { id: "r3", status: "working", created_at: "2026-10-15T10:54:00Z", updated_at: "2026-10-15T11:23:04Z",
    price_bottle: 70, price_glass: 11, vol: null, photos: [], questions: [], progress: [],
    answers: [{ q: "Magnum ili 0,75 l?", a: "0,75", at: "2026-10-15T11:22:53Z" },
              { kind: "novo", to: true, at: "2026-10-15T11:24:00Z" }], result: null };
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [item], limits: { enabled: true, today: 1, dailyCap: 10, month: 1, monthlyCap: 60 } }) }));
  await page.click('.tabs button[data-tab="novo"]');
  await expect(page.locator("#req-r3 .qa")).toContainText("Magnum ili 0,75 l?");
  await expect(page.locator("#req-r3 .qa b")).toHaveText(["0,75"]);
  await expect(page.locator("#req-r3 .prog")).toContainText("Odgovori primljeni");
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

test("a change is signed by whoever's key made it", async ({ page }) => {
  /* Owner, 2026-10-11: Filho and the owner share one GitHub account, so
     GitHub alone would credit the owner with everything. The key decides:
     a registered fingerprint is that person, any other key is Filho. */
  const state = await board(page);
  const author = [];
  await page.route("https://api.github.com/**", async (route) => {
    if (route.request().method() === "PUT") author.push(JSON.parse(route.request().postData()).author);
    return route.fallback();
  });
  await expect(page.locator("#who")).toHaveText("Filho");
  await page.fill("#q", "Blanc de Blancs");
  await page.waitForTimeout(200);
  await flip(page.locator(".row").first());
  await expect.poll(() => state.puts.length).toBe(1);
  expect(state.puts[0]).toMatch(/ — Filho$/);
  expect(author[0].name).toBe("Filho");
});

test("Povijest shows every change between the two of them, and who made it", async ({ page }) => {
  /* Owner, 2026-10-11: prices and NOVO too, not only wines in and out; a
     batch commit split into its changes; an older unsigned NOVO commit's
     "— dodano" must not be read as a person. */
  await board(page);
  const commits = [
    ["Cijena: Marjan Simčič Merlot Opoka 2017: 125 → 150 € — Jure", "2026-10-11T09:51:00Z", "jsiljeg"],
    ["NOVO: Le Ragose Caloetto 2015 — maknuto — Filho", "2026-10-11T09:40:00Z", "Filho"],
    ["2 promjene na karti — Filho\n\nNema: Kilchoman Machir Bay\nNema na čašu: Meneghetti Red 2020", "2026-10-11T09:30:00Z", "Filho"],
    ["NOVO: Chavost Paradoxe — dodano", "2026-10-10T20:00:00Z", "jsiljeg"],
  ].map(([message, date, name], i) => ({ sha: "h" + i, commit: { message, author: { date, name } } }));
  await page.route(/api\.github\.com\/repos\/jsiljeg\/list\/commits/, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(commits) }));
  await page.click('.tabs button[data-tab="povijest"]');
  await page.waitForSelector(".hist");
  const rows = await page.locator(".hist").evaluateAll((els) => els.map((e) =>
    `${e.querySelector(".badge").textContent}|${e.querySelector(".what").textContent}`));
  expect(rows).toEqual([
    "Cijena|Marjan Simčič Merlot Opoka 2017: 125 → 150 € · Jure",
    "NOVO isklj.|Le Ragose Caloetto 2015 · Filho",
    "Skinuto|Kilchoman Machir Bay · Filho",
    "Skinuto (čaša)|Meneghetti Red 2020 · Filho",
    "NOVO uklj.|Chavost Paradoxe · Jure",
  ]);
});

test("Dodaj vino: progress is shown step by step, and nothing pops up", async ({ page }) => {
  /* Owner, 2026-10-11: "we need to see the progress all the time", and
     "objavi" was a pop-up when the rest of the admin had moved away from them. */
  await board(page);
  const dialogs = [];
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
  const lib = JSON.parse(readFileSync(new URL("../library/wines.json", import.meta.url), "utf8")).wines;
  const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
  const posts = [];
  const items = [
    { id: "w1", status: "working", created_at: ago(9), updated_at: ago(8), price_bottle: 95, photos: [], questions: [], answers: [], result: null,
      progress: [{ t: "Čita etiketu", at: ago(7) }, { t: "Istražuje · wittmann-weingut.com", at: ago(3) }] },
    { id: "r1", status: "ready", created_at: ago(60), updated_at: ago(40), price_bottle: 130, photos: [], questions: [], answers: [],
      result: { draft: { wine: lib["le-ragose--amarone-classico-riserva-2013"] }, gaps: [], novo: true,
        producer_status: "known", producer_known: { name: "Le Ragose", blurb_hr: "Priča o kući.", other_wines: ["Caloetto 2015"] } } },
    /* published without NOVO: the card must not claim it */
    { id: "p1", status: "published", created_at: ago(90), updated_at: ago(80), published_at: ago(80), price_bottle: 200, photos: [], questions: [], answers: [],
      result: { draft: { wine: lib["le-ragose--amarone-classico-riserva-2013"] }, novo: false, novo_reason: "nova berba vina koje već imamo" } },
    /* published after Filho switched NOVO on over the run's "no": his tap wins */
    { id: "p2", status: "published", created_at: ago(95), updated_at: ago(85), published_at: ago(85), price_bottle: 90, photos: [], questions: [],
      answers: [{ kind: "novo", to: true, at: ago(86) }],
      result: { draft: { wine: lib["le-ragose--amarone-classico-riserva-2013"] }, novo: false } },
  ];
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => {
    const req = route.request();
    if (req.method() === "POST") posts.push(new URL(req.url()).pathname);
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(req.method() === "GET" ? { items, limits: { enabled: true, today: 1, dailyCap: 5, month: 1, monthlyCap: 60 } } : { ok: true }) });
  });
  await page.click('.tabs button[data-tab="novo"]');
  const steps = page.locator("#req-w1 .prog li");
  await expect(steps).toHaveCount(3);
  await expect(steps.last()).toHaveClass(/now/);
  await expect(steps.last()).toContainText("wittmann-weingut.com");
  await expect(steps.last()).toContainText("3 min");
  expect(await page.locator("#tab-novo").innerText(), "no Claude in what Filho reads").not.toMatch(/Claude/);

  await expect(page.locator("#req-r1 .winery")).toContainText("Vinarija je već na karti (Caloetto 2015)");
  await expect(page.locator("#req-p1")).toContainText("nije pod NOVO (nova berba vina koje već imamo)");
  await expect(page.locator("#req-p2")).toContainText("Gosti ga vide pod NOVO");

  /* NOVO changes on the tap, before the server answers */
  await page.click('#req-r1 [data-act="novo"][data-to=""]');
  await expect(page.locator('#req-r1 [data-act="novo"][data-to=""]')).toHaveClass(/ok/);

  /* publishing asks on the same row: odustani changes nothing */
  await page.click('#req-r1 [data-act="objavi"]');
  await expect(page.locator('#req-r1 [data-sure="1"]')).toHaveText("da, objavi");
  await page.click('#req-r1 [data-act="ne"]');
  expect(posts.filter((p) => p.endsWith("/objavi"))).toEqual([]);
  await page.click('#req-r1 [data-act="objavi"]');
  await page.click('#req-r1 [data-sure="1"]');
  await expect.poll(() => posts.filter((p) => p.endsWith("/objavi")).length).toBe(1);
  expect(dialogs).toEqual([]);
});

test("the ratings fields offer exactly the approved critics, in the house order", async ({ page }) => {
  /* owner, 2026-10-11: placeholders for the critics we use, so no unapproved one gets added */
  await board(page);
  await page.route("https://theatrium.devinos.hr/api/vina**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="novo"]');
  const shown = await page.locator("#n-ratings [data-critic]").evaluateAll((els) => els.map((e) => e.dataset.critic));
  const rank = JSON.parse(readFileSync(new URL("../scripts/lib/critics.json", import.meta.url), "utf8")).rank;
  expect(shown).toEqual(Object.keys(rank).sort((a, b) => rank[a] - rank[b]));
  await page.fill('#n-ratings [data-critic="Jancis Robinson"]', "17");
  await page.fill('#n-ratings [data-critic="Vinous"]', "nije broj");
  await page.setInputFiles("#n-front", { name: "f.png", mimeType: "image/png", buffer: readFileSync(new URL("../assets/qr.png", import.meta.url)) });
  await page.setInputFiles("#n-back", { name: "b.png", mimeType: "image/png", buffer: readFileSync(new URL("../assets/qr.png", import.meta.url)) });
  await page.fill("#n-bottle", "90");
  await page.click("#n-send");
  await expect(page.locator("#novo-msg")).toContainText("Vinous");
});

test("Troškovi: where the money goes, receipts by month, a category fixed in one tap, nothing pops up", async ({ page }) => {
  /* Owner, 2026-10-11: Filho photographs receipts; the tab shows where his
     money goes. The API is faked here — receipts never leave the inbox. */
  await board(page);
  const dialogs = [];
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
  const now = new Date().toISOString().slice(0, 7);
  const r = (id, day, vendor, items) => ({ id, created_at: `${now}-${day}T09:00:00Z`, updated_at: `${now}-${day}T09:00:00Z`, status: "done",
    vendor, doc_date: `${now}-${day}`, total: items.reduce((s, i) => s + i.total, 0), vat: null, payment: "", items, photos: [1], note: "", created_by: "Filho" });
  const items = [
    r("a", "02", "Metro", [{ name: "Pileća prsa", key: "pileca prsa", qty: 2, unit: "kg", unit_price: 8, total: 16, category: "meso" },
                           { name: "Folija", key: "folija", qty: 1, unit: "kom", unit_price: 4, total: 4, category: "ambalaza" }]),
    r("b", "05", "Metro", [{ name: "Pileća prsa", key: "pileca prsa", qty: 2, unit: "kg", unit_price: 9, total: 18, category: "meso" }]),
    r("c", "06", "Vinoteka", [{ name: "Pošip", key: "posip", qty: 6, unit: "kom", unit_price: 15, total: 90, category: "vino" }]),
  ];
  const posts = [];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => {
    const req = route.request();
    if (req.method() === "POST") posts.push({ path: new URL(req.url()).pathname, body: req.postData() || "" });
    if (req.url().includes("/foto/")) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(req.method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) });
  });
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');

  /* Pregled: the month total and the biggest group first */
  await expect(page.locator(".big b")).toHaveText(/128\s€/);
  await expect(page.locator(".bars .bar").first()).toContainText("Piće");
  /* receipts are added in Računi only (owner, 2026-10-12) */
  await expect(page.locator("#tab-troskovi [data-up]")).toHaveCount(0);

  /* Cijene: the chicken went from 8 to 9 €/kg */
  await page.click('[data-sub="cijene"]');
  await expect(page.locator(".pr").filter({ hasText: "Pileća prsa" })).toContainText("13%");

  /* Računi: this month, with its total; a line's category changes on the tap */
  await page.click('[data-sub="racuni"]');
  await expect(page.locator("#tab-troskovi [data-up]")).toHaveCount(2);   /* camera and gallery */
  await expect(page.locator(".mh").first()).toContainText(/128\s€/);
  await page.click('[data-open="a"]');
  await page.locator(".chip").filter({ hasText: "Ambalaža" }).click();
  await page.click('[data-setcat="a|1|ciscenje"]');
  await expect(page.locator(".chip").filter({ hasText: "Čišćenje" })).toBeVisible();
  await expect.poll(() => posts.map((p) => p.path)).toContain("/api/troskovi/a/kategorija");

  /* deleting asks on the row first */
  await page.click('[data-del="a"]');
  await expect(page.locator('[data-del="a"][data-sure="1"]')).toHaveText("da, obriši račun");
  await page.click("[data-nodel]");
  expect(posts.some((p) => p.path.endsWith("/obrisi"))).toBe(false);
  expect(dialogs).toEqual([]);
});

test("Troškovi: cash with no receipt is typed in, e-invoices are marked, a photographed twin is not counted", async ({ page }) => {
  /* Filho, 2026-10-12: "staviti račun plaćen gotovinom ali bez slike jer nema
     uvijek računa … majstora isto plaćam gotovinom bez računa — i da se prati";
     and moj-eRačun, so most invoices arrive by themselves. */
  await board(page);
  const now = new Date().toISOString().slice(0, 7);
  const r = (id, vendor, total, extra = {}) => ({ id, created_at: `${now}-02T09:00:00Z`, updated_at: "", status: "done", vendor,
    vendor_oib: "38016445738", doc_date: `${now}-02`, doc_no: "7/1/1", total, vat: 1, payment: "virman", photos: [], note: "", created_by: "",
    items: [{ name: "Maslac", key: "maslac", qty: 1, unit: "kg", unit_price: total, total, category: "mlijecno" }], source: "foto", dup_of: "", ...extra });
  const items = [r("e", "Metro", 100, { source: "mer" }), r("p", "Metro", 100, { dup_of: "e" })];
  const posts = [];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => {
    const req = route.request();
    if (req.method() === "POST") posts.push({ path: new URL(req.url()).pathname, body: req.postData() || "" });
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(req.method() === "GET" ? { items, limits: { ready: true }, mer: { state: "ok", last_ok: new Date().toISOString() } } : { ok: true }) });
  });
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');

  /* the twin is left out: 100 €, not 200 € */
  await expect(page.locator(".big b")).toHaveText(/^100\s€/);
  await page.click('[data-sub="racuni"]');
  /* a working MER connection says nothing (owner, 2026-10-12) */
  await expect(page.locator(".mer")).toHaveCount(0);
  await expect(page.locator('[data-open="e"] .from')).toHaveText("e-račun");
  /* the twin photo is out of the way until asked for (2026-10-12) */
  await expect(page.locator('[data-open="p"]')).toHaveCount(0);
  await page.click("[data-showdup]");
  await expect(page.locator('[data-open="p"] .badge')).toContainText("dvaput");

  /* no receipt: two lines, the category guessed from the words, the total summed */
  await page.click("[data-manual]");
  await page.fill("#man-vendor", "Plac Dolac");
  await page.fill('[data-ml="0"][data-k=name]', "rajčica, tikvice");
  await page.fill('[data-ml="0"][data-k=total]', "12,50");
  await page.press('[data-ml="0"][data-k=total]', "Enter");
  await page.fill('[data-ml="1"][data-k=name]', "majstor za bojler");
  await page.fill('[data-ml="1"][data-k=total]', "80");
  await expect(page.locator("#man-total")).toHaveText(/92,50\s€/);
  /* the picker shows its group's categories, the guess already chosen */
  await expect(page.locator('[data-pickscope="m|1"] .cg .on')).toHaveText("Oprema i održavanje");
  await expect(page.locator('[data-pickscope="m|1"] .cs .on')).toHaveText("Održavanje");
  /* a line with no guess: one tap on a group, one on a category */
  await page.click('[data-pickg="m|0|pice"]');
  await page.click('[data-pickc="m|0|kava"]');
  await expect(page.locator('[data-pickscope="m|0"] .cs .on')).toHaveText("Kava i čaj");
  await page.click('[data-pickg="m|0|hrana"]');
  await page.click('[data-pickc="m|0|povrce"]');
  await page.click("[data-mansave]");
  await expect.poll(() => posts.find((p) => p.path === "/api/troskovi")).toBeTruthy();
  const sent = JSON.parse(posts.find((p) => p.path === "/api/troskovi").body);
  expect(sent.payment).toBe("gotovina");
  expect(sent.items.map((i) => [i.total, i.category])).toEqual([[12.5, "povrce"], [80, "odrzavanje"]]);
});

test("Troškovi: PLAĆENO / NEPLAĆENO is one pill that toggles on every receipt, with no separate unpaid list", async ({ page }) => {
  /* owner, 2026-10-12: "simply click and toggle it", like NOVO. Until a tap,
     card and cash count as paid and virman as not; a tap can override both. */
  await board(page);
  const now = new Date().toISOString().slice(0, 10), ym = now.slice(0, 7);
  const r = (id, payment, extra = {}) => ({ id, created_at: `${ym}-01T09:00:00Z`, updated_at: "", status: "done", vendor: "Dobavljač " + id,
    vendor_oib: "", doc_date: `${ym}-01`, doc_no: "", total: 100, vat: null, payment, photos: [], note: "", created_by: "", source: "foto",
    dup_of: "", due_date: "", paid_at: "", items: [{ name: "x", key: "", qty: null, unit: "", unit_price: null, total: 100, category: "ostalo" }], ...extra });
  const items = [r("late", "virman", { due_date: "2026-01-01" }), r("card", "kartica"), r("done", "virman", { paid_at: `${ym}-02` })];
  const posts = [];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => {
    const req = route.request();
    if (req.method() === "POST") posts.push({ path: new URL(req.url()).pathname, body: req.postData() || "" });
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(req.method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) });
  });
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');

  /* Filho, 2026-10-12: "samo po mjesecima … bez ove gornje za neplaćene
     posebno" — no banner on Pregled, no Za platiti card above the receipts */
  await expect(page.locator(".big b")).toBeVisible();
  await expect(page.locator(".paybanner")).toHaveCount(0);
  await page.click('[data-sub="racuni"]');
  await expect(page.locator("#za-platiti")).toHaveCount(0);
  await expect(page.locator('[data-togglepaid="late"]')).toHaveCount(1);
  await expect(page.locator('[data-togglepaid="late"]')).toHaveText("KASNI");
  /* a card receipt is paid until he says otherwise — and one tap says it */
  await expect(page.locator('[data-togglepaid="card"]')).toHaveText("PLAĆENO");
  await page.click('[data-togglepaid="card"]');
  await expect(page.locator('[data-togglepaid="card"]')).toHaveText("NEPLAĆENO");
  /* the body also says who tapped it (Povijest), so only the flag is compared */
  await expect.poll(() => posts.some((p) => p.path === "/api/troskovi/card/placeno" && JSON.parse(p.body).paid === false)).toBe(true);
  /* the same pill, tapped twice, comes back */
  await page.click('[data-togglepaid="late"]');
  await expect(page.locator('[data-togglepaid="late"]')).toHaveText("PLAĆENO");
  await page.click('[data-togglepaid="late"]');
  await expect(page.locator('[data-togglepaid="late"]')).toHaveText("KASNI");
  /* the made-up demo is gone (owner, 2026-10-12) */
  await expect(page.getByText("Pogledaj primjer")).toHaveCount(0);
});

test("Troškovi: a line shows the paper's quantity, priced with PDV — not a converted price", async ({ page }) => {
  /* owner, 2026-10-12: "Teranino didn't cost like you put it". The LIGNUM
     invoice prints 6 kom × 16,80 € − 5% = 95,76 € net; we showed 4,2 l × 28,50 €. */
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const items = [{ id: "lig", created_at: `${ym}-09T09:00:00Z`, updated_at: "", status: "done", vendor: "LIGNUM d.o.o.", vendor_oib: "47800348437",
    doc_date: `${ym}-09`, doc_no: "313-01-91", total: 523.65, vat: 104.31, payment: "virman", photos: [], note: "", created_by: "", source: "foto",
    dup_of: "", due_date: "", paid_at: "",
    items: [{ name: "Teranino 0,7 l", key: "teranino", doc_qty: 6, doc_unit: "kom", doc_price: 16.8, discount: 5, doc_total: 95.76, vat_rate: 25,
              qty: 4.2, unit: "l", unit_price: 28.5, total: 119.7, category: "zestoko" }] }];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="racuni"]');
  await page.click('[data-open="lig"]');
  const line = page.locator(".it").first();
  /* the paper's quantity, priced with PDV (owner: "you can just show price with PDV") */
  await expect(line).toContainText(/6 kom × 19,95\s€ · s rabatom 5%/);
  await expect(line.locator("b")).toHaveText(/^119,70\s€$/);
  await expect(line).not.toContainText("28,50");
  await expect(page.locator('[data-retry="lig"]')).toHaveText("pročitaj ponovno");
});

test("Povijest: who marked an invoice PLAĆENO or NEPLAĆENO, among the wine list's changes", async ({ page }) => {
  /* owner, 2026-10-12: "who put the invoice in PLAĆENO/NEPLAĆENO (Filho/Jure),
     just like for NOVO". Receipts never touch git, so their log comes from the
     inbox, and the toggle sends who tapped it. */
  await board(page);
  const commits = [{ sha: "h0", commit: { message: "NOVO: Chavost Paradoxe — dodano — Filho", author: { date: "2026-10-12T10:00:00Z", name: "Filho" } } }];
  await page.route(/api\.github\.com\/repos\/jsiljeg\/list\/commits/, (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(commits) }));
  await page.route("https://theatrium.devinos.hr/api/troskovi/povijest", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ events: [
      { at: "2026-10-12T11:00:00Z", who: "Jure", receipt_id: "a", action: "neplaceno", vendor: "KONZUM plus d.o.o.", amount: 102.82 },
      { at: "2026-10-12T09:00:00Z", who: "Filho", receipt_id: "b", action: "placeno", vendor: "LIGNUM d.o.o.", amount: 523.65 }] }) }));
  await page.click('.tabs button[data-tab="povijest"]');
  await page.waitForSelector(".hist");
  const rows = await page.locator(".hist").evaluateAll((els) => els.map((e) =>
    `${e.querySelector(".badge").textContent}|${e.querySelector(".what").textContent}`));
  expect(rows).toEqual([
    "NEPLAĆENO|Račun: KONZUM plus d.o.o. · 102,82 € · Jure",
    "NOVO uklj.|Chavost Paradoxe · Filho",
    "PLAĆENO|Račun: LIGNUM d.o.o. · 523,65 € · Filho",
  ]);
});

/* MER's first check starts on the 1st of the current month (owner,
   2026-10-12: "fetch Oct documents"), and a check that leaves documents for
   next time must not move last_ok past them. Source assertions: the sync runs
   in a Pages Function the browser suite never boots. */
test("MER: the first sync starts on the 1st of the month and never skips a remainder", () => {
  const src = readFileSync(new URL("../web/functions/_lib/mer.js", import.meta.url), "utf8");
  expect(src).toMatch(/const firstFrom = \(\) => zagrebDate\(\)\.slice\(0, 8\) \+ "01"/);
  expect(src).toMatch(/s\.last_ok \? day\(s\.last_ok, OVERLAP_DAYS\) : firstFrom\(\)/);
  expect(src).toMatch(/fresh\.length <= PER_SYNC\) await setState\(env, "last_ok", now\)/);
});

/* Live MER answered queryInbox in XML when offered both (2026-10-12), and the
   sync died on JSON.parse. The list call must ask for JSON alone. */
test("MER: the inbox list is asked for as JSON only", () => {
  const src = readFileSync(new URL("../web/functions/_lib/mer.js", import.meta.url), "utf8");
  expect(src).toMatch(/accept: path === "\/queryInbox" \? "application\/json" :/);
});

/* Backfilling August and September (owner, 2026-10-12) must not move the
   forward check: last_ok is only set by a plain sync. */
test("MER: a backfill range never moves last_ok", () => {
  const src = readFileSync(new URL("../web/functions/_lib/mer.js", import.meta.url), "utf8");
  expect(src).toMatch(/if \(!range && fresh\.length <= PER_SYNC\) await setState\(env, "last_ok", now\)/);
  const api = readFileSync(new URL("../web/functions/api/troskovi/mer.js", import.meta.url), "utf8");
  expect(api).toMatch(/merSync\(env, \{ force: true, range,/);
});

/* Filho, 2026-10-12: "bilo bi dobro ako bi moglo i račune razvrstavat — kao
   hrana, piće, potrošno, režije". A receipt's kind is the group most of its
   money went to; the chips narrow the list and the month total with it. */
test("Troškovi: receipts sorted by kind — chips with counts, the month total follows", async ({ page }) => {
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const r = (id, lines) => ({ id, created_at: `${ym}-03T09:00:00Z`, updated_at: "", status: "done", vendor: "Dobavljač " + id,
    vendor_oib: "", doc_date: `${ym}-03`, doc_no: "", total: lines.reduce((s, [t]) => s + t, 0), vat: null, payment: "kartica",
    photos: [], note: "", created_by: "", source: "mer", dup_of: "", due_date: "", paid_at: "",
    items: lines.map(([total, category]) => ({ name: category, key: "", qty: null, unit: "", unit_price: null, total, category })) });
  /* mostly food with a little detergent is a food receipt */
  const items = [r("selecta", [[90, "meso"], [10, "ciscenje"]]), r("hep", [[200, "rezije"]]), r("vino", [[300, "vino"]])];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="racuni"]');

  /* only the kinds that occur, each with its count */
  await expect(page.locator(".kinds button")).toHaveText([/^Sve/, /^Hrana\s*1/, /^Piće\s*1/, /^Režije i usluge\s*1/]);
  await expect(page.locator(".rec")).toHaveCount(3);
  await expect(page.locator('[data-open="selecta"] .kind')).toHaveText("Hrana");
  await page.click('.kinds [data-kind="rezije"]');
  await expect(page.locator(".rec")).toHaveCount(1);
  await expect(page.locator('[data-open="hep"]')).toBeVisible();
  await expect(page.locator(".mh span").nth(1)).toHaveText(/^200\s€/);
  await page.click('.kinds [data-kind=""]');
  await expect(page.locator(".rec")).toHaveCount(3);
  await expect(page.locator(".mh span").nth(1)).toHaveText(/^600\s€/);
});

/* A photo marked paid, then matched to its e-invoice, must not take the mark
   with it into the twin pile (2026-10-12). Source assertion: server code. */
test("Troškovi: a paid mark on a photo carries over to its e-invoice twin", () => {
  const src = readFileSync(new URL("../web/functions/api/troskovi/[id]/[action].js", import.meta.url), "utf8");
  expect(src).toMatch(/if \(photo\.paid_at && !einv\.paid_at\) await setFields\(env, einv\.id, \{ paid_at: photo\.paid_at \}\)/);
  expect(readFileSync(new URL("../web/functions/_lib/mer.js", import.meta.url), "utf8")).toMatch(/SELECT id, doc_no, doc_date, total, paid_at FROM/);
});

/* Owner, 2026-10-12: "month option to select and only then invoices are
   shown, not endless scrolling". Računi lists one month, switched with the
   same ‹ › as Pregled, and the two tabs share the month. */
test("Troškovi: Računi shows one month at a time, the same month as Pregled", async ({ page }) => {
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const r = (id, mo, total) => ({ id, created_at: `${mo}-03T09:00:00Z`, updated_at: "", status: "done", vendor: "Dobavljač " + id,
    vendor_oib: "", doc_date: `${mo}-03`, doc_no: "", total, vat: null, payment: "kartica", photos: [], note: "", created_by: "",
    source: "foto", dup_of: "", due_date: "", paid_at: "", items: [{ name: "x", key: "", qty: null, unit: "", unit_price: null, total, category: "meso" }] });
  const items = [r("now1", ym, 10), r("now2", ym, 20), r("old", prev, 70)];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="racuni"]');
  await expect(page.locator(".rec")).toHaveCount(2);
  await expect(page.locator(".mh")).toContainText(/2 računa\s*30\s€/);
  await page.click('.mnav [data-m="-1"]');
  await expect(page.locator(".rec")).toHaveCount(1);
  await expect(page.locator('[data-open="old"]')).toBeVisible();
  /* Pregled is on the same month */
  await page.click('[data-sub="pregled"]');
  await expect(page.locator(".big b")).toHaveText(/^70\s€/);
});

/* Owner, 2026-10-12: "many invoices — pretty but clean". Short supplier
   names, the unpaid filter on the kinds row, and a search across months. */
test("Troškovi: clean list — short names, Neplaćeno filter, search across months", async ({ page }) => {
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const r = (id, mo, vendor, total, extra = {}) => ({ id, created_at: `${mo}-03T09:00:00Z`, updated_at: "", status: "done", vendor,
    vendor_oib: "", doc_date: `${mo}-03`, doc_no: "N-" + id, total, vat: null, payment: "virman", photos: [], note: "", created_by: "MER",
    source: "mer", dup_of: "", due_date: "", paid_at: "", items: [{ name: "x", key: "", qty: null, unit: "", unit_price: null, total, category: "meso" }], ...extra });
  const items = [r("sel", ym, "SELECTA ADRIA d.o.o. za trgovinu", 1954.27), r("hep", ym, "HEP-OPSKRBA D.O.O.", 200, { paid_at: `${ym}-04` }),
    r("old", prev, "SELECTA ADRIA d.o.o. za trgovinu", 250.14)];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="racuni"]');
  await expect(page.locator('[data-open="sel"] .rv')).toContainText(/^Selecta Adria/);
  await expect(page.locator('[data-open="hep"] .rv')).toContainText(/^HEP-Opskrba/);
  /* the full name is on the opened receipt */
  await page.click('[data-open="sel"]');
  await expect(page.locator(".rec.open")).toContainText("SELECTA ADRIA d.o.o. za trgovinu");
  /* Neplaćeno narrows this month to what is owed */
  await page.click(".kinds [data-unpaid]");
  await expect(page.locator(".rec")).toHaveCount(1);
  await expect(page.locator('[data-open="sel"]')).toBeVisible();
  await page.click(".kinds [data-unpaid]");
  /* search reaches last month too, by name or by amount */
  await page.fill("#rq", "selecta");
  await expect(page.locator(".rec")).toHaveCount(2);
  await page.fill("#rq", "250,14");
  await expect(page.locator(".rec")).toHaveCount(1);
  await expect(page.locator('[data-open="old"]')).toBeVisible();
  await expect(page.locator("#rq")).toBeFocused();
});

/* Owner, 2026-10-12: "check what you are comparing — Hampden didn't increase
   179%". Bumbu and Hampden shared one key. Cijene now leaves out what is not
   a product, keeps two pack sizes apart, counts one purchase per invoice,
   and opens a row onto the invoices it compares. */
test("Troškovi: Cijene compares like with like and shows the invoices behind a row", async ({ page }) => {
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const line = (name, key, unit, unit_price, total) => ({ name, key, qty: total / unit_price, unit, unit_price, total, category: "pivo_sokovi" });
  const r = (id, day, no, items) => ({ id, created_at: `${ym}-${day}T09:00:00Z`, updated_at: "", status: "done", vendor: "ROTO DINAMIC d.o.o.",
    vendor_oib: "1", doc_date: `${ym}-${day}`, doc_no: no, total: items.reduce((s, i) => s + i.total, 0), vat: null, payment: "virman",
    photos: [], note: "", created_by: "", source: "mer", dup_of: "", due_date: "", paid_at: "", items });
  const items = [
    r("a", "03", "238442-31", [line("Römerquelle negazirana voda 0,75 l", "voda negazirana", "l", 1.6, 12),
      line("Römerquelle negazirana voda 0,33 l", "voda negazirana", "l", 2.77, 9.14),
      line("Povratna naknada za ambalažu", "povratna naknada", "kom", 0.1, 2)]),
    r("b", "06", "241232-31", [line("Römerquelle negazirana voda 0,75 l", "voda negazirana", "l", 1.84, 13.8),
      line("Römerquelle negazirana voda 0,75 l", "voda negazirana", "l", 1.84, 13.8),
      line("Povratna naknada", "povratna naknada", "kom", 0.2, 2)]),
  ];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="cijene"]');
  /* one row: the 0,75 l, bought on two invoices; the 0,33 l and the deposit are not compared */
  await expect(page.locator("#tab-troskovi .pr")).toHaveCount(1);
  await expect(page.locator("#tab-troskovi .pr")).toContainText("0,75 l");
  await expect(page.locator("#tab-troskovi .pr")).toContainText("2×");
  await expect(page.locator("#tab-troskovi .pr")).toContainText("15%");
  /* the evidence: both invoices, by number; one tap opens the invoice */
  await page.click("#tab-troskovi .pr .prh");
  await expect(page.locator("#tab-troskovi .ph .phr")).toHaveCount(2);
  await expect(page.locator("#tab-troskovi .ph")).toContainText("br. 241232-31");
  await expect(page.locator("#tab-troskovi .ph")).toContainText("br. 238442-31");
  await page.locator("#tab-troskovi .ph .phr").first().click();
  await expect(page.locator('[data-sub="racuni"]')).toHaveClass(/on/);
  await expect(page.locator(".rec.open")).toHaveCount(1);
});

/* The reader is told the keys already in use (2026-10-12), so the same
   article keeps one key across invoices. Source assertion: server code. */
test("Troškovi: the reading job carries the product keys already in use", () => {
  const src = readFileSync(new URL("../web/functions/api/troskovi/posao/[batch].js", import.meta.url), "utf8");
  expect(src).toMatch(/known_keys: await knownKeys\(env\)/);
});

/* Two pumps at once dispatched two runs and GitHub cancelled one, leaving 8
   receipts "working" for 30 minutes (2026-10-12). The loser of a race now
   gives its claim back before dispatching. Source assertion: server code. */
test("Troškovi: a pump that loses a race gives its receipts back", () => {
  const src = readFileSync(new URL("../web/functions/_lib/expenses.js", import.meta.url), "utf8");
  expect(src).toMatch(/status = 'working' AND batch != \?1 AND batch < \?1/);
  expect(src).toMatch(/if \(rival \|\| !mine \|\| !mine\.n\)/);
});

/* At 280 receipts the list read ran the Worker over its CPU limit one time
   in three (error 1102, 2026-10-12). The stored lines now go out as stored. */
test("Troškovi: the receipts list passes stored lines through without re-parsing them", () => {
  const src = readFileSync(new URL("../web/functions/api/troskovi/index.js", import.meta.url), "utf8");
  expect(src).toMatch(/replace\('"items":0', '"items":' \+ raw\)/);
  expect(src).not.toMatch(/items = \(results \|\| \[\]\)\.map\(\(r\) => shape\(r,/);
});

/* A MER import that ran out of CPU between writing the receipt and marking
   the document seen imported one invoice twice (2026-10-12). Both writes are
   now one batch. Source assertion: server code. */
test("MER: an invoice and its seen-mark are written together", () => {
  const src = readFileSync(new URL("../web/functions/_lib/mer.js", import.meta.url), "utf8");
  /* and the mark goes first, with no OR IGNORE: two imports at once (three
     March invoices, 30 ms apart) — the second breaks the key and rolls back */
  expect(src).toMatch(/await env\.DB\.batch\(\[\s*env\.DB\.prepare\("INSERT INTO expense_mer_docs[^"]*"\)[\s\S]*?INSERT INTO expense_receipts/);
  expect(src).not.toMatch(/INSERT OR IGNORE INTO expense_mer_docs \(electronic_id, receipt_id, seen_at, kind\) VALUES \(\?1, \?2, \?3, 'invoice'\)/);
});

/* Filho, 2026-10-12: "da ja stisnem usporedi mi sve cijene iz Moj Mesar i onda
   on sve usporedi". Cijene takes one supplier: only that supplier's own
   invoices, with a count of what went up and down. */
test("Troškovi: Cijene compares one supplier's prices on its own invoices", async ({ page }) => {
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const line = (name, key, unit_price) => ({ name, key, qty: 1, unit: "kg", unit_price, total: unit_price, category: "meso" });
  const r = (id, day, vendor, items) => ({ id, created_at: `${ym}-${day}T09:00:00Z`, updated_at: "", status: "done", vendor,
    vendor_oib: vendor.length + "", doc_date: `${ym}-${day}`, doc_no: "N" + id, total: items.reduce((s, i) => s + i.total, 0), vat: null,
    payment: "virman", photos: [], note: "", created_by: "", source: "mer", dup_of: "", due_date: "", paid_at: "", items });
  const items = [
    r("m1", "01", "MOJ MESAR d.o.o.", [line("Teleći but", "teleci but", 20), line("Juneći biftek", "juneci biftek", 38), line("Teleća jetrica", "teleca jetrica", 9)]),
    r("m2", "08", "MOJ MESAR d.o.o.", [line("Teleći but", "teleci but", 22), line("Juneći biftek", "juneci biftek", 38)]),
    r("s1", "02", "SELECTA ADRIA d.o.o.", [line("Teleći but", "teleci but", 30), line("Kapice", "kapica", 90)]),
    r("s2", "09", "SELECTA ADRIA d.o.o.", [line("Kapice", "kapica", 81)]),
  ];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="cijene"]');
  await page.selectOption("#pv", "Moj Mesar");
  /* veal leg compared on Moj Mesar's two invoices only — +10%, not Selecta's 30 € */
  await expect(page.locator("#tab-troskovi .pr")).toHaveCount(2);
  await expect(page.locator("#tab-troskovi .pr").filter({ hasText: "Teleći but" })).toContainText("10%");
  await expect(page.locator(".psum")).toContainText("2 proizvoda");
  await expect(page.locator(".psum")).toContainText("1 poskupio");
  await expect(page.locator(".psum")).toContainText("1 ista cijena");
  await expect(page.locator(".psum")).toContainText("Još 1 proizvod kupljeno samo jednom");
  /* from an invoice: one tap to its supplier's prices */
  await page.selectOption("#pv", "");
  await page.click('[data-sub="racuni"]');
  await page.click('[data-open="s2"]');
  await page.click('[data-pricevendor="Selecta Adria"]');
  await expect(page.locator("#pv")).toHaveValue("Selecta Adria");
  await expect(page.locator("#tab-troskovi .pr")).toHaveCount(1);
  await expect(page.locator("#tab-troskovi .pr")).toContainText("10%");
});

/* The manual form's category guesses had literal backspace characters where
   \b was meant (since 76eaff8), so "luk", "sir", "vino", "kava", "pivo" never
   matched. No source file may carry a control character. */
test("Troškovi: source files carry no control characters, and the manual guess works on short words", async ({ page }) => {
  for (const f of ["../js/admin-expenses.js", "../web/functions/_lib/ubl.js", "../web/functions/_lib/mer.js", "../web/functions/_lib/expenses.js"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    expect(src, f).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f]/);
  }
  await board(page);
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items: [], limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="racuni"]').catch(() => {});
  await page.click("[data-manual]");
  await page.fill('[data-ml="0"][data-k=name]', "luk");
  await expect(page.locator('[data-pickscope="m|0"] .cs .on')).toHaveText("Voće i povrće");
  await page.fill('[data-ml="0"][data-k=name]', "vino");
  await expect(page.locator('[data-pickscope="m|0"] .cs .on')).toHaveText("Vino");
});

/* A whole year in one list answer ran the free Worker past 10 ms of CPU
   (2026-10-12). The list is paged, and the app reads every page. */
test("Troškovi: the receipts list is read in pages", async ({ page }) => {
  const api = readFileSync(new URL("../web/functions/api/troskovi/index.js", import.meta.url), "utf8");
  expect(api).toMatch(/LIMIT \?1 OFFSET \?2/);
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const r = (id) => ({ id, created_at: `${ym}-02T09:00:00Z`, updated_at: "", status: "done", vendor: "Dobavljač " + id, vendor_oib: "",
    doc_date: `${ym}-02`, doc_no: "", total: 10, vat: null, payment: "kartica", photos: [], note: "", created_by: "", source: "foto",
    dup_of: "", due_date: "", paid_at: "", items: [{ name: "x", key: "", qty: null, unit: "", unit_price: null, total: 10, category: "meso" }] });
  const asked = [];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname !== "/api/troskovi") return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    const off = Number(u.searchParams.get("offset") || 0);
    asked.push(off);
    const page1 = off === 0;
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ items: page1 ? [r("a"), r("b")] : [r("c")], more: page1, limits: { ready: true } }) });
  });
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await expect(page.locator(".big b")).toHaveText(/^30\s€/);
  expect(asked.slice(0, 2)).toEqual([0, 2]);
});

/* An e-invoice's PDF is cut out before parsing and stored as base64 text,
   decoded only when opened (2026-10-12: a March invoice's PDF ran an import
   past the CPU limit). */
test("MER: the PDF is cut out before parsing and decoded only when opened", () => {
  const ubl = readFileSync(new URL("../web/functions/_lib/ubl.js", import.meta.url), "utf8");
  expect(ubl.indexOf("EmbeddedDocumentBinaryObject\b")).toBeLessThan(ubl.indexOf("parseXml(xml)", ubl.indexOf("export function ublDraft")));
  const mer = readFileSync(new URL("../web/functions/_lib/mer.js", import.meta.url), "utf8");
  expect(mer).toMatch(/'application\/pdf;base64'/);
  const foto = readFileSync(new URL("../web/functions/api/troskovi/[id]/foto/[n].js", import.meta.url), "utf8");
  expect(foto).toMatch(/;base64\$/);
});

/* Owner, 2026-10-12: Henri Giraud comes as 0,75 l and 1,5 l, and the XML
   names both "ESPRIT BRUT NAT.". One name at two prices on one invoice, or
   a jump no bottled article makes, is set aside to check — never compared.
   A size that lives only in the key is shown on the row. */
test("Troškovi: Cijene sets aside a bottle and a magnum under one name", async ({ page }) => {
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const hg = (unit_price, key = "sampanjac henri giraud esprit brut nature") =>
    ({ name: "Šampanjac Henri Giraud Esprit Brut Nature", key, qty: 1, unit: "kom", unit_price, total: unit_price, category: "vino" });
  const r = (id, day, items) => ({ id, created_at: `${ym}-${day}T09:00:00Z`, updated_at: "", status: "done", vendor: "WINE SELECT D.O.O.",
    vendor_oib: "9", doc_date: `${ym}-${day}`, doc_no: "N" + id, total: items.reduce((s, i) => s + i.total, 0), vat: null, payment: "virman",
    photos: [], note: "", created_by: "", source: "mer", dup_of: "", due_date: "", paid_at: "", items });
  const items = [
    r("a", "01", [hg(69), hg(143.75)]),                               /* both on one invoice */
    r("b", "05", [hg(69)]),
    r("c", "08", [hg(143.75, "sampanjac henri giraud esprit brut nature 1,5 l")]),
    r("d", "09", [hg(143.75, "sampanjac henri giraud esprit brut nature 1,5 l")]),
    r("e", "02", [{ ...hg(40, "rum x 0,7 l"), name: "Rum X 0,7 l", category: "zestoko" }]),
    r("f", "06", [{ ...hg(90, "rum x 0,7 l"), name: "Rum X 0,7 l", category: "zestoko" }]),   /* +125% */
  ];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="cijene"]');
  const box = page.locator("#tab-troskovi");
  await expect(box.getByText("Treba provjeriti")).toBeVisible();
  await expect(box.locator(".pr").filter({ hasText: "provjeriti" })).toHaveCount(2);      /* the mixed 0,75 l and the rum jump */
  await expect(box.locator(".pr").filter({ hasText: "Rum X" })).toContainText("provjeriti");
  /* the magnum, on its own key, compares with itself and says its size */
  await expect(box.locator(".pr").filter({ hasText: "· 1,5 l" })).toContainText("ista");
  await expect(box.locator(".pr").filter({ hasText: /▲|▼/ })).toHaveCount(0);
});

/* The supplier's article number reaches the line (W067 vs W442). */
test("MER: an e-invoice line keeps the supplier's article number", () => {
  const ubl = readFileSync(new URL("../web/functions/_lib/ubl.js", import.meta.url), "utf8");
  expect(ubl).toMatch(/doc_code: txt\(ln, "Item", "SellersItemIdentification", "ID"\)/);
  const eracun = readFileSync(new URL("../web/functions/api/troskovi/[id]/eracun.js", import.meta.url), "utf8");
  expect(eracun).toMatch(/code: doc_code \|\| ""/);
});

/* Overnight 2026-10-12, 337 receipts were marked unreadable in 2-second runs
   while the Claude subscription was at its usage limit. A run that never read
   reports "retry": the receipt goes back in line, the try is not counted,
   and the pump pauses. Source assertion: server code. */
test("Troškovi: a run that never read puts its receipts back in line and pauses reading", () => {
  const act = readFileSync(new URL("../web/functions/api/troskovi/[id]/[action].js", import.meta.url), "utf8");
  expect(act).toMatch(/b\.status === "retry"[\s\S]*?status = 'queued'[\s\S]*?runs = MAX\(0, runs - 1\)[\s\S]*?pausePump\(env, 30\)/);
  const lib = readFileSync(new URL("../web/functions/_lib/expenses.js", import.meta.url), "utf8");
  expect(lib).toMatch(/held: "paused"/);
});

/* Owner, 2026-10-13: "we would need Plaće category". A payroll is its own
   group — a chip in Računi, a bar in Pregled — and never a Cijene product. */
test("Troškovi: Plaće is its own kind, and a manual 'plaće' line guesses it", async ({ page }) => {
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const r = (id, vendor, total, category) => ({ id, created_at: `${ym}-03T09:00:00Z`, updated_at: "", status: "done", vendor, vendor_oib: "",
    doc_date: `${ym}-03`, doc_no: "", total, vat: null, payment: "virman", photos: [], note: "", created_by: "", source: "foto",
    dup_of: "", due_date: "", paid_at: "", items: [{ name: vendor, key: "", qty: null, unit: "", unit_price: null, total, category }] });
  const items = [r("p", "Plaće", 9000, "place"), r("m", "Moj Mesar", 300, "meso")];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await expect(page.locator(".bars .bar").first()).toContainText("Plaće");
  await page.click('[data-sub="racuni"]');
  await expect(page.locator('.kinds [data-kind="place"]')).toContainText("1");
  await page.click("[data-manual]");
  await page.fill('[data-ml="0"][data-k=name]', "plaće za rujan");
  await expect(page.locator('[data-pickscope="m|0"] .cg .on')).toHaveText("Plaće");
});

/* 113 reading runs in a night at 8 receipts each (2026-10-13): e-invoices
   now go up to 24 a run, photos stay at 8. Source assertion: server code. */
test("Troškovi: a reading run takes up to 24 e-invoices but only 8 photos", () => {
  const lib = readFileSync(new URL("../web/functions/_lib/expenses.js", import.meta.url), "utf8");
  expect(lib).toMatch(/BATCH_EINVOICE = 24/);
  expect(lib).toMatch(/if \(photo && photos >= BATCH\) continue;/);
  expect(lib).toMatch(/"place"/);
});

/* Salaries come as the bank's "Popis naloga za plaćanje", already paid
   (owner, 2026-10-13). A read document may carry paid_date; it never
   overwrites a mark set by hand. Source assertion: server code. */
test("Troškovi: a document that proves payment arrives marked paid", () => {
  const act = readFileSync(new URL("../web/functions/api/troskovi/[id]/[action].js", import.meta.url), "utf8");
  expect(act).toMatch(/b\.paid_date[\s\S]{0,40}&& !item\.paid_at\) await setFields\(env, id, \{ paid_at: b\.paid_date \}\)/);
});

/* Owner, 2026-10-13: "gallery should also accept PDF as well". A PDF is
   offered, shown as a document tile, and sent as itself. */
test("Troškovi: the gallery takes a PDF and sends it as a PDF", async ({ page }) => {
  await board(page);
  const posts = [];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => {
    const req = route.request();
    if (req.method() === "POST") posts.push(req.postDataBuffer() ? req.postDataBuffer().toString("latin1") : "");
    return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(req.method() === "GET" ? { items: [], limits: { ready: true } } : { ok: true, item: {} }) });
  });
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="racuni"]').catch(() => {});
  const gallery = page.locator('input[type=file][multiple][data-up]');
  await expect(gallery).toHaveAttribute("accept", /application\/pdf/);
  await gallery.setInputFiles({ name: "place-kolovoz.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%test\n") });
  await expect(page.locator(".upth.pdf")).toContainText("place-kolovoz");
  await page.click("[data-send]");
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toMatch(/filename="racun\.pdf"\r\nContent-Type: application\/pdf/);
  expect(posts[0]).toContain("%PDF-1.4");
});

/* The reading job hands a gallery PDF to the run (an e-invoice's own PDF
   stays out of it). Source assertion: server code. */
test("Troškovi: the reading job lists uploaded PDFs", () => {
  const src = readFileSync(new URL("../web/functions/api/troskovi/posao/[batch].js", import.meta.url), "utf8");
  expect(src).toMatch(/p\.mime = 'application\/pdf'\) AS pdfs/);
  expect(src).toMatch(/pdfs: r\.source === "mer" \? \[\] : nums\(r\.pdfs\)/);
  expect(readFileSync(new URL("../web/functions/_lib/expenses.js", import.meta.url), "utf8")).toMatch(/PHOTO_TYPES = \[[^\]]*"application\/pdf"/);
});

/* 2026-10-13: the reader's per-kg conversion was unsteady — the same "3 kom"
   of ricotta at 7,70 € became 0,75 kg one week and 3 kg the next, and Cijene
   showed −75%. Lines with the paper's numbers compare the printed price per
   printed unit (with PDV, after rabat). */
test("Troškovi: Cijene compares the printed price per printed unit", async ({ page }) => {
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const ric = (qty, unit_price) => ({ name: "Ricotta 250 g", key: "ricotta 250 g", qty, unit: "kg", unit_price, total: 25.99,
    doc_qty: 3, doc_unit: "kom", doc_price: 7.7, discount: 10, doc_total: 20.79, vat_rate: 25, category: "mlijecno" });
  const r = (id, day, it) => ({ id, created_at: `${ym}-${day}T09:00:00Z`, updated_at: "", status: "done", vendor: "Lareto grupa d.o.o.",
    vendor_oib: "5", doc_date: `${ym}-${day}`, doc_no: "N" + id, total: 25.99, vat: null, payment: "virman", photos: [], note: "",
    created_by: "", source: "mer", dup_of: "", due_date: "", paid_at: "", items: [it] });
  /* the reader's conversion says 34,65 €/kg, then 8,66 €/kg — the paper says the same both times */
  const items = [r("a", "02", ric(0.75, 34.6533)), r("b", "09", ric(3, 8.6633))];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="cijene"]');
  const row = page.locator("#tab-troskovi .pr").filter({ hasText: "Ricotta" });
  await expect(row).toContainText("8,66 €");
  await expect(row).toContainText("/kom");
  await expect(row).toContainText("ista");
});

/* Owner, 2026-10-13: "plaće could also be in Cijene" and "some sorting in
   Cijene (asc/desc when I click)". Plaće is one row, month against month;
   the sort buttons choose the order and a second tap turns it round. */
test("Troškovi: Cijene has Plaće month by month, and sorts on a tap", async ({ page }) => {
  await board(page);
  const [y, m] = new Date().toISOString().slice(0, 7).split("-").map(Number);
  const mo = (d) => new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7);
  const r = (id, ym, items) => ({ id, created_at: `${ym}-05T09:00:00Z`, updated_at: "", status: "done", vendor: id === "p1" || id === "p2" ? "Plaće" : "Moj Mesar",
    vendor_oib: "7", doc_date: `${ym}-05`, doc_no: "N" + id, total: items.reduce((s, i) => s + i.total, 0), vat: null, payment: "virman",
    photos: [], note: "", created_by: "", source: "foto", dup_of: "", due_date: "", paid_at: "", items });
  const kg = (name, key, unit_price) => ({ name, key, qty: 1, unit: "kg", unit_price, total: unit_price, category: "meso" });
  const items = [
    r("p1", mo(-1), [{ name: "Plaće za prošli", key: "", total: 15000, category: "place" }]),
    r("p2", mo(0), [{ name: "Plaće za ovaj", key: "", total: 16500, category: "place" }]),
    r("a", mo(-1), [kg("Biftek", "biftek", 40), kg("Teletina", "teletina", 20)]),
    r("b", mo(0), [kg("Biftek", "biftek", 36), kg("Teletina", "teletina", 21)]),
  ];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="cijene"]');
  const rows = page.locator("#tab-troskovi .pr .pn");
  await expect(page.locator("#tab-troskovi .pr").filter({ hasText: "Plaće · po mjesecu" })).toContainText("10%");
  /* default: biggest rise first — Plaće +10%, Teletina +5%, Biftek −10% */
  await expect(rows.first()).toContainText("Plaće");
  await expect(rows.last()).toContainText("Biftek");
  await page.click('[data-psort="promjena"]');                    /* turned round: biggest drop first */
  await expect(rows.first()).toContainText("Biftek");
  await page.click('[data-psort="naziv"]');                       /* A–Ž */
  await expect(rows.first()).toContainText("Biftek");
  await expect(rows.last()).toContainText("Teletina");
  await expect(page.locator('[data-psort="naziv"]')).toContainText("A–Ž");
  await page.click('[data-psort="potroseno"]');                   /* most spent first */
  await expect(rows.first()).toContainText("Plaće");
});

/* Filho, 2026-10-13: how much PDV he has to pay. Monthly, by invoice date
   (the accountant). Pretporez from the invoices, rate by rate from an
   e-invoice's lines; a credit note subtracts; cash with no receipt and a
   photo's PDV are kept apart from the exact part. */
test("Troškovi: PDV shows the month's pretporez, rate by rate", async ({ page }) => {
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const line = (net, rate) => ({ name: "x", key: "", qty: 1, unit: "kom", unit_price: null, total: Math.round(net * (1 + rate / 100) * 100) / 100,
    doc_qty: 1, doc_unit: "kom", doc_price: net, doc_total: net, vat_rate: rate, category: "vino" });
  const r = (id, source, items, vat, extra = {}) => ({ id, created_at: `${ym}-04T09:00:00Z`, updated_at: "", status: "done", vendor: "D " + id,
    vendor_oib: "1", doc_date: `${ym}-04`, doc_no: "N" + id, total: items.reduce((s, i) => s + i.total, 0), vat, payment: "virman",
    photos: [], note: "", created_by: "", source, dup_of: "", due_date: "", paid_at: "", items, ...extra });
  const items = [
    r("a", "mer", [line(100, 25), line(100, 13)], 38),                 /* 25 + 13 */
    r("b", "mer", [line(-40, 25)], -10),                               /* a credit note */
    r("c", "foto", [{ name: "y", key: "", total: 12.5, category: "suha" }], 2.5),
    r("d", "rucno", [{ name: "plac", key: "", total: 50, category: "povrce" }], null),
  ];
  await page.route("https://theatrium.devinos.hr/api/troskovi**", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { items, limits: { ready: true } } : { ok: true }) }));
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.click('[data-sub="pdv"]');
  await expect(page.locator(".card.vat .vbig").first()).toHaveText(/^30,50\s€/);      /* 38 − 10 + 2,5 */
  await expect(page.locator(".vrates")).toContainText(/25%\s*15,00\s€/);
  await expect(page.locator(".vrates")).toContainText(/13%\s*13,00\s€/);
  const pre = page.locator(".card.vat").filter({ has: page.locator("h3", { hasText: /^Pretporez/ }) });
  await expect(pre).toContainText("od toga 2,50 € sa slikanih računa");
  await expect(pre).toContainText("3 računa");
  /* PDV za uplatu is the first card (owner, 2026-10-13) */
  await expect(page.locator(".card.vat").first()).toContainText("PDV za uplatu");
});

/* Owner, 2026-10-13: "it takes even 5 seconds when I click Troškovi". The
   newest page is shown first and the rest are asked for at once. */
test("Troškovi: the newest receipts show before the older pages arrive, which come in parallel", async ({ page }) => {
  await board(page);
  const ym = new Date().toISOString().slice(0, 7);
  const r = (id) => ({ id, created_at: `${ym}-02T09:00:00Z`, updated_at: "", status: "done", vendor: "D " + id, vendor_oib: "",
    doc_date: `${ym}-02`, doc_no: "", total: 10, vat: null, payment: "kartica", photos: [], note: "", created_by: "", source: "foto",
    dup_of: "", due_date: "", paid_at: "", items: [{ name: "x", key: "", total: 10, category: "meso" }] });
  const asked = [];
  let release;
  const gate = new Promise((res) => { release = res; });
  await page.route("https://theatrium.devinos.hr/api/troskovi**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname !== "/api/troskovi") return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    const off = Number(u.searchParams.get("offset") || 0);
    asked.push(off);
    if (off === 0) return route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ items: [r("a")], more: true, total: 400, limits: { ready: true } }) });
    await gate;                                       /* the older pages wait until we have looked */
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [r("o" + off)], more: false }) });
  });
  await page.route("https://theatrium.devinos.hr/api/vina**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' }));
  await page.click('.tabs button[data-tab="troskovi"]');
  await expect(page.locator(".big b")).toHaveText(/^10\s€/);                  /* the first page, already on screen */
  await expect(page.getByText("učitavam starije račune")).toBeVisible();
  await expect.poll(() => asked.length).toBe(4);                              /* all three older pages asked for, together */
  release();
  await expect(page.locator(".big b")).toHaveText(/^40\s€/);
});

/* The scheduled MER check (9:00, 16:00 Zagreb) comes with the reading run's
   key. Source assertion: server code. */
test("MER: the inbox check accepts the reading run's key", () => {
  const src = readFileSync(new URL("../web/functions/api/troskovi/mer.js", import.meta.url), "utf8");
  expect(src).toMatch(/onRequestPost[\s\S]*?isExpenseWorker\(request, env\) && !\(await isStaffAsync/);
});

/* 2026-10-23: on Filho's MacBook (Safari) the board read "ne mogu učitati
   kartu: Response served by service worker is an error" — the guest app's
   service worker proxied the admin's GitHub and devinos.hr calls and answered
   a failed fetch with Response.error(). Staff traffic must bypass it. Source
   assertion: no desktop test browser reproduces Safari's worker. */
test("the service worker leaves the admin and its APIs alone", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const head = sw.slice(sw.indexOf('addEventListener("fetch"'), sw.indexOf("e.respondWith"));
  expect(head).toMatch(/api\.github\.com"[^\n]*\) return;/);
  expect(head).toMatch(/devinos\.hr"[^\n]*\) return;/);
  expect(head).toMatch(/cache === "no-store"\) return;/);
  expect(head).toContain("admin(\\.html)?|js\\/admin");
  const admin = readFileSync(new URL("../js/admin.js", import.meta.url), "utf8");
  expect(admin).not.toMatch(/fetch\("library\/wines\.json", \{ cache: "no-cache" \}\)/);
});

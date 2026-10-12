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

  /* Računi: grouped by month; a line's category changes on the tap */
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
  await expect(page.locator(".mer")).toContainText("moj-eRačun");
  await expect(page.locator('[data-open="e"] .badge')).toContainText("e-račun");
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

test("Troškovi: PLAĆENO / NEPLAĆENO is one pill that toggles on every receipt; Za platiti lists the unpaid", async ({ page }) => {
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

  /* Pregled names what is owed, and that it is late */
  await expect(page.locator(".paybanner")).toContainText("1 račun");
  await expect(page.locator(".paybanner")).toContainText("kasni");
  await page.click(".paybanner");
  /* only the unpaid virman one is listed */
  await expect(page.locator("#za-platiti .py")).toHaveCount(1);
  await expect(page.locator('#za-platiti [data-togglepaid="late"]')).toHaveText("KASNI");
  /* a card receipt is paid until he says otherwise — and one tap says it */
  await expect(page.locator('[data-togglepaid="card"]')).toHaveText("PLAĆENO");
  await page.click('[data-togglepaid="card"]');
  await expect(page.locator('[data-togglepaid="card"]').first()).toHaveText("NEPLAĆENO");
  await expect.poll(() => posts.map((p) => p.path + p.body)).toContain('/api/troskovi/card/placeno{"paid":false}');
  await expect(page.locator("#za-platiti .py")).toHaveCount(2);
  /* paying from Za platiti: the row stays a moment, so the same pill undoes it */
  await page.locator('#za-platiti [data-togglepaid="late"]').click();
  await expect(page.locator('#za-platiti [data-togglepaid="late"]')).toHaveText("PLAĆENO");
  await expect.poll(() => posts.map((p) => p.path + p.body)).toContain('/api/troskovi/late/placeno{"paid":true}');
  await page.locator('#za-platiti [data-togglepaid="late"]').click();
  await expect(page.locator('#za-platiti [data-togglepaid="late"]')).toHaveText("KASNI");
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
  expect(src).toMatch(/if \(fresh\.length <= PER_SYNC\) await setState\(env, "last_ok", now\)/);
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
  expect(api).toMatch(/merSync\(env, \{ force: true, range \}\)/);
});

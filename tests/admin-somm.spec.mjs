/* /admin as the head sommelier (web/ROLES.md, 2026-11-17).

   Owner: Toni sees Karta, Dodaj vino and Ponuda, does everything those do,
   and never sees Povijest or Troškovi — "not even 1% chance". The server
   enforces that (tests/roles.spec.mjs); this proves the page is the second
   lock and does not undo the first:

   - Povijest and Troškovi are not in his DOM at all, nor their scripts;
   - no trick in the address, the DOM or the console opens them;
   - over a whole session — every tab, every operation, waiting out the
     prefetch Troškovi used to do 1.5 s after load — not one request goes to
     /api/troskovi, /api/prihodi or GitHub;
   - hide, return, price, NOVO, + čaša, Dodaj vino and Ponuda all work;
   - a tablet re-keyed from Filho to Toni carries nothing of Filho's over;
   - Filho's page still has all five tabs and still loads them.

   theatrium.devinos.hr is faked at its real URL. The fake answers a somm key
   only where the server's own ACCESS table allows (sommMay, imported), and
   its /api/karta runs the server's own change checker. */
import { test, expect } from "@playwright/test";
import { readFileSync, mkdtempSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sommMay } from "../web/functions/_lib/roles.js";
import { checkList, checkRules } from "../web/functions/_lib/karta.js";

test.use({ viewport: { width: 1024, height: 768 } });

const PIN = "7777";
const SOMM = "somm_" + "T".repeat(43);
const FILHO = "github_pat_fake";
const LIST = readFileSync(new URL("../lists/theatrium.json", import.meta.url), "utf8");
const LIB = JSON.parse(readFileSync(new URL("../library/wines.json", import.meta.url), "utf8")).wines;
/* Troškovi's and Povijest's data, code, and the files only they read */
const FORBIDDEN = /\/api\/(troskovi|prihodi)|api\.github\.com|\/admin-expenses\.js|\/admin-history\.js|till-map|buy-map|list-since/;
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s) => Buffer.from(s, "base64").toString("utf8");

/** The venue's server and the published files, in memory. Every request the
    page makes is recorded in `state.requests`. */
async function site(page, { enrolled = true } = {}) {
  const state = {
    requests: [], karta: [], refused: [],
    files: { "lists/theatrium.json": { doc: JSON.parse(LIST), sha: "L0" }, "data/unavailable.json": { doc: { _: "x", hidden: [] }, sha: "U0" } },
    vina: [], citaj: [], offer: null, posts: [],
  };
  page.on("request", (r) => state.requests.push(`${r.method()} ${r.url()}`));
  const send = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  /* GitHub: a somm session must never come here; Filho's does */
  await page.route("https://api.github.com/**", (route) => {
    const req = route.request(), u = req.url();
    if (req.headers().authorization !== `Bearer ${FILHO}`) return send(route, { message: "Bad credentials" }, 401);
    if (/\/commits\?/.test(u)) return send(route, [{ sha: "c1", commit: { message: "Cijena: X Y: 1 → 2 € — Filho", author: { date: "2026-11-01T10:00:00Z", name: "Filho" } } }]);
    const m = u.match(/contents\/([^?]+)/);
    const f = m && state.files[decodeURIComponent(m[1])];
    if (!f) return send(route, {}, 404);
    if (req.method() === "GET") return send(route, { sha: f.sha, content: b64(JSON.stringify(f.doc)) });
    const b = JSON.parse(req.postData());
    f.doc = JSON.parse(unb64(b.content)); f.sha += "+";
    return send(route, { content: { sha: f.sha } });
  });

  await page.route("https://theatrium.devinos.hr/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, method = req.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204 });
    const auth = req.headers().authorization || "";
    const somm = auth === `Bearer ${SOMM}`;
    if (somm && !enrolled) return send(route, { error: "key" }, 401);
    if (somm && !sommMay(method, p)) { state.refused.push(`${method} ${p}`); return send(route, { error: "role" }, 403); }
    if (!somm && auth !== `Bearer ${FILHO}`) return send(route, { error: "key" }, 401);

    if (p === "/api/uloga") return send(route, somm ? { role: "somm", who: "Toni", print: "0123456789abcdef" } : { role: "full", print: "x" });
    if (p === "/api/karta") {
      if (method === "GET") {
        const f = state.files[url.searchParams.get("file")];
        return f ? send(route, { sha: f.sha, content: b64(JSON.stringify(f.doc)) }) : send(route, { error: "file" }, 400);
      }
      const b = JSON.parse(req.postData());
      const f = state.files[b.file];
      if (!f) return send(route, { error: "file" }, 400);
      if (b.sha !== f.sha) return send(route, { error: "conflict" }, 409);
      const next = JSON.parse(unb64(b.content));
      const why = b.file === "lists/theatrium.json" ? checkList(f.doc, next) : checkRules(f.doc, next, LIB);
      state.karta.push({ file: b.file, message: b.message, why });
      if (why) return send(route, { error: "change", why }, 422);
      f.doc = next; f.sha += "+";
      return send(route, { content: { sha: f.sha } });
    }
    if (p === "/api/vina" && method === "GET") return send(route, { items: state.vina, limits: { enabled: true, today: 0, dailyCap: 45, month: 0, monthlyCap: 90 } });
    if (p === "/api/vina" && method === "POST") {
      state.posts.push({ p, body: req.postData() || "" });
      state.vina.unshift({ id: "r1", status: "queued", created_at: new Date().toISOString(), price_bottle: 95, price_glass: null, vol: null,
        photos: [], questions: [], answers: [], result: null, created_by: "Toni", progress: [] });
      return send(route, { ok: true }, 201);
    }
    if (/^\/api\/vina\//.test(p)) { state.posts.push({ p, body: req.postData() || "" }); return send(route, { ok: true }); }
    if (p === "/api/kuhinja/citaj" && method === "GET")
      return send(route, { today: new Date().toISOString().slice(0, 10), items: state.citaj, limits: { enabled: true, today: 0, dailyCap: 6, month: 0, monthlyCap: 60 } });
    if (p === "/api/kuhinja/citaj" && method === "POST") {
      state.posts.push({ p, body: req.postData() || "" });
      state.citaj.unshift({ id: "d1", date: new Date().toISOString().slice(0, 10), status: "queued", created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), text: "x", remark: "", photos: [], runs: 0, result: null, run_url: "", error: "", created_by: "Toni" });
      return send(route, { ok: true, id: "d1" }, 201);
    }
    if (p === "/api/kuhinja/ponuda") return send(route, { date: new Date().toISOString().slice(0, 10), offer: state.offer, recent: [] });
    /* Filho's Troškovi: one receipt nobody else may ever see */
    if (p === "/api/troskovi") return send(route, { items: [{ id: "t1", created_at: "2026-11-02T09:00:00Z", updated_at: "", status: "done",
      vendor: "TAJNI DOBAVLJAČ d.o.o.", doc_date: new Date().toISOString().slice(0, 10), total: 777.77, vat: null, payment: "gotovina",
      items: [{ name: "Tajna stavka", key: "tajna", qty: 1, unit: "kom", unit_price: 777.77, total: 777.77, category: "meso" }],
      photos: [], note: "", created_by: "Filho" }], limits: { ready: true } });
    if (p === "/api/troskovi/povijest") return send(route, { events: [{ at: "2026-11-02T10:00:00Z", who: "Filho", action: "placeno", vendor: "TAJNI DOBAVLJAČ d.o.o.", amount: 777.77 }] });
    if (p.startsWith("/api/prihodi")) return send(route, {});
    return send(route, { items: [] });
  });

  /* the files the tablets read, for the receipt's "published" step */
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/data\/unavailable\.json/, (route) => send(route, state.files["data/unavailable.json"].doc));
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/lists\/theatrium\.json/, (route) => send(route, state.files["lists/theatrium.json"].doc));
  return state;
}

async function login(page, key) {
  await page.goto("/admin.html");
  await page.fill("#pin", PIN);
  await page.click("#pin-go");
  await page.fill("#token", key);
  await page.click("#token-go");
}
const tabs = (page) => page.locator(".tabs button").evaluateAll((bs) => bs.map((b) => b.dataset.tab));
const forbidden = (state) => state.requests.filter((r) => FORBIDDEN.test(r));
const waitRows = (page) => page.waitForFunction(() => document.querySelectorAll(".row").length > 300, null, { timeout: 20000 });

/* ======================================================================= */

test("as the sommelier: three tabs, and Povijest and Troškovi are not in the page at all", async ({ page }) => {
  const state = await site(page);
  await login(page, SOMM);
  await waitRows(page);
  expect(await tabs(page)).toEqual(["karta", "novo", "ponuda"]);
  await expect(page.locator("#who")).toHaveText("Toni");
  /* absent, not hidden */
  for (const sel of ["#tab-povijest", "#tab-troskovi", '[data-tab="povijest"]', '[data-tab="troskovi"]', '[data-sub="prihodi"]',
    'script[src*="admin-expenses"]', 'script[src*="admin-history"]']) await expect(page.locator(sel), sel).toHaveCount(0);
  /* no text and no attribute anywhere names them (comments in the source do, and are not a tab) */
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/Troškovi|Povijest|Prihodi/);
  expect(await page.evaluate(() => [...document.querySelectorAll("*")].flatMap((e) => [...e.attributes].map((a) => a.value))
    .filter((v) => /troskovi|povijest|prihodi|Troškovi|Povijest|Prihodi/.test(v)))).toEqual([]);
  expect(await page.evaluate(() => [typeof window.loadExpenses, typeof window.loadHistory, typeof window.adminReady, window.adminMode()]))
    .toEqual(["undefined", "undefined", "undefined", "somm"]);
  /* past the moment Troškovi used to prefetch itself (1.5 s after load) */
  await page.waitForTimeout(2500);
  expect(forbidden(state)).toEqual([]);
  expect(state.refused).toEqual([]);
});

test("as the sommelier: no address, DOM or console trick opens Povijest or Troškovi", async ({ page }) => {
  const state = await site(page);
  await login(page, SOMM);
  await waitRows(page);
  /* the address */
  for (const h of ["#povijest", "#troskovi", "#tab-troskovi", "#prihodi"]) await page.evaluate((x) => { location.hash = x; }, h);
  await page.goto("/admin.html?tab=troskovi#troskovi");
  await page.fill("#pin", PIN); await page.click("#pin-go");
  await waitRows(page);
  /* a button forged into the tab bar: the page has no such tab, so nothing opens */
  await page.evaluate(() => {
    for (const t of ["troskovi", "povijest"]) {
      const b = document.createElement("button"); b.dataset.tab = t; b.textContent = t; b.id = "forged-" + t;
      document.querySelector(".tabs").appendChild(b);
    }
  });
  await page.click("#forged-troskovi");
  await page.click("#forged-povijest");
  await expect(page.locator("#tab-karta")).toBeVisible();
  /* even a forged container as well: shown empty, with no code to fill it */
  await page.evaluate(() => { const d = document.createElement("div"); d.id = "tab-troskovi"; d.className = "hidden"; document.getElementById("main").appendChild(d); });
  await page.click("#forged-troskovi");
  /* the console: what the full page would call */
  const r = await page.evaluate(async () => {
    const out = [];
    for (const f of ["loadExpenses", "loadHistory"]) out.push(typeof window[f]);
    return out;
  });
  expect(r).toEqual(["undefined", "undefined"]);
  await page.waitForTimeout(2000);
  await expect(page.locator("#tab-troskovi")).toBeEmpty();
  expect(await page.locator("body").innerText()).not.toMatch(/tajn|777/i);
  expect(forbidden(state)).toEqual([]);
});

test("as the sommelier: hide, return, a price, NOVO and + čaša all work — through /api/karta, never GitHub", async ({ page }) => {
  test.setTimeout(120000);
  const state = await site(page);
  await login(page, SOMM);
  await waitRows(page);
  const putsTo = (file) => state.karta.filter((k) => k.file === file && !k.why).length;

  /* hide a wine, then bring it back */
  const row = page.locator(".row").filter({ has: page.locator(".sw") }).first();
  const name = await row.locator(".nm").innerText();
  await page.fill("#q", name);
  const one = page.locator(".row").filter({ hasText: name }).first();
  await one.locator(".sw").click();
  await one.locator(".nema.all").click();
  await expect.poll(() => putsTo("data/unavailable.json"), { timeout: 15000 }).toBe(1);
  expect(state.files["data/unavailable.json"].doc.hidden.map((h) => h.name)).toEqual([name]);
  await one.locator(".sw").click();
  await one.locator(".nema.all").click();
  await expect.poll(() => putsTo("data/unavailable.json"), { timeout: 15000 }).toBe(2);
  expect(state.files["data/unavailable.json"].doc.hidden).toEqual([]);

  /* a price */
  await one.locator(".price:not(.addglass)").first().click();
  const field = one.locator(".pedit input");
  const before = Number((await field.inputValue()).replace(",", "."));
  await field.fill(String(before + 1).replace(".", ","));
  await one.locator(".pedit .ok").click();
  await expect.poll(() => putsTo("lists/theatrium.json"), { timeout: 15000 }).toBe(1);
  expect(state.karta.at(-1).message).toMatch(/^Cijena: /);
  expect(state.karta.at(-1).message, "the page does not sign — the server does").not.toMatch(/ — /);

  /* NOVO */
  await one.locator(".novo").click();
  await one.locator(".novo-yes").click();
  await expect.poll(() => putsTo("lists/theatrium.json"), { timeout: 15000 }).toBe(2);
  expect(state.karta.at(-1).message).toMatch(/^NOVO: /);

  /* + čaša on a bottle that is not poured yet */
  await page.fill("#q", "");
  const pour = page.locator(".row").filter({ has: page.locator(".addglass") }).first();
  const pname = await pour.locator(".nm").innerText();
  await page.fill("#q", pname);
  const p1 = page.locator(".row").filter({ hasText: pname }).filter({ has: page.locator(".addglass") }).first();
  await p1.locator(".addglass").click();
  await p1.locator(".gedit input").fill("5");
  await p1.locator(".gedit .ok").click();
  await expect.poll(() => putsTo("lists/theatrium.json"), { timeout: 15000 }).toBe(3);
  expect(state.karta.at(-1).message).toMatch(/^Na čašu: /);

  /* every write passed the server's own checker, none was refused */
  expect(state.karta.filter((k) => k.why)).toEqual([]);
  expect(forbidden(state)).toEqual([]);
});

test("as the sommelier: Dodaj vino sends a bottle, Ponuda sends a menu", async ({ page }) => {
  const state = await site(page);
  await login(page, SOMM);
  await waitRows(page);
  await page.click('.tabs button[data-tab="novo"]');
  const img = (n) => ({ name: n, mimeType: "image/png", buffer: readFileSync(new URL("../assets/qr.png", import.meta.url)) });
  await page.setInputFiles("#n-front", img("front.png"));
  await page.setInputFiles("#n-back", img("back.png"));
  await page.fill("#n-bottle", "95");
  await page.click("#n-send");
  await expect(page.locator("#novo-msg")).toContainText("Poslano", { timeout: 15000 });
  expect(state.posts.find((x) => x.p === "/api/vina").body).toContain('name="price_bottle"');

  await page.click('.tabs button[data-tab="ponuda"]');
  await expect(page.locator("#tab-ponuda")).toBeVisible();
  await expect.poll(() => state.requests.some((r) => r.includes("/api/kuhinja/citaj"))).toBe(true);
  const text = page.locator("#tab-ponuda textarea").first();
  await text.fill("Juha od bundeve\nTeleći obrazi s pireom");
  await page.locator("#tab-ponuda").getByRole("button", { name: /Pošalji|Napravi|Pripremi/ }).first().click();
  await expect.poll(() => state.posts.some((x) => x.p === "/api/kuhinja/citaj")).toBe(true);

  await page.click('.tabs button[data-tab="karta"]');
  await page.waitForTimeout(2000);
  expect(forbidden(state)).toEqual([]);
  expect(state.refused).toEqual([]);
});

test("a sommelier key the server does not know draws nothing", async ({ page }) => {
  const state = await site(page, { enrolled: false });
  await page.goto("/admin.html");
  await page.fill("#pin", PIN); await page.click("#pin-go");
  await page.fill("#token", SOMM); await page.click("#token-go");
  await expect(page.locator("#token-err")).toContainText("nije odobren");
  await expect(page.locator("#main")).toBeHidden();
  /* stored by an earlier visit: the same on the next load */
  await page.evaluate((k) => localStorage.setItem("theatrium-admin-token", k), SOMM);
  await page.reload();
  await page.fill("#pin", PIN); await page.click("#pin-go");
  await expect(page.locator("#token-err")).toContainText("nije odobren");
  await expect(page.locator("#main")).toBeHidden();
  await expect(page.locator(".row")).toHaveCount(0);
  expect(forbidden(state)).toEqual([]);
});

test("a tablet re-keyed from Filho to Toni carries nothing of Filho's over", async ({ page }) => {
  const state = await site(page);
  page.on("dialog", (d) => d.accept());
  await login(page, FILHO);
  await waitRows(page);
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.locator('[data-sub="racuni"]').click();
  await expect(page.locator("#tab-troskovi")).toContainText(/tajni/i);
  /* Filho logs out; Toni logs in on the same tablet */
  await page.click("#logout");
  await page.waitForSelector("#gate:not(.hidden)");
  const mark = state.requests.length;
  await page.fill("#pin", PIN); await page.click("#pin-go");
  await page.fill("#token", SOMM); await page.click("#token-go");
  await waitRows(page);
  expect(await tabs(page)).toEqual(["karta", "novo", "ponuda"]);
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => document.body.innerHTML)).not.toMatch(/tajn|777,77/i);
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/Troškovi|Povijest/);
  expect(state.requests.slice(mark).filter((r) => FORBIDDEN.test(r))).toEqual([]);
});

test("a key changed in another tab reloads this one, and Filho's Troškovi is gone with it", async ({ page, context }) => {
  const state = await site(page);
  await login(page, FILHO);
  await waitRows(page);
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.locator('[data-sub="racuni"]').click();
  await expect(page.locator("#tab-troskovi")).toContainText(/tajni/i);
  const other = await context.newPage();
  await other.goto("/admin.html");
  const reloaded = page.waitForEvent("load");
  await other.evaluate((k) => localStorage.setItem("theatrium-admin-token", k), SOMM);
  await reloaded;
  await expect(page.locator("#gate")).toBeVisible();
  await expect(page.locator("#tab-troskovi")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.innerHTML)).not.toMatch(/tajn/i);
  void state;
});

test("Filho's page is unchanged: five tabs, Povijest and Troškovi load, the board writes to GitHub", async ({ page }) => {
  const state = await site(page);
  await login(page, FILHO);
  await waitRows(page);
  expect(await tabs(page)).toEqual(["karta", "novo", "ponuda", "povijest", "troskovi"]);
  expect(state.requests.some((r) => r.includes("/api/uloga")), "Filho's page asks nothing new").toBe(false);
  await page.click('.tabs button[data-tab="povijest"]');
  await expect(page.locator("#tab-povijest .hist").first()).toBeVisible();
  await expect(page.locator("#tab-povijest")).toContainText(/tajni/i);
  expect(state.requests.some((r) => /api\.github\.com\/repos\/jsiljeg\/list\/commits/.test(r))).toBe(true);
  await page.click('.tabs button[data-tab="troskovi"]');
  await page.locator('[data-sub="racuni"]').click();
  await expect(page.locator("#tab-troskovi")).toContainText(/tajni/i);
  /* the board still writes to GitHub with his key, signed by the page */
  await page.click('.tabs button[data-tab="karta"]');
  const one = page.locator(".row").filter({ has: page.locator(".sw") }).first();
  await one.locator(".sw").click();
  await one.locator(".nema.all").click();
  await expect.poll(() => state.requests.some((r) => /^PUT https:\/\/api\.github\.com\/repos\/jsiljeg\/list\/contents\/data\/unavailable\.json/.test(r)), { timeout: 15000 }).toBe(true);
  expect(state.requests.some((r) => r.includes("/api/karta"))).toBe(false);
});

test("the demo shows the sommelier's page too, and refuses him the rest", async ({ page }) => {
  test.setTimeout(90000);
  /* demo/*.json is built by the deploy; build it here and serve it */
  const out = mkdtempSync(join(tmpdir(), "demo-"));
  execFileSync(process.execPath, ["scripts/make-demo.mjs", out], { stdio: "pipe" });
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/demo\/([a-z-]+\.json)/, (route) => {
    const f = join(out, "demo", new URL(route.request().url()).pathname.split("/").pop());
    return existsSync(f) ? route.fulfill({ status: 200, contentType: "application/json", body: readFileSync(f, "utf8") }) : route.fulfill({ status: 404, body: "" });
  });
  const reqs = [];
  page.on("request", (r) => reqs.push(r.url()));
  await page.goto("/admin.html?demo&uloga=somm");
  await page.waitForFunction(() => document.querySelectorAll(".row").length > 300, null, { timeout: 20000 });
  expect(await tabs(page)).toEqual(["karta", "novo", "ponuda"]);
  await expect(page.locator("#tab-troskovi")).toHaveCount(0);
  await page.waitForTimeout(2000);
  /* not even the demo's invented books are loaded for him */
  expect(reqs.filter((u) => /troskovi|prihodi|tvrtke|povijest|admin-expenses|admin-history|buy-map|till-map/.test(u))).toEqual([]);
  const r = await page.evaluate(async () => (await fetch("https://theatrium.devinos.hr/api/troskovi")).status);
  expect(r).toBe(403);
  /* and the full demo is still the full demo */
  await page.goto("/admin.html?demo");
  await page.waitForFunction(() => document.querySelectorAll(".row").length > 300, null, { timeout: 20000 });
  expect(await tabs(page)).toEqual(["karta", "novo", "ponuda", "povijest", "troskovi"]);
});

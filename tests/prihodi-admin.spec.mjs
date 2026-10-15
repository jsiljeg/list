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
import { DatabaseSync } from "node:sqlite";
import { cleanBill, staffReport, guestData, tillCats, staffCatSql, companyAdvice } from "../web/functions/_lib/sales.js";

const month = new Date().toISOString().slice(0, 7);
const summary = {
  month, months: [{ m: month, n: 3, total: 1130, vat: 150 }],
  days: [{ day: `${month}-01`, n: 2, total: 1000 }, { day: `${month}-02`, n: 1, total: 130 }],
  pays: [{ pay: "Visa", n: 2, total: 1000 }, { pay: "Gotovina", n: 1, total: 130 }],
  groups: [{ grp: "Glavna jela", tax: "H (HRANA IZLAZ 13%)", total: 800, net: 707.96, qty: 20 }, { grp: "Vina na čaše", tax: "P (PIĆE IZLAZ)", total: 330, net: 264, qty: 30 }],
  items: [{ name: "BEEF WELLINGTON", grp: "Glavna jela", tax: "H (HRANA IZLAZ 13%)", qty: 20, total: 800, net: 707.96 }],
  weekdays: [{ wd: 1, days: 1, n: 2, total: 1000 }, { wd: 2, days: 1, n: 1, total: 130 }],
  dayparts: [{ part: "vecera", n: 3, total: 1130 }],
  guests: [{ part: "vecera", n: 2, guests: 5, total: 1000, other_n: 1, other: 130 }],
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
  await expect(page.locator(".fc").first()).toContainText("Zarada i prag čekaju plaće");
  await expect(page.locator(".fc", { hasText: "Prosječni račun" })).toBeVisible();
  await expect(page.locator(".fc", { hasText: "Vino po računu" })).toBeVisible();
  await expect(page.locator(".fc", { hasText: "Popusti" })).toHaveCount(0);
  /* Filho's rubrike, net: food sold 708 */
  const hrana = page.locator(".rub", { hasText: "Hrana" });
  await expect(hrana).toContainText("708 €");
  await expect(page.locator(".rub", { hasText: "Vino" })).toContainText("264 €");
  await page.click('.seg3 [data-sub="prihodi"]');
  await expect(page.locator(".big > b")).toHaveText("1.130 €");
  /* potrošnja po gostu (owner, 2026-10-14): the bills with couverts over
     their guests, 1000 / 5; the bar's 130 is told apart, not averaged in */
  await expect(page.locator(".big")).toContainText("po gostu 200 €");
  await expect(page.locator(".big")).toContainText("računi bez couverta (šank, kava, vaš stol): 1, 130 €");
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

/* Konobari (Filho, 2026-10-14): a waiter is held against the others at his
   own mix of lunches and dinners, so a lunch waiter is not flagged for the
   aperitifs only dinner sells; and a gap needs 5 points to be a flag. */
test("a waiter is compared at his own lunch/dinner mix", () => {
  const bills = [
    { w: "Ana", p: "vecera", n: 40, t: 6000 }, { w: "Ivo", p: "rucak", n: 40, t: 4000 },
    { w: "Eva", p: "vecera", n: 40, t: 6000 }, { w: "Eva", p: "rucak", n: 40, t: 4000 },
  ];
  const cats = [
    { w: "Ana", p: "vecera", c: "aperitiv", n: 4, t: 40 },           /* 10% where Eva sells 30% at dinner */
    { w: "Eva", p: "vecera", c: "aperitiv", n: 12, t: 120 },
    { w: "Ivo", p: "rucak", c: "aperitiv", n: 1, t: 10 },            /* lunch: Eva sells none — Ivo is fine */
  ];
  const r = Object.fromEntries(staffReport(bills, cats).map((w) => [w.waiter, w]));
  expect(r.Ana.flags.map((f) => f.c)).toContain("aperitiv");
  expect(r.Ivo.flags.map((f) => f.c)).not.toContain("aperitiv");
});

/* Filho's corrections (2026-10-14): the owner's bills are listed but never
   compared, and a category is judged only on days anyone sold it — "bilo je
   dosta dana bez deserta". */
test("a day without desserts is nobody's missed dessert, and the owner is not compared", () => {
  const bills = [
    { w: "Ana", d: "2026-09-01", p: "vecera", n: 20, t: 3000 }, { w: "Ana", d: "2026-09-02", p: "vecera", n: 20, t: 3000 },
    { w: "Eva", d: "2026-09-01", p: "vecera", n: 20, t: 3000 }, { w: "Eva", d: "2026-09-02", p: "vecera", n: 20, t: 3000 },
    { w: "Filip Horvat", d: "2026-09-01", p: "vecera", n: 20, t: 3000 },
  ];
  /* desserts only on the 1st (none on the 2nd): Ana 8/20 that day, Eva 8/20 */
  const cats = [
    { w: "Ana", d: "2026-09-01", p: "vecera", c: "desert", n: 8, t: 80 },
    { w: "Eva", d: "2026-09-01", p: "vecera", c: "desert", n: 8, t: 80 },
  ];
  const r = Object.fromEntries(staffReport(bills, cats).map((w) => [w.waiter, w]));
  expect(r.Ana.rate.desert).toBeCloseTo(0.4);          /* over the 20 bills of the 1st, not 40 */
  expect(r.Ana.flags).toEqual([]);
  expect(r["Filip Horvat"].owner).toBe(true);
  expect(r["Filip Horvat"].flags).toEqual([]);
});

/* Potrošnja po gostu (owner, 2026-10-14): guests are a bill's couverts, or
   the persons on a group menu when that is more; a storno takes its couvert
   back; a bill with no guest (a coffee at the bar) is counted apart. Run on
   SQLite, which is what D1 is. */
test("guests come from couverts, menus and stornos, and the bar is apart", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE sales_bills (id TEXT, day TEXT, at TEXT, total REAL);
    CREATE TABLE sales_lines (bill_id TEXT, n INT, name TEXT, grp TEXT, qty REAL, total REAL);
    INSERT INTO sales_bills VALUES ('a','2026-10-01','2026-10-01T20:00',120), ('b','2026-10-01','2026-10-01T20:30',-60),
      ('c','2026-10-01','2026-10-01T13:00',600), ('d','2026-10-01','2026-10-01T22:00',8);
    INSERT INTO sales_lines VALUES ('a',0,'COUVERT','Couvert',2,6), ('a',1,'BEEF','Glavna jela',2,114),
      ('b',0,'COUVERT','Couvert',-1,-3), ('b',1,'BEEF','Glavna jela',-1,-57),
      ('c',0,'MENU 60','Meniji',10,600), ('c',1,'COUVERT','Couvert',4,0), ('d',0,'ESPRESSO','Kava',2,8);`);
  const env = { DB: { prepare: (s) => ({ bind: (...a) => ({ all: async () => ({ results: db.prepare(s.replace(/\?\d/g, "?")).all(...a) }) }) }) } };
  const r = Object.fromEntries((await guestData(env, "2026-10-01", "2026-10-31")).map((x) => [x.part, x]));
  expect(r.rucak).toMatchObject({ guests: 10, total: 600 });                  /* menu 10 persons beats 4 couverts */
  expect(r.vecera).toMatchObject({ guests: 1, total: 60, other_n: 1, other: 8 });   /* 2 − 1 storno; the espresso apart */
});

/* Vinska karta i blagajna, 1:1 (owner, 2026-10-14: "precise 1:1 mapping").
   Every till article is mapped once in data/till-map.json; a suggestion
   (`ask`) and an article the map has never seen are listed for Filho and
   counted nowhere, so a guess never reaches "prodano" or "nije se prodalo". */
test("the till map resolves, and only a confirmed article counts", () => {
  const lib = JSON.parse(readFileSync(new URL("../library/wines.json", import.meta.url), "utf8")).wines;
  const map = JSON.parse(readFileSync(new URL("../data/till-map.json", import.meta.url), "utf8")).articles;
  for (const [name, a] of Object.entries(map)) {
    if (a.none) { expect(["nije na karti", "nije vino"]).toContain(a.none); continue; }
    expect(lib[a.ref], name).toBeTruthy();
    expect(a.vol, name).toBeGreaterThan(0);
  }
  /* the cases the old matcher got wrong stay wrong-proof */
  expect(map["Hubert LAMY ST-AUBIN, LES FRI"].ref).toBe("hubert-lamy--saint-aubin-1er-cru-les-frionnes-2023");
  expect(map["LE VOLTE DELL ORNELLAIA 0,75"].none).toBe("nije na karti");
  expect(map["BENVENUTI, MALVAZIJA 0,1L"].vol).toBe(0.1);
  const src = readFileSync(new URL("../js/admin-expenses.js", import.meta.url), "utf8");
  expect(src).toContain("if (!a || a.ask) { ask.push(");
});

/* Marža po vinu (owner, 2026-10-14): supplier line names map to list wines
   in data/buy-map.json, which holds names and sizes only — never a price,
   because the repo is public. A 3 l or a magnum costs more per litre, so the
   cost prefers a purchase in the size the list sells. */
test("the purchase map resolves and carries no prices", () => {
  const lib = JSON.parse(readFileSync(new URL("../library/wines.json", import.meta.url), "utf8")).wines;
  const map = JSON.parse(readFileSync(new URL("../data/buy-map.json", import.meta.url), "utf8")).articles;
  for (const [name, a] of Object.entries(map)) {
    if (a.ref) expect(lib[a.ref], name).toBeTruthy();
    for (const k of Object.keys(a)) expect(["ref", "vol", "none", "why", "ask"], name).toContain(k);
  }
  expect(map["franciacorta brut 3 l"].vol).toBe(3);
  const src = readFileSync(new URL("../js/admin-expenses.js", import.meta.url), "utf8");
  expect(src).toContain("if (!c || (std && !c.std) || (std === c.std && d > c.d)) best.set(a.ref, { perl, d, std });");
});

/* The waiters are compared on our map, not on Remaris' groups (owner,
   2026-10-14: "we will not fix Remaris, just have it and count it right in
   our place"). A Champagne rung up under "Bijela vina DE/AUT" is Champagne,
   a "0,1" article is a glass whatever its group, and an article the map has
   never seen keeps the group rule. Run on SQLite, which is what D1 is. */
test("the waiter categories come from the till map, not the till's groups", () => {
  const till = { articles: {
    "KRUG GRANDE CUVEE": { ref: "krug--grande-cuvee", vol: 0.75 },
    "MALVAZIJA 0,1L": { ref: "benvenuti--malvazija", vol: 0.1 },
    "GIN TONIK": { none: "nije vino", why: "koktel" },
    "KRUG 0,1": { ref: "krug--grande-cuvee", vol: 0.1 },
  } };
  const list = { sections: [
    { id: "glass", categories: [{ id: "champagne", groups: [{ items: [{ ref: "krug--grande-cuvee" }] }] },
      { id: "white", groups: [{ items: [{ ref: "benvenuti--malvazija" }] }] }] },
    { id: "bottle-sparkling", categories: [{ id: "champagne", groups: [{ items: [{ ref: "krug--grande-cuvee" }] }] }] },
  ] };
  const cats = tillCats(till, list);
  expect(cats.sampanjac).toEqual(["KRUG GRANDE CUVEE", "KRUG 0,1"]);   /* a glass of Champagne is Champagne */
  expect(cats.casa).toEqual(["MALVAZIJA 0,1L"]);
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE sales_lines (name TEXT, grp TEXT);
    INSERT INTO sales_lines VALUES ('KRUG GRANDE CUVEE', 'Bijela vina DE/AUT'), ('MALVAZIJA 0,1L', 'Bijela vina HR/SLO'),
      ('GIN TONIK', 'Vina na čaše'), ('NEPOZNATO VINO', 'Pjenušci')`);
  const got = db.prepare(`SELECT name, ${staffCatSql(cats)} AS c FROM sales_lines l`).all();
  expect(Object.fromEntries(got.map((r) => [r.name, r.c]))).toEqual({
    "KRUG GRANDE CUVEE": "sampanjac", "MALVAZIJA 0,1L": "casa", "GIN TONIK": null, "NEPOZNATO VINO": "pjenusac",
  });
});

/* A glass is poured 0,1 l and a bottle gives 6 (owner, 2026-10-14: both
   are true, so a glass costs a sixth of the bottle), and the wrong-group box is gone with the decision not to fix
   Remaris. The price suggestions are a cost target that rises with the
   bottle's cost, and every cost share is coloured against that target. */
test("a glass is 0,1 l, and the price box replaces the group box", () => {
  const src = readFileSync(new URL("../js/admin-expenses.js", import.meta.url), "utf8");
  expect(src).toContain("const GLASS_POUR = 0.1;");
  expect(src).toContain("const GLASSES = 6;");
  expect(src).toContain("costVol(v)");
  expect(src).toContain("COST_TIERS");
  expect(src).toContain("toneOf(p, t)");
  expect(src).not.toContain('box("wrong"');
  expect(src).toContain('box("price"');
  const lib = JSON.parse(readFileSync(new URL("../library/wines.json", import.meta.url), "utf8")).wines;
  expect(lib["weingut-wittmann--riesling-aulerde-gg-2023"]).toBeUndefined();   /* the owner's test wine */
});

/* Tvrtke (owner, 2026-10-14: "proactive approach to companies … custom
   tailored approach for each of these companies when they arrive"): the
   advice comes from the company's own numbers against the house's, and says
   nothing a company's bills do not support. */
test("company advice follows the numbers", () => {
  const house = { wineShare: 0.3, perGuest: 70, rate: { aperitiv: 0.3, sampanjac: 0.1, pjenusac: 0.1, desert: 0.3 } };
  const lost = companyAdvice({ n: 3, days: 3, last: "2026-07-01", virman: 1, size: 10, lunch: 0.2, weekday: "5", wineShare: 0.05, total: 900, rate: {}, topWine: [{ name: "X" }], perGuest: 120, guests: 30, menu: 0 }, house, "2026-10-14");
  expect(lost.join(" ")).toMatch(/Nisu bili 105 dana/);
  expect(lost.join(" ")).toMatch(/virman/);
  expect(lost.join(" ")).toMatch(/grupa \(oko 10 osoba\)/);
  expect(lost.join(" ")).toMatch(/Malo vina/);
  expect(lost.join(" ")).toMatch(/Rijetko aperitiv/);
  expect(lost.join(" ")).toMatch(/Rijetko desert/);
  expect(lost.join(" ")).toMatch(/Filho osobno/);
  /* two big parties are an event, not a regular (owner, on Sintagma Media):
     labelled, never "they stopped coming" */
  const ev = companyAdvice({ n: 2, days: 2, last: "2026-04-13", virman: 1, size: 27, lunch: 0, wineShare: 0.01, total: 5864, rate: {}, topWine: [], perGuest: 109, guests: 54, menu: 0 }, house, "2026-10-14").join(" ");
  expect(ev).toMatch(/Događaj, ne redovit gost/);
  expect(ev).toMatch(/javite se za sljedeći događaj/);
  expect(ev).not.toMatch(/Nisu bili/);
  /* still advised like any company, only labelled (owner: "I like all companies listed") */
  expect(ev).toMatch(/Dolaze kao grupa/);
  /* a group on a set menu has its dessert in the menu */
  expect(companyAdvice({ n: 3, days: 3, last: "2026-10-10", virman: 0, size: 10, lunch: 0.2, wineShare: 0.4, total: 900, rate: { aperitiv: 0.5 }, topWine: [], perGuest: 60, guests: 30, menu: 1 }, house, "2026-10-14").join(" ")).not.toMatch(/desert/);
  /* one visit, nothing unusual: nothing to say */
  expect(companyAdvice({ n: 1, days: 1, last: "2026-10-10", virman: 0, size: 2, lunch: 0, wineShare: 0.3, total: 150, rate: { aperitiv: 0.3, desert: 0.3 }, topWine: [], perGuest: 70, guests: 2, menu: 0 }, house, "2026-10-14")).toEqual([]);
});

/* The Monday letter carries spend per guest beside the average bill
   (owner, 2026-10-14), week against week. */
test("the weekly letter has spend per guest", () => {
  const src = readFileSync(new URL("../web/functions/api/prihodi/tjedan.js", import.meta.url), "utf8");
  expect(src).toContain('line("Po gostu"');
  expect(src).toContain("guestData(env");
});

/* Theatrium's clock (2026-10-15): GitHub's schedule started the 6:10 Remaris
   run at 11:28 and skipped the next morning's entirely, so a Cloudflare Cron
   Trigger dispatches the syncs on the Zagreb hour, summer and winter alike. */
test("the clock: Remaris 6:10 and 16:10, MER 9:10 and 17:10, the report Monday 8:10", async () => {
  /* owner, 2026-10-15: "reliable 2 Remaris per day and 2 MER per day" */
  const { dueAt } = await import("../web/clock/worker.js");
  const at = (iso) => dueAt(new Date(iso));
  expect(at("2026-10-15T04:10:00Z")).toEqual(["remaris-sync.yml"]);   /* 6:10 summer */
  expect(at("2026-11-17T05:10:00Z")).toEqual(["remaris-sync.yml"]);   /* 6:10 winter */
  expect(at("2026-11-17T04:10:00Z")).toEqual([]);                     /* 5:10 winter */
  expect(at("2026-10-15T07:10:00Z")).toEqual(["mer-sync.yml"]);       /* 9:10 */
  expect(at("2026-10-15T14:10:00Z")).toEqual(["remaris-sync.yml"]);   /* 16:10 */
  expect(at("2026-10-15T15:10:00Z")).toEqual(["mer-sync.yml"]);       /* 17:10 */
  expect(at("2026-10-19T06:10:00Z")).toEqual(["weekly-report.yml"]);  /* Monday 8:10 */
  expect(at("2026-10-20T06:10:00Z")).toEqual([]);                     /* Tuesday 8:10 */
  const toml = readFileSync(new URL("../web/clock/wrangler.toml", import.meta.url), "utf8");
  expect(toml).toContain('crons = ["10 * * * *"]');
  expect(readFileSync(new URL("../js/admin-expenses.js", import.meta.url), "utf8")).not.toContain("svako jutro u 6:00");
});

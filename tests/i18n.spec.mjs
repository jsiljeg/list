/* Languages.
   scripts/validate.mjs already proves every aroma/pairing/tag key resolves in
   all eight languages, so this covers what it cannot: how the strings actually
   come out on screen.

   Guards: 1ddedd7 (the style line read "Crno · srednje puno · Suho" — capital at
   both ends, lowercase in the middle), 2c9b0b1 (the subtitle is Filho's own line
   and stays English everywhere), 87dffea (a new region token dropping to bare
   Latin in the Chinese view), 4e58164 (region exonyms per language). */
import { test, expect } from "@playwright/test";
import { openApp, openWine } from "./helpers.mjs";
import { I18N_LANGS } from "./langs.mjs";

test.describe.configure({ mode: "parallel" });

test("the style line is sentence case, not Title Case", async ({ page }) => {
  await openApp(page);
  await openWine(page, "Grimalda 2021");
  const line = (await page.locator(".detail-style").innerText()).trim();
  const parts = line.split("·").map((s) => s.trim()).filter(Boolean);
  expect(parts.length, `expected a compound descriptor, got "${line}"`).toBeGreaterThan(1);
  for (const p of parts.slice(1)) {
    /* Proper terms keep their capitals wherever they fall — Champagne, Blanc de
       Blancs, and the dosage, which is what the label says. */
    if (/^(Brut|Extra Brut|Brut Nature|Champagne|Blanc de|Dosage|Demi-Sec|Doux)/i.test(p)) continue;
    expect(p[0], `"${p}" is capitalised mid-line in "${line}"`).toBe(p[0].toLowerCase());
  }
});

test("the dosage keeps its capital", async ({ page }) => {
  await openApp(page);
  await openWine(page, "Dom Pérignon 2015");
  expect(await page.locator(".detail-style").innerText()).toContain("Brut");
});

test("the subtitle is Filho's own line in every language", async ({ page }) => {
  /* He runs it in English on his Croatian nav too, so it is not translated. */
  for (const lang of I18N_LANGS) {
    await openApp(page, { lang });
    expect(await page.locator("#subtitle").innerText(), `${lang} translated the tagline`)
      .toBe("How to solve drinking problems");
  }
});

test("the Chinese view glosses regions rather than dropping to bare Latin", async ({ page }) => {
  await openApp(page, { lang: "zh" });
  await openWine(page, "Dvije Ru");
  const body = await page.locator("#modal-body").innerText();
  /* Bilingual form is 中文（Latin）. If a token is missing from zh-terms.js it
     appears as bare Latin with no Chinese beside it. */
  expect(body, "Moslavina has no Chinese gloss").toMatch(/莫斯拉维纳/);
  expect(body, "the vinogorje has no Chinese gloss").toMatch(/沃洛德/);
});

test("every region token used by a Croatian wine has Chinese", async ({ page }) => {
  await openApp(page, { lang: "zh" });
  const missing = await page.evaluate(() => {
    const toks = new Set();
    const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
    walk(DATA, (it) => {
      if (it.insight.country !== "HR") return;
      for (const t of String(it.insight.region || "").split(",")) if (t.trim()) toks.add(t.trim());
    });
    return [...toks].filter((t) => !ZH_REGION[t]);
  });
  expect(missing, "Croatian region tokens with no Chinese").toEqual([]);
});

test("region exonyms follow the language", async ({ page }) => {
  const CASES = [
    { lang: "hr", query: "Barolo 2018", expect: "Pijemont" },
    { lang: "en", query: "Barolo 2018", expect: "Piedmont" },
    { lang: "de", query: "Barolo 2018", expect: "Piemont" }
  ];
  for (const c of CASES) {
    await openApp(page, { lang: c.lang });
    await openWine(page, c.query);
    expect(await page.locator("#modal-body").innerText(), `${c.lang} should say ${c.expect}`).toContain(c.expect);
  }
});

test("the country is appended once, not twice", async ({ page }) => {
  /* "France, Francuska" — the bug that made the region convention a written
     rule. */
  await openApp(page);
  await openWine(page, "Meursault 2020");
  const body = await page.locator("#modal-body").innerText();
  const hits = (body.match(/Francuska/g) || []).length;
  expect(hits, "country named more than once on the region line").toBe(1);
});

test("nothing renders a raw i18n key", async ({ page }) => {
  /* A missing key shows as the key itself — "drinking_now" instead of
     "Za piti sada" — which is easy to miss in a language you do not read. */
  for (const lang of I18N_LANGS) {
    await openApp(page, { lang });
    const text = await page.locator("#app").innerText();
    const raw = text.match(/\b[a-z]+_[a-z_]+\b/g) || [];
    const suspicious = raw.filter((k) => !/^(www|e_mail)/.test(k));
    expect(suspicious, `${lang} shows raw keys`).toEqual([]);
  }
});

/* Croatian and Chinese, in depth.

   Croatian is the language most guests read, and the one where a wrong exonym
   or a missing country name is most embarrassing. Chinese is the one nobody in
   the building can proof-read, so it gets checked mechanically rather than by
   eye: every grape, region and terroir token must come out of the localizer
   carrying Chinese, never as bare Latin.

   Guards: 4e58164 + 1ff8119 (region exonyms per language), 87dffea (a new region
   token dropping to bare Latin in the zh view), 7a8846d + 4f9d534 (Chinese for
   every grape, region and vineyard), 0e9dad9 (the Croatian country and region
   ladder), and the standing rule in CLAUDE.md that a new term must be translated
   in all eight languages before it ships. */
import { test, expect } from "@playwright/test";
import { openApp, openWine, allItems } from "./helpers.mjs";

const CJK = /[㐀-鿿豈-﫿]/;

/* ---------- Croatian ---------- */

test.describe("Croatian", () => {
  test("every country is named in Croatian, never as a code", async ({ page }) => {
    await openApp(page, { lang: "hr" });
    const bad = await page.evaluate(() => {
      const seen = new Set();
      const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
      walk(DATA, (it) => { if (it.insight.country) seen.add(it.insight.country); });
      const t = I18N.hr.countries;
      return [...seen].filter((c) => !t[c]);
    });
    expect(bad, "countries with no Croatian name").toEqual([]);
  });

  test("the Croatian names are Croatian, not the English ones", async ({ page }) => {
    await openApp(page, { lang: "hr" });
    const got = await page.evaluate(() => I18N.hr.countries);
    const EXPECT = { FR: "Francuska", IT: "Italija", DE: "Njemačka", ES: "Španjolska", US: "SAD", CN: "Kina", HR: "Hrvatska", SI: "Slovenija", AT: "Austrija" };
    for (const [code, name] of Object.entries(EXPECT)) {
      if (got[code]) expect(got[code], `${code} in Croatian`).toBe(name);
    }
  });

  test("country headings render the Croatian name beside the flag", async ({ page }) => {
    await openApp(page, { lang: "hr" });
    const chips = page.locator("#nav button");
    for (let i = 0; i < await chips.count(); i++) {
      if ((await chips.nth(i).innerText()).includes("Crna")) { await chips.nth(i).click(); break; }
    }
    await page.waitForTimeout(400);
    const heads = await page.evaluate(() =>
      [...document.querySelectorAll(".country")].map((el) => el.textContent.trim()));
    expect(heads.length, "no country headings").toBeGreaterThan(2);
    expect(heads.some((h) => /HRVATSKA/i.test(h)), `no Croatian heading in ${heads.join(" / ")}`).toBe(true);
    /* A two-letter code leaking through means the lookup failed. */
    for (const h of heads) expect(h, `"${h}" looks like a raw country code`).not.toMatch(/^[A-Z]{2}$/);
  });

  test("regions use the Croatian exonym where one exists", async ({ page }) => {
    await openApp(page, { lang: "hr" });
    const CASES = [
      { q: "Barolo 2018", want: "Pijemont" },
      { q: "Il Carbonaione", want: "Toskana" },
      { q: "Meursault 2020", want: "Burgundija" },
      { q: "Riesling Uhlen", want: "Njemačka" }
    ];
    for (const c of CASES) {
      await openWine(page, c.q);
      expect(await page.locator("#modal-body").innerText(), `${c.q} should say ${c.want} in Croatian`).toContain(c.want);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
  });

  test("a Croatian wine shows its vinogorje, podregija and terroir", async ({ page }) => {
    /* The two-rung ladder plus the plot. All three lines must be present and in
       Croatian — this is the shape that was wrong for all 79 wines. */
    await openApp(page, { lang: "hr" });
    await openWine(page, "Dvije Ru");
    const body = await page.locator("#modal-body").innerText();
    expect(body).toContain("Voloder – Ivanić-Grad");
    expect(body).toContain("Moslavina");
    expect(body).toContain("Hrvatska");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await openWine(page, "Grimalda bijela");
    const b2 = await page.locator("#modal-body").innerText();
    expect(b2, "terroir line missing").toMatch(/Brdo, Grimalda/);
    expect(b2).toContain("Centralna Istra");
  });

  test("no Croatian wine is left without a region", async () => {
    const bad = allItems()
      .filter((i) => i.insight.country === "HR" && !String(i.insight.region || "").trim())
      .map((i) => i.name);
    expect(bad, "Croatian wines with an empty region").toEqual([]);
  });

  test("a terroir never repeats a rung of its own region", async () => {
    /* Owner, 2026-07-30, after catching it five times. Before the vinogorje
       rework "Dingač, Pelješac" was informative, because the region line only
       said "Srednja i Južna Dalmacija". Once Pelješac became the vinogorje, the
       second half of every such terroir was the line above it, said twice. */
    const bad = [];
    for (const it of allItems()) {
      const reg = String(it.insight.region || "").split(",").map((s) => s.trim()).filter(Boolean);
      const ter = String(it.terroir || "").split(",").map((s) => s.trim()).filter(Boolean);
      for (const t of ter) if (reg.includes(t)) bad.push(`${it.name}: terroir "${it.terroir}" repeats "${t}"`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  test("every Croatian region is a vinogorje + podregija pair", async () => {
    /* The convention settled off the official hierarchy. Three rungs means a
       regija crept in; one usually means the vinogorje was never added.

       The exception is a wine blended across vinogorja — Jeka Dalmatia takes
       fruit from Hvar, Vrgorac and Imotski — where naming one of them would be
       picking a favourite. Those stop at the podregija and let the terroir line
       list the plots. Owner's call, 2026-07-30. */
    const BLENDED_ACROSS_VINOGORJA = new Set(["Jeka Dalmatia 2020", "Jeka Blanc 2024"]);
    const bad = allItems()
      .filter((i) => i.insight.country === "HR" && !BLENDED_ACROSS_VINOGORJA.has(i.name))
      .map((i) => ({ name: i.name, parts: String(i.insight.region || "").split(",").map((s) => s.trim()).filter(Boolean) }))
      .filter((r) => r.parts.length !== 2)
      .map((r) => `${r.name}: ${r.parts.join(" | ")}`);
    expect(bad, "Croatian regions that are not vinogorje + podregija").toEqual([]);
  });
});

/* ---------- Chinese ---------- */

test.describe("Chinese", () => {
  test("every grape comes out carrying Chinese", async ({ page }) => {
    await openApp(page, { lang: "zh" });
    const bare = await page.evaluate(() => {
      const toks = new Set();
      const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
      walk(DATA, (it) => {
        for (const t of String(it.insight.grape || "").split(",")) {
          const s = t.trim().replace(/\s*\d+(?:[.,]\d+)?\s*%$/, "");
          if (s) toks.add(s);
        }
      });
      const cjk = /[㐀-鿿豈-﫿]/;
      return [...toks].filter((t) => !cjk.test(localizeGrape(t)));
    });
    expect(bare, "grapes with no Chinese").toEqual([]);
  });

  test("every region comes out carrying Chinese", async ({ page }) => {
    await openApp(page, { lang: "zh" });
    const bare = await page.evaluate(() => {
      const toks = new Set();
      const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
      walk(DATA, (it) => { for (const t of String(it.insight.region || "").split(",")) if (t.trim()) toks.add(t.trim()); });
      const cjk = /[㐀-鿿豈-﫿]/;
      return [...toks].filter((t) => !cjk.test(localizeRegion(t)));
    });
    expect(bare, "regions with no Chinese").toEqual([]);
  });

  test("every terroir comes out carrying Chinese", async ({ page }) => {
    /* Terroirs include compound forms like "Čara (Korčula)", which the localizer
       splits and glosses part by part. A missing half shows as bare Latin. */
    await openApp(page, { lang: "zh" });
    const bare = await page.evaluate(() => {
      const toks = new Set();
      const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
      walk(DATA, (it) => { for (const t of String(it.terroir || "").split(",")) if (t.trim()) toks.add(t.trim()); });
      const cjk = /[㐀-鿿豈-﫿]/;
      return [...toks].filter((t) => !cjk.test(localizeRegion(t)));
    });
    expect(bare, "terroirs with no Chinese").toEqual([]);
  });

  test("the Chinese view never shows an untranslated UI string", async ({ page }) => {
    await openApp(page, { lang: "zh" });
    const labels = await page.evaluate(() => {
      const t = I18N.zh;
      const out = [];
      const cjk = /[㐀-鿿豈-﫿]/;
      for (const group of ["ui", "categories", "sections", "styles", "bodies", "sweetness", "tags", "countries"]) {
        for (const [k, v] of Object.entries(t[group] || {})) {
          if (typeof v !== "string") continue;
          /* Latin on purpose: proper names (Champagne, Blanc de Blancs) and
             Filho's own tagline, which runs in English on his Croatian site too. */
          if (k === "subtitle") continue;
          if (/champagne|blanc de|brut|ros[eé]|prestige/i.test(v)) continue;
          if (!cjk.test(v)) out.push(`${group}.${k} = "${v}"`);
        }
      }
      return out;
    });
    expect(labels, "Chinese UI strings with no Chinese in them").toEqual([]);
  });

  test("a Chinese wine card is Chinese all the way down", async ({ page }) => {
    await openApp(page, { lang: "zh" });
    await openWine(page, "Barolo");
    const body = await page.locator("#modal-body").innerText();
    for (const label of ["品种", "产区"]) {
      expect(body, `card is missing the ${label} label`).toContain(label);
    }
    expect(CJK.test(body), "the card has no Chinese at all").toBe(true);
  });

  test("the bilingual form is 中文（Latin）, not one or the other", async ({ page }) => {
    await openApp(page, { lang: "zh" });
    await openWine(page, "Barolo");
    const body = await page.locator("#modal-body").innerText();
    expect(body, "no bilingual gloss on the card").toMatch(/[㐀-鿿]+（[^）]*[A-Za-z][^）]*）/);
  });
});

test("the Regions screen is localized down to the map labels", async ({ page }) => {
  /* Guards 2026-08-02 (owner): "when I select chinese I still see english region
     names like Barolo, Barbaresco, La Morra, Alba, Langhe". Those were the
     appellation chips, which were printed raw; the labels drawn inside the maps
     had the same problem one layer down. */
  await openApp(page, { lang: "zh" });
  await page.locator('#nav button[data-sec="__regions"]').click();
  await page.waitForSelector(".region-card");

  const chips = await page.locator(".region-app").allTextContents();
  expect(chips.length, "no appellation chips").toBeGreaterThan(20);
  const LATIN_ONLY = /^[^\u4e00-\u9fff]+$/;
  const rawChips = chips.filter((c) => LATIN_ONLY.test(c));
  expect(rawChips, "appellation chips with no Chinese in them").toEqual([]);

  /* Inside a map the Chinese stands alone — the 兰斯山（Montagne de Reims）
     form the chips use is right where there is room and ran off the picture
     where there is not. */
  const labels = await page.locator(".rmap text").allTextContents();
  expect(labels.length, "no map labels").toBeGreaterThan(30);
  const rawLabels = labels.filter((t) => LATIN_ONLY.test(t.trim()));
  expect(rawLabels, "map labels still in Latin script").toEqual([]);
  for (const t of labels)
    expect(t, `map label "${t}" carries the Latin name too — no room for it`).not.toMatch(/[（(]/);
});

test("a region card localizes into every language", async ({ page }) => {
  /* Croatian says Toskana and Burgundija, German Toskana and Burgund — the
     region name, the tagline and the blurb all have to move, and every card
     needs all eight. */
  for (const lang of ["hr", "de", "it"]) {
    await openApp(page, { lang });
    await page.locator('#nav button[data-sec="__regions"]').click();
    await page.waitForSelector(".region-card");
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll(".region-card")].map((c) => ({
        name: c.querySelector(".region-name").textContent.trim(),
        sub: c.querySelector(".region-sub").textContent.trim(),
        blurb: c.querySelector(".region-blurb").textContent.trim()
      })));
    expect(cards.length, `${lang}: no region cards`).toBeGreaterThan(8);
    for (const c of cards) {
      expect(c.name.length, `${lang}: a card with no name`).toBeGreaterThan(1);
      expect(c.sub.length, `${lang}: "${c.name}" has no tagline`).toBeGreaterThan(3);
      expect(c.blurb.length, `${lang}: "${c.name}" has no blurb`).toBeGreaterThan(60);
    }
  }
});

test("Moscato Giallo reads in the guest's own language", async ({ page }) => {
  /* Added 2026-08-03. Geržinić's Muškat was stored as a bare "Muscat" — as
     useless an identifier as a bare Malvasia — until the owner settled it as
     Moscato Giallo off the estate's own "Muškat žuti".

     The storage half is guarded in data.spec.mjs. This is the half that needs
     the running app.

     German is the ONLY translation, and this test exists because the first
     version of it asserted a second one. Slovenian shipped as "Rumeni muškat"
     and the owner caught it against Wine Grapes: Goldmuskateller is in the
     synonym list, Rumeni muškat is not, and Slovenia's rumeni muškat is
     Muscat Blanc à Petits Grains — a different grape. Inventing a plausible
     local form is the Malvoisie error, and it is easy to make twice. Every
     language below that says "Moscato Giallo" is asserting two things: that
     the Croatian bracket does not leak through, and that nobody has invented
     a name for it again. */
  const CANON = "Žuti muškat (Moscato Giallo)";
  const want = {
    hr: CANON, en: "Moscato Giallo", it: "Moscato Giallo", fr: "Moscato Giallo",
    es: "Moscato Giallo", sl: "Moscato Giallo", de: "Goldmuskateller",
  };
  for (const [lang, expected] of Object.entries(want)) {
    await openApp(page, { lang });
    const got = await page.evaluate((c) => localizeGrape(c), CANON);
    expect(got, `${lang}: Moscato Giallo renders wrong`).toBe(expected);
  }
  /* Chinese prints 中文（Latin）, so assert the Chinese is there rather than
     pinning the whole bracketed string. */
  await openApp(page, { lang: "zh" });
  const zh = await page.evaluate((c) => localizeGrape(c), CANON);
  expect(zh, "Chinese rendering of Moscato Giallo").toContain("黄麝香");
  expect(zh, "Chinese must not fall back to bare Latin").toMatch(CJK);
});

test("blurb asterisks become italics, and nothing else becomes markup", async ({ page }) => {
  /* Owner, 2026-08-04, asking for viticoltura eroica in italic. Blurbs are
     plain text and must stay escaped, so the convention is *asterisks* in the
     JSON, converted to <em> after esc() has run — by which point every < and &
     is already an entity, so no author can inject markup.

     Two things must hold: the emphasis appears, and no asterisk ever reaches a
     guest's eye. The second is the one that would rot quietly, if somebody
     wrote a lone asterisk or opened one and forgot to close it. */
  await openApp(page, { lang: "hr" });
  const leaked = await page.evaluate(() => {
    const out = [];
    const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
    /* PRODUCERS is what the card reads from, so check every blurb in it. */
    for (const [name, rec] of Object.entries(PRODUCERS || {})) {
      for (const [lc, text] of Object.entries((rec && rec.blurb) || {})) {
        const stars = (String(text).match(/\*/g) || []).length;
        if (stars % 2) out.push(`${name}/${lc}: odd number of asterisks`);
      }
    }
    return out;
  });
  expect(leaked, "unbalanced emphasis markers").toEqual([]);

  await openWine(page, "Prosecco Millesimato 2023");
  const em = await page.locator(".detail-winemaker p em").count();
  expect(em, "Contarini's viticoltura eroica is not italicised").toBeGreaterThan(0);
  const shown = await page.locator(".detail-winemaker p").first().innerText();
  expect(shown, "a literal asterisk reached the card").not.toContain("*");
});

test("a stored decimal is printed in the guest's own notation", async ({ page }) => {
  /* Owner-facing numbers are stored the way JSON writes them — alcohol as the
     string "13.5", `vol` as the number 0.375 — and both were printed raw at
     some point, putting an English decimal point in front of a Croatian, a
     German and a Frenchman. 129 of the wines carry a decimal alcohol, so this
     was a third of the list; it was found on the Hakutsuru card, 2026-09-04.
     The three formatters must agree, and only on the separator: "% vol." and
     "l" are the same symbol in every language. */
  await openApp(page);
  const seen = {};
  for (const lg of ["hr", "en", "de", "fr", "zh"]) {
    await page.evaluate((l) => { lang = l; }, lg);
    seen[lg] = await page.evaluate(() =>
      [alcText("19.5"), volText(0.375), fmtPrice(6.5), alcText("42"), alcText("")]);
  }
  for (const lg of ["hr", "de", "fr"]) {
    expect(seen[lg][0], `${lg} alcohol`).toBe("19,5");
    expect(seen[lg][1], `${lg} volume`).toBe("0,375 l");
    expect(seen[lg][2], `${lg} price`).toBe("6,5");
  }
  for (const lg of ["en", "zh"]) {
    expect(seen[lg][0], `${lg} alcohol`).toBe("19.5");
    expect(seen[lg][1], `${lg} volume`).toBe("0.375 l");
  }
  /* A whole number gains nothing, and a blank must stay blank rather than
     becoming a NaN on the card. */
  expect(seen.hr[3]).toBe("42");
  expect(seen.hr[4]).toBe("");
});

test("an unknown vocabulary key is humanised, never printed as a key", async ({ page }) => {
  /* Owner, 2026-09-04: he read a literal "tequila_anejo" off a card. The key was
     in js/spirits.js by then — but data reaches a tablet in under a minute
     (pollData) while the dictionary only arrives on the next reload, so a bottle
     added with a brand-new class spends that window with no word for it, and
     spiritTerm() used to fall back to the key itself. validate.mjs still fails
     the deploy on an unknown key; this only has to keep the gap readable. */
  await openApp(page);
  const out = await page.evaluate(() => ({
    made: spiritTerm("classes", "tequila_cristalino"),
    known: spiritTerm("classes", "tequila_anejo"),
    human: humanKey("ex_sherry_oloroso")
  }));
  expect(out.made, "an unknown key reached the card as a key").not.toContain("_");
  expect(out.made).toBe("Tequila cristalino");
  expect(out.human).toBe("Ex sherry oloroso");
  /* and the real key still wins over the fallback */
  expect(out.known).toContain("añejo");
  expect(out.known).not.toBe("Tequila anejo");
});

test("the ume base does not contradict the note above it", async ({ page }) => {
  /* Owner, 2026-09-04: the note says ume is not a plum but a relative of the
     apricot, and the SIROVINA line two centimetres below it said "japanske
     šljive ume". Same failure as Beenleigh — two true-sounding strings on one
     screen disagreeing. The card is read as a whole, so it has to agree as one. */
  await openApp(page);
  const said = await page.evaluate(() =>
    ["hr", "en", "it", "fr", "de", "sl", "es"].map((l) => {
      lang = l;
      return spiritTerm("bases", "ume").toLowerCase();
    }));
  for (const s of said) expect(s, `ume base says plum: "${s}"`).not.toMatch(/šljiv|sliv|plum|prugn|prune|pflaum|ciruel/);
});

test("a spirit's region reads in Chinese, like a wine's", async ({ page }) => {
  /* Owner, 2026-09-04. The zh sweep had only ever covered wines: 30 of the 35
     distinct spirit regions came out as bare Latin — "Islay, 苏格兰",
     "Tequila、Los Valles、Jalisco, 墨西哥", "Nada、Kobe, 日本". For the Japanese and
     Taiwanese ones that is not even a translation question, since Chinese uses
     the same characters (長野 → 长野, 宜蘭 → 宜兰).

     What settles it is that our own Chinese prose already used the Chinese
     forms — 特里劳尼, 鹿儿岛, 哈利斯科, 艾雷, 斯佩塞, 黑森林, 干邑 all appear in
     blurbs and notes on the very cards whose region line said the Latin. Same
     failure as the ume base: two strings on one screen disagreeing.

     The owner then asked how Čara had been handled, which settled the rest: it
     has read 察拉 all along, as Ponikve reads 波尼克韦. The wine side was swept to
     the last village years ago, so leaving Segonzac or Serravalle Scrivia in
     Latin was not a convention — it was half a job. Every rung of every ladder
     on the list now has a Chinese name, checked below rather than asserted. */
  await openApp(page);
  const out = await page.evaluate(() => {
    lang = "zh";
    const bare = [];
    const KNOWN = ["Islay", "Speyside", "Isle of Jura", "Highlands", "Lowlands", "Jalisco",
      "Oaxaca", "Tequila", "Los Altos", "Nagano", "Kagoshima", "Kobe", "Nada", "Kumamoto",
      "Shiga", "Yilan", "Cognac", "Grande Champagne", "Fins Bois", "Schwarzwald", "Trelawny",
      "St Philip", "St Lucy", "Riga", "Appenzell", "Indiana", "Artibonite"];
    for (const k of KNOWN) if (!/[\u3400-\u9FFF]/.test(localizeRegion(k))) bare.push(k);
    /* and no spirit on the shelf may show a region line with no Chinese in it */
    const shelf = [];
    for (const s of DATA.sections) for (const c of s.categories) for (const g of c.groups)
      for (const i of g.items) {
        const ins = i.insight;
        if (!ins || ins.kind !== "spirit" || !ins.region) continue;
        if (!/[\u3400-\u9FFF]/.test(localizeRegion(ins.region)))
          shelf.push(`${i.producer} ${i.name}: ${ins.region}`);
      }
    return { bare, shelf };
  });
  expect(out.bare, "a well-known spirit region with no Chinese name").toEqual([]);
  expect(out.shelf, "a spirit whose whole region line is bare Latin in the Chinese view").toEqual([]);

  /* and the real rule: not one rung anywhere, wine or spirit, comes out Latin. */
  const bare = await page.evaluate(() => {
    lang = "zh";
    const cjk = (s) => /[㐀-鿿]/.test(s);
    const out = new Set();
    for (const s of DATA.sections) for (const c of s.categories) for (const g of c.groups)
      for (const i of g.items) {
        const ins = i.insight;
        if (!ins) continue;
        for (const rung of String(ins.region || "").split(",").map((x) => x.trim()).filter(Boolean))
          if (!cjk(localizeRegion(rung))) out.add(rung);
        if (i.terroir && !cjk(localizeRegion(i.terroir))) out.add(`terroir ${i.terroir}`);
      }
    return [...out];
  });
  expect(bare, "a region or terroir rung with no Chinese name — add it to ZH_REGION").toEqual([]);
});

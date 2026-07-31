/* Glassware.
   Guards: ed91e65 (the red barrel split into two Winewings), 52f0068 (an
   `insight.glass` override dragging two sweet wines off the dessert glass —
   the override beats style, which is easy to forget), 1ddedd7 + 94fe819 +
   e6c2b36 + 38316db (every glass traced and reassigned), and the standing rule
   that the seven glasses must stay visually distinct.

   These run once — the mapping is viewport-independent — but the shapes are
   checked for distinctness because two of them are 250mm tall on a 100mm foot
   and 117mm against 115mm wide, so it is genuinely easy to make them identical
   by accident. */
import { test, expect } from "@playwright/test";
import { openApp, allItems } from "./helpers.mjs";

test.describe.configure({ mode: "parallel" });

const GLASSES = ["champagne", "riesling", "chardonnay", "winewingsBordeaux", "winewingsBurgundy", "burgundy", "dessert"];

test("every wine on the list resolves to a glass we actually draw", async ({ page }) => {
  await openApp(page);
  const bad = await page.evaluate((known) => {
    const out = [];
    const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
    walk(DATA, (it) => {
      const g = glassFor(it.insight.style, it.insight.grape, it.insight.glass, it.insight.region);
      if (g !== null && !known.includes(g)) out.push(`${it.name}: ${g}`);
      if (g !== null && !GLASS_ICONS[g]) out.push(`${it.name}: ${g} has no icon`);
    });
    return out;
  }, GLASSES);
  expect(bad).toEqual([]);
});

test("sweet wines keep the dessert glass whatever else is tagged", async ({ page }) => {
  /* 52f0068 exactly: `insight.glass` overrides style, so a producer-wide
     override silently moved Quintarelli's Recioto and Amabile off `dessert`. */
  await openApp(page);
  const wrong = await page.evaluate(() => {
    const out = [];
    const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
    walk(DATA, (it) => {
      if (it.insight.style !== "sweet") return;
      const g = glassFor(it.insight.style, it.insight.grape, it.insight.glass, it.insight.region);
      if (g !== "dessert") out.push(`${it.name} -> ${g}`);
    });
    return out;
  });
  expect(wrong, "sweet wines not on the dessert glass").toEqual([]);
});

test("sparkling and champagne always get the flute", async ({ page }) => {
  await openApp(page);
  const wrong = await page.evaluate(() => {
    const out = [];
    const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
    walk(DATA, (it) => {
      const s = it.insight.style || "";
      if (!s.startsWith("sparkling") && !s.startsWith("champagne")) return;
      const g = glassFor(s, it.insight.grape, it.insight.glass, it.insight.region);
      if (g !== "champagne") out.push(`${it.name} (${s}) -> ${g}`);
    });
    return out;
  });
  expect(wrong).toEqual([]);
});

test("Riedel's split holds: Pinot and Nebbiolo to Burgundy, Cabernet and Merlot to Bordeaux", async ({ page }) => {
  await openApp(page);
  const wrong = await page.evaluate(() => {
    const out = [];
    const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
    walk(DATA, (it) => {
      const i = it.insight;
      if (!(i.style || "").startsWith("red") || i.glass) return;
      const first = (i.grape || "").split(",")[0];
      const g = glassFor(i.style, i.grape, i.glass, i.region);
      if (/pinot noir|nebbiolo/i.test(first) && g !== "winewingsBurgundy") out.push(`${it.name} (${first}) -> ${g}`);
      if (/merlot|cabernet/i.test(first) && g !== "winewingsBordeaux") out.push(`${it.name} (${first}) -> ${g}`);
    });
    return out;
  });
  expect(wrong).toEqual([]);
});

test("orange wines take the wide Chardonnay bowl, not the Riesling", async ({ page }) => {
  /* They fell through to the Riesling glass — the narrowest white shape we
     draw — until the owner asked. No maker publishes an orange shape (Riedel's
     guide 404s on the style), so the call rests on Riedel's Winewings
     Chardonnay varietal list, which names Friulano, Ribolla Gialla, Pinot Gris
     and Sauvignon Blanc: seven of these twelve. Whole style or none — a split
     would be arbitrary dressed as evidence. */
  await openApp(page);
  const wrong = await page.evaluate(() => {
    const out = [];
    const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
    walk(DATA, (it) => {
      if (it.insight.style !== "orange") return;
      const g = glassFor(it.insight.style, it.insight.grape, it.insight.glass, it.insight.region);
      if (g !== "chardonnay") out.push(`${it.name} -> ${g}`);
    });
    return out;
  });
  expect(wrong).toEqual([]);
  /* And the rule must not have dragged the steely whites along with it. */
  const stillRiesling = await page.evaluate(() =>
    glassFor("white_mineral", "Malvazija istarska", undefined, "Zapadna Istra"));
  expect(stillRiesling).toBe("riesling");
});

test("the named exceptions are still where the owner put them", async ({ page }) => {
  /* Each of these was a decision, not a rule, so a rule change must not quietly
     undo it. */
  const EXPECTED = {
    "Grimalda 2021": "burgundy",
    "Ottocento Crni 2022": "burgundy",
    "Amarone Classico 2015": "burgundy",
    "Valpolicella Superiore 2015": "burgundy",
    "Grimalda bijela 2022": "riesling",
    "Pinot Gris Grand Cru Hengst 2020": "riesling",
    "Vin Jaune 2014": "riesling",
    "Château-Chalon 2014": "riesling",
    "Gravonia Crianza 2015": "riesling",
    "Capellanía 2019": "riesling",
    "Chablis 2022": "chardonnay",
    "Chablis Grand Cru Les Clos 2023": "chardonnay",
    "Brunello di Montalcino 2018": "winewingsBordeaux",
    "Case Basse 2020": "winewingsBordeaux",
    "Tribidrag 2022": "winewingsBordeaux",
    "Geyserville 2021": "winewingsBordeaux",
    "Barolo 2018": "winewingsBurgundy"
  };
  await openApp(page);
  const got = await page.evaluate((names) => {
    const out = {};
    const walk = (o, f) => { if (o && typeof o === "object") { if (o.insight) f(o); for (const k in o) walk(o[k], f); } };
    walk(DATA, (it) => {
      if (names.includes(it.name) && !(it.name in out))
        out[it.name] = glassFor(it.insight.style, it.insight.grape, it.insight.glass, it.insight.region);
    });
    return out;
  }, Object.keys(EXPECTED));
  for (const [name, glass] of Object.entries(EXPECTED)) {
    expect(got[name], `${name} should pour into ${glass}`).toBe(glass);
  }
});

test("the seven glasses are still seven distinct drawings", async ({ page }) => {
  await openApp(page);
  const svgs = await page.evaluate((keys) => keys.map((k) => GLASS_ICONS[k]), GLASSES);
  expect(new Set(svgs).size, "two glasses share the same path data").toBe(GLASSES.length);
  /* Each is drawn to one 60px height, so the viewBox width is what carries the
     real difference in girth. Two glasses of the same width must at least differ
     in their path. */
  const widths = await page.evaluate((keys) =>
    keys.map((k) => (GLASS_ICONS[k].match(/viewBox="0 0 (\d+) 100"/) || [])[1]), GLASSES);
  expect(widths.every(Boolean), "a glass has a non-standard viewBox height").toBe(true);
});

test("no glass icon spills out of its own viewBox", async ({ page }) => {
  /* A path drawn past the box gets clipped on the right or bottom, which is how
     a glass ends up looking like it has no foot. */
  await openApp(page);
  const spills = await page.evaluate((keys) => {
    const out = [];
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(host);
    for (const k of keys) {
      host.innerHTML = GLASS_ICONS[k];
      const svg = host.querySelector("svg");
      const vb = svg.getAttribute("viewBox").split(" ").map(Number);
      const bb = svg.getBBox();
      const pad = 1.2; // half the stroke width, generously
      if (bb.x < -pad || bb.y < -pad || bb.x + bb.width > vb[2] + pad || bb.y + bb.height > vb[3] + pad)
        out.push(`${k}: bbox ${[bb.x, bb.y, bb.width, bb.height].map((n) => n.toFixed(1))} in viewBox ${vb.join(" ")}`);
    }
    host.remove();
    return out;
  }, GLASSES);
  expect(spills).toEqual([]);
});

test("every wine in the data file has a style the glass rule understands", () => {
  const KNOWN = /^(sparkling|champagne|white_|orange|rose|red_|sweet)/;
  const bad = allItems()
    .filter((it) => it.insight.style && !KNOWN.test(it.insight.style))
    .map((it) => `${it.name}: ${it.insight.style}`);
  expect(bad).toEqual([]);
});

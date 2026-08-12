/* Page layout and assets.
   Guards: 92c6cbd (the footer floating mid-screen on a category too short to
   fill a tall tablet), 9d93aeb (the flag failing to parse and every flag
   rendering 0x0 — silently, with no console error), 860bc14 (the face fetched
   at the language tap instead of at page load, so the splash landed bare),
   de06836 (two badges must fit one row on a narrow screen), 4d19d29 (the card
   ending where its text ends). */
import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openApp, expectClean, pickSection, openWine, box } from "./helpers.mjs";

/* import.meta.dirname needs Node 20.11; this works everywhere. */
const HERE = dirname(fileURLToPath(import.meta.url));

test("the footer sits at the foot of the screen on a short category", async ({ page }) => {
  await openApp(page);
  await pickSection(page, "Ros");
  const gap = await page.evaluate(() =>
    Math.round(window.innerHeight - document.querySelector(".footer").getBoundingClientRect().bottom));
  /* Negative means the footer is below the fold, which is right for a long list.
     A large positive gap is the bug: the footer floating in the middle with the
     background below it. */
  expect(gap, "empty space under the footer").toBeLessThan(8);
});

test("the footer is below the fold on a long category", async ({ page }) => {
  await openApp(page);
  await pickSection(page, "Crna");
  const gap = await page.evaluate(() =>
    Math.round(window.innerHeight - document.querySelector(".footer").getBoundingClientRect().bottom));
  expect(gap).toBeLessThan(0);
});

test("the page never scrolls sideways", async ({ page }) => {
  await openApp(page);
  for (const cat of ["Crna", "Bijela", "Ros"]) {
    await pickSection(page, cat);
    const wide = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(wide, `${cat} makes the page wider than the viewport`).toBe(false);
  }
});

test("the header stays put while the list scrolls", async ({ page }) => {
  await openApp(page);
  await pickSection(page, "Crna");
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(200);
  const top = await page.evaluate(() => Math.round(document.querySelector(".header").getBoundingClientRect().top));
  expect(top, "header scrolled away").toBe(0);
});

test("the Croatian flag actually renders", async ({ page }) => {
  /* The official artwork uses <use xlink:href="#lion">. Without xmlns:xlink on
     the root the file fails to parse, every flag comes back 0x0, and there is no
     console error to notice — just broken-image icons. */
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForTimeout(400);
  const flags = await page.evaluate(() =>
    [...document.querySelectorAll(".flag-img")].map((i) => ({
      w: i.naturalWidth, h: i.naturalHeight, shown: Math.round(i.getBoundingClientRect().width)
    })));
  expect(flags.length, "no Croatian flag on the language screen").toBeGreaterThan(0);
  for (const f of flags) {
    expect(f.w, `flag decoded as ${f.w}x${f.h}`).toBe(60);
    expect(f.h).toBe(40);
    expect(f.shown, "flag rendered at zero width").toBeGreaterThan(10);
  }
});

test("every language button has a flag of the same size", async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForTimeout(300);
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll("#lang-buttons button")].map((b) => {
      const g = b.querySelector("svg, .flag-img");
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    }));
  expect(sizes.includes(null), "a language button has no flag").toBe(false);
  expect(new Set(sizes).size, `flags are different sizes: ${sizes.join(" ")}`).toBe(1);
});

test("the nail face is fetched at page load, not at the language tap", async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.waitForTimeout(900);
  const hit = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .filter((r) => r.name.includes("atrium-face"))
      .map((r) => ({ init: r.initiatorType, end: Math.round(r.responseEnd) })));
  expect(hit.length, "face not requested before the language screen was answered").toBe(1);
  expect(hit[0].init, "face is not coming from the preload link").toBe("link");
});

test("two badges fit one row on the narrowest screen", async ({ page }) => {
  /* de06836. Wines carrying both "Izvrsna berba" and "Rijetka boca" wrapped. */
  test.skip(page.viewportSize().width > 420, "narrow screens only");
  await openApp(page);
  await page.locator("#search-toggle").click();
  await page.fill("#search", "Yquem");
  await page.waitForTimeout(400);
  await page.locator(".item").first().click();
  await page.waitForTimeout(300);
  const rows = await page.evaluate(() => {
    const tags = [...document.querySelectorAll(".detail-tags .wine-tag")];
    return new Set(tags.map((t) => Math.round(t.getBoundingClientRect().top))).size;
  });
  if (rows > 0) expect(rows, "badges wrapped onto more than one row").toBeLessThanOrEqual(1);
});

test("no request 404s anywhere in a normal walk through the app", async ({ page }) => {
  const bag = await openApp(page);
  for (const cat of ["Bijela", "Crna", "Ros", "Deser"]) await pickSection(page, cat);
  await page.locator("#search-toggle").click();
  await page.fill("#search", "Barolo");
  await page.waitForTimeout(400);
  await page.locator(".item").first().click();
  await page.waitForTimeout(400);
  expectClean(bag);
});

test("every file referenced by the page exists", async ({ page, request }) => {
  await openApp(page);
  const refs = await page.evaluate(() => {
    const out = new Set();
    for (const el of document.querySelectorAll("[src], link[href]")) {
      const v = el.getAttribute("src") || el.getAttribute("href");
      if (v && !/^(https?:|data:|#)/.test(v)) out.add(v);
    }
    return [...out];
  });
  expect(refs.length).toBeGreaterThan(3);
  for (const r of refs) {
    const res = await request.get(new URL(r, "http://127.0.0.1:4173/").pathname);
    expect(res.status(), `${r} is missing`).toBe(200);
  }
});

test("no asset in assets/ has been left behind unreferenced", () => {
  /* Tidiness rather than a bug guard, but it is the check that would have caught
     assets/atrium-bowl.webp rotting in the repo after the mark was removed. */
  const ROOT = resolve(HERE, "..");
  const sources = ["index.html", "qr.html", "css/style.css", "js/app.js", "manifest.webmanifest", "sw.js"]
    .map((f) => { try { return readFileSync(resolve(ROOT, f), "utf8"); } catch { return ""; } })
    .join(" ");
  /* The QR files are print deliverables — qr.html embeds the png and the svg is
     what goes to a printer — so they are referenced by intent even when a grep
     of the app does not find them. */
  const KEEP = new Set(["qr.png", "qr.svg"]);
  const orphans = readdirSync(resolve(ROOT, "assets")).filter((f) => !KEEP.has(f) && !sources.includes(f));
  expect(orphans, "unreferenced files in assets/").toEqual([]);
});

test("the face is already loaded by the time the story splash appears", async ({ page }) => {
  /* Owner-reported: the face used to arrive a beat late and read as a glitch.
     The preload link is only half the fix — what matters is that the fetch has
     *finished* before the splash is on screen, so this compares timestamps
     rather than trusting the link tag. */
  await page.goto("/index.html", { waitUntil: "load" });
  await page.evaluate(() => localStorage.removeItem("theatrium-lang"));
  await page.reload({ waitUntil: "load" });
  await page.locator("#lang-buttons button").first().click();
  await expect(page.locator("#story-screen")).toBeVisible();
  const shownAt = await page.evaluate(() => performance.now());
  const face = await page.evaluate(() =>
    performance.getEntriesByType("resource").find((r) => r.name.includes("atrium-face")));
  expect(face, "the face was never requested").toBeTruthy();
  expect(face.responseEnd, "the face was still downloading when the splash appeared")
    .toBeLessThan(shownAt);
  /* And it is actually the background of the splash, not just a warm cache. */
  const bg = await page.evaluate(() =>
    getComputedStyle(document.getElementById("story-screen"), "::before").backgroundImage);
  expect(bg, "the splash has no face behind it").toContain("atrium-face");
});

test("the face is decoded before the language is picked, not at the tap", async ({ page }) => {
  /* Round two on this asset (owner, 2026-08-04 — reported twice).

     The test above guards the *download*: the bytes are preloaded and land
     around 200 ms. That was the round-one fix, and it is not enough. The face
     is a background on `.story-screen::before`, which is display:none until a
     language is picked, so the browser has no reason to rasterise the
     1084x811 bitmap until that moment — and on a phone's CPU the decode is
     long enough to watch. Preloading bytes never implied a decoded image.

     app.js therefore calls primeFace() from showStart(). Both halves are
     asserted: that the decode was kicked off while the guest was still on the
     language screen, and that a fresh decode of the same URL then resolves
     immediately, which it only can if the raster is already cached. */
  await page.goto("/index.html", { waitUntil: "load" });
  await page.evaluate(() => localStorage.removeItem("theatrium-lang"));
  await page.reload({ waitUntil: "load" });
  await expect(page.locator("#lang-buttons button").first()).toBeVisible();

  const primed = await page.evaluate(() => typeof facePrimed !== "undefined" && facePrimed);
  expect(primed, "nothing decoded the face while the language screen was up").toBe(true);

  /* Behavioural half: with the raster cached this is near-instant. The bound
     is deliberately loose — it is catching "decodes from scratch at the tap",
     which costs hundreds of milliseconds, not a few. */
  const ms = await page.evaluate(async () => {
    const img = new Image();
    img.src = "assets/atrium-face.webp";
    const t0 = performance.now();
    try { await img.decode(); } catch (e) { /* ignore */ }
    return performance.now() - t0;
  });
  expect(ms, "the face still had to be decoded from scratch").toBeLessThan(200);
});

test("the footer sits at the bottom in every section, not part-way up", async ({ page }) => {
  /* Rosé was the one that showed it, but the rule is for all of them: the footer
     is either flush with the bottom of the screen or below the fold. Never
     floating with background underneath. */
  await openApp(page);
  const chips = page.locator("#nav button");
  const n = await chips.count();
  const floating = [];
  for (let i = 0; i < n; i++) {
    const label = (await chips.nth(i).innerText()).trim();
    await chips.nth(i).click();
    await page.waitForTimeout(280);
    const gap = await page.evaluate(() =>
      Math.round(window.innerHeight - document.querySelector(".footer").getBoundingClientRect().bottom));
    if (gap > 8) floating.push(`${label}: ${gap}px of background below the footer`);
  }
  expect(floating).toEqual([]);
});

test("the logo stays visible and put when a wine card opens", async ({ page }) => {
  /* Owner: "logo should be visible as is now when we open details". Opening the
     card locks the body, and a lock that changes the scroll position moves the
     header — which is what made the card appear to jump on open. */
  await openApp(page);
  const before = await box(page, ".header-logo");
  await openWine(page, "Barolo");
  await expect(page.locator(".header-logo")).toBeVisible();
  const during = await box(page, ".header-logo");
  expect(Math.abs(during.y - before.y), "the logo moved when the card opened").toBeLessThan(2);
  expect(Math.abs(during.x - before.x), "the logo moved sideways").toBeLessThan(2);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const after = await box(page, ".header-logo");
  expect(Math.abs(after.y - before.y), "the logo did not come back to where it was").toBeLessThan(2);
});

test("the language screen does not resize when the webfont lands", async ({ page }) => {
  /* Guards 2026-08-02 (owner: "it looks like this gets shrinked quickly, it's
     not fitting from the start"). Markazi Text loads from Google with
     display=swap, so the first paint is always a local font — and Georgia sets
     the title 34% wider than Markazi, so it landed oversized and then visibly
     snapped smaller. css/style.css now carries fallback faces squeezed to
     Markazi's metrics; this measures the swap by blocking fonts.gstatic.com and
     comparing against the real thing. */
  const ink = async (blocked) => {
    const pg = await page.context().newPage();
    if (blocked) await pg.route("https://fonts.gstatic.com/**", (r) => r.abort());
    await pg.goto("/index.html", { waitUntil: "load" });
    await pg.waitForSelector("#start:not(.hidden)");
    await pg.waitForTimeout(600);
    const m = await pg.evaluate(() => {
      const el = document.getElementById("start-title");
      const r = document.createRange();
      r.selectNodeContents(el);
      const b = el.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(el).lineHeight) || b.height;
      return { w: r.getBoundingClientRect().width, h: b.height, lines: Math.round(b.height / lh) };
    });
    await pg.close();
    return m;
  };
  const fallback = await ink(true);
  const real = await ink(false);
  const drift = Math.abs(fallback.w - real.w) / real.w;
  expect(drift, `title moves ${(drift * 100).toFixed(1)}% when the font swaps`).toBeLessThan(0.05);
  expect(Math.abs(fallback.h - real.h), "the line box changes height on swap").toBeLessThan(2);
  /* And it sits on one line either way — the visible half of the complaint was
     a title that did not fit before the swap and did after. */
  expect(fallback.lines, "the fallback title wraps").toBe(1);
  expect(real.lines, "the title wraps even with the real font").toBe(1);
});

test("the logo reserves its box before the file arrives", async ({ page }) => {
  /* Owner, 2026-08-03: "seems like logo or something shrinks/resizes when I
     turn on the page. I saw it on mobile."

     Same shape as the font swap above, and found the same way — by measuring
     rather than looking. `height: auto` on an <img> is 0 until the browser
     knows the intrinsic size, so the start screen laid out with a 0 px logo
     and then jumped: +46 px on a phone, +95 px on the tablet, which pushes the
     language prompt and the flags down and re-centres the column. Fixed with
     aspect-ratio: 316/88, the SVG's own dimensions.

     The request is held rather than aborted, so this measures the real gap
     between first layout and the image landing — an aborted request would
     never resolve and the "after" would be meaningless. */
  const held = [];
  await page.route("**/theatrium-logo.svg", (r) => held.push(r));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const box = () => page.evaluate(() => {
    const e = document.querySelector(".start-logo");
    const r = e.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  await page.waitForTimeout(300);
  const before = await box();
  expect(before.h, "the logo box is empty before the SVG loads").toBeGreaterThan(10);
  for (const r of held) await r.continue();
  await page.waitForSelector(".start-logo");
  await page.waitForTimeout(500);
  const after = await box();
  expect(Math.abs(after.h - before.h), "the logo changes height when it loads").toBeLessThan(2);
});

test("the Croatian flag is fetched with the page, not after it", async ({ page }) => {
  /* Owner, 2026-08-03: "it seems like croatian flag is loading slow/last."

     Nine of the ten flags are inline SVG in js/app.js and paint the moment the
     buttons render. Croatia is the official coat of arms — 196 paths, 69 kB —
     so it is an <img>, and therefore the only flag that crosses the network.
     Worse, the request could not start until app.js had run: measured at
     260 ms, behind a megabyte of JSON, which is why the first flag in the list
     was reliably the last to appear. The preload in index.html moves it into
     the first batch.

     Asserted against the data files rather than a fixed millisecond budget,
     because the absolute numbers depend on the machine; what must stay true is
     the *order*. */
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(600);
  const t = await page.evaluate(() => {
    const at = (suffix) => {
      const e = performance.getEntriesByType("resource").find((r) => r.name.endsWith(suffix));
      return e ? e.startTime : null;
    };
    return { flag: at("flag-hr.svg"), wines: at("wines.json"), producers: at("producers.json") };
  });
  expect(t.flag, "the flag was never fetched").not.toBeNull();
  expect(t.wines, "wines.json was never fetched").not.toBeNull();
  expect(t.flag, "the flag queues behind the wine data").toBeLessThan(t.wines);
  expect(t.flag, "the flag queues behind the producer data").toBeLessThan(t.producers);
});

test("the copyright line is on every page in every language", async ({ page }) => {
  /* Added 2026-08-02. The repo is public and the whole dataset is one fetch
     away, so a notice is the only thing standing between "found it online" and
     a documented copy. It has to actually render, in whatever language the
     guest is reading. */
  for (const lang of ["hr", "en", "zh"]) {
    await openApp(page, { lang });
    const text = await page.locator("#copyright").innerText();
    expect(text, `${lang}: no copyright line`).toContain("©");
    expect(text, `${lang}: no rights holder`).toContain("Apelacija");
    expect(text.length, `${lang}: the notice says nothing`).toBeGreaterThan(30);
  }
});

test("the region maps keep their labels inside the frame", async ({ page }) => {
  /* Added 2026-08-02 with five new maps and again with the twelfth. A label is
     placed at a hand-picked x/y, so it is one careless coordinate away from
     hanging off the picture — and localizing changes every label's width, so
     what fits in Croatian may not in German. Measured as ink, per language. */
  for (const lang of ["hr", "de", "zh"]) {
    await openApp(page, { lang });
    await page.locator('#nav button[data-sec="__regions"]').click();
    await page.waitForSelector(".region-card");
    const bad = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll(".rmap").forEach((svg) => {
        const vb = svg.viewBox.baseVal;
        const boxes = [];
        svg.querySelectorAll("text").forEach((t) => {
          const b = t.getBBox();
          if (b.x < -1 || b.y - b.height < -2 || b.x + b.width > vb.width + 1 || b.y > vb.height + 1)
            out.push(`off-canvas: "${t.textContent}"`);
          boxes.push({ t: t.textContent, x: b.x, y: b.y - b.height, w: b.width, h: b.height });
        });
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], c = boxes[j];
            if (Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x) > 1 &&
                Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y) > 1)
              out.push(`overlap: "${a.t}" / "${c.t}"`);
          }
      });
      return out;
    });
    expect(bad, `${lang}: map labels off-canvas or colliding`).toEqual([]);
  }
});

test("the machine-readable rights notices are served", async ({ request, page }) => {
  /* Added 2026-08-02. The site is public and the whole dataset is one fetch
     away, so the reservation has to exist where a crawler looks: robots.txt,
     /.well-known/tdmrep.json, and a meta element on the page itself. A notice
     nobody can read is not a notice. */
  const robots = await request.get("/robots.txt");
  expect(robots.status(), "robots.txt is missing").toBe(200);
  const body = await robots.text();
  expect(body, "no TDM reservation in robots.txt").toMatch(/TDM-Reservation:\s*1/i);
  for (const bot of ["GPTBot", "ClaudeBot", "CCBot", "Google-Extended"])
    expect(body, `${bot} is not named`).toContain(bot);
  expect(body, "the admin board should not be indexed").toContain("Disallow: /admin.html");

  const tdm = await request.get("/.well-known/tdmrep.json");
  expect(tdm.status(), "tdmrep.json is missing").toBe(200);
  expect((await tdm.json())[0]["tdm-reservation"]).toBe(1);

  const lic = await request.get("/LICENSE");
  expect(lic.status(), "LICENSE is not served").toBe(200);

  await openApp(page);
  const meta = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll("meta[name]")].map((m) => [m.name, m.content])));
  expect(meta["tdm-reservation"], "no tdm-reservation meta").toBe("1");
  expect(meta.copyright, "no copyright meta").toContain("Apelacija");
});

test("a wine row does not stay lit after it has been tapped", async ({ page }) => {
  /* Guards 2026-08-12 (owner, on a phone): a wine read and closed stayed
     visibly greyed next to its neighbours in the list. A touch screen has no
     way to un-hover, so it latches :hover on whatever was last tapped and
     holds it until something else is tapped — the same trap the ‹ › arrows
     fell into, and the reason their rule already sits behind (hover: hover).

     Checked against the stylesheet rather than by tapping, because whether a
     headless browser latches hover at all is a property of the harness, not of
     the app — this asserts the rule that makes latching impossible.

     Scoped to the list rows on purpose. A latched .helper-opt or .modal-close
     is invisible: those elements are gone by the next paint. A row stays on
     screen behind the card. */
  await openApp(page);
  const ungated = await page.evaluate(() => {
    const out = [];
    const walk = (rules, gated) => {
      for (const r of rules) {
        const cond = r.conditionText || (r.media && r.media.mediaText) || "";
        if (r.cssRules) walk(r.cssRules, gated || /hover\s*:\s*hover/.test(cond));
        else if (r.selectorText && r.selectorText.includes(":hover") && !gated) out.push(r.selectorText);
      }
    };
    for (const s of document.styleSheets) {
      /* Google's font stylesheet is cross-origin and cannot be read. */
      try { walk(s.cssRules, false); } catch (e) { /* not ours */ }
    }
    return out;
  });
  const rows = ungated.filter((s) => /(^|[\s,>])\.item\b/.test(s));
  expect(rows, "a list-row :hover rule that a touch screen will latch").toEqual([]);
});

test("nothing is sized in dvh", async () => {
  /* Guards 2026-08-12 (owner, third report of the language screen appearing to
     resize itself on a phone — after the font swap and the logo's missing box
     had each been fixed and each been the wrong culprit).

     dvh is the *dynamic* viewport height. It tracks the browser's chrome, so
     on a phone it changes whenever the address bar collapses or expands —
     during the load, and on any scroll. The language screen is a centred
     column locked to that height, so every one of those changes re-centres
     the logo, the prompt and all eight flags at once. That is the "live
     resizing".

     It is a stylesheet test rather than a page test on purpose: neither a
     desktop browser nor a headless one has an address bar to collapse, so
     there is nothing to observe and any measurement would pass while the app
     was broken. What can be asserted is the rule that makes it impossible.
     svh — the height with the chrome shown, the stable minimum — is the
     replacement everywhere. */
  const css = readFileSync(resolve(HERE, "../css/style.css"), "utf8");
  const hits = css.split(/\r?\n/)
    .map((line, i) => [i + 1, line])
    .filter(([, line]) => /\d\s*dvh\b/.test(line) && !line.trim().startsWith("*"))
    .map(([n, line]) => `${n}: ${line.trim()}`);
  expect(hits, "dvh makes the layout follow the phone's address bar — use svh").toEqual([]);
});

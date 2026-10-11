// Dodaj vino — look up a Robert Parker score on robertparker.com, in the cloud
// (owner, 2026-10-11, commercial subscription: "build it").
//
//   PARKER_USER=… PARKER_PASS=… node .github/wine-intake/parker.mjs out.json "<producer>" "<name with vintage>"
//
// A fixed script with no AI in it: Claude never sees the password or a
// logged-in page. It logs in, searches by URL the way CLAUDE.md describes
// ("Verifying a Parker score"), picks the result that is *this* wine and
// vintage by the rules below, reads its score, and logs out again — the
// subscription allows one device at a time, and the owner's own Chrome is the
// other one.
//
// Output (out.json): { ok, status, query, match?, score?, candidates[], note }
//   status  "found"     one result is this wine and vintage, with a score
//           "none"      the search worked, the producer is there, this
//                       vintage of this wine is not — no review
//           "unsure"    several results could be it, or none fits cleanly;
//                       candidates are listed for a person to choose
//           "error"     login or page failed; nothing is concluded
// Nothing from a review's text is printed or stored: titles and scores only.
import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const [, , OUT, PRODUCER = "", NAME = ""] = process.argv;
const { PARKER_USER, PARKER_PASS } = process.env;
const BASE = "https://www.robertparker.com";
const result = { ok: false, status: "error", query: "", candidates: [], note: "" };
const done = (extra) => { Object.assign(result, extra); writeFileSync(OUT, JSON.stringify(result, null, 1) + "\n"); };

const fold = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/ß/g, "ss").replace(/[^a-z0-9+]+/g, " ").trim();
/* Words that say nothing about which wine it is, on either side. */
const NOISE = new Set(("weingut domaine chateau château tenuta azienda agricola cantina bodega bodegas maison vina vino wine wines " +
  "estate winery the de la le les di del della d l vigneti podere fattoria cave caves weinbau sekt brut").split(" "));
const GRAPES = new Set(("riesling chardonnay pinot noir nero grigio gris blanc bianco sauvignon cabernet merlot syrah shiraz " +
  "grenache garnacha tempranillo nebbiolo sangiovese malvasia malvazija istarska grasevina plavac mali posip " +
  "teran refosco ribolla rebula friulano gruner veltliner spatburgunder blaufrankisch zinfandel trocken").split(" "));
const tokens = (s) => fold(s).split(" ").filter((t) => t && !NOISE.has(t));
const vintageOf = (s) => (String(s).match(/\b(19|20)\d{2}\b/) || [""])[0] || (/\bNV\b/i.test(s) ? "NV" : "");

const vintage = vintageOf(NAME);
const prodTok = tokens(PRODUCER);
const nameTok = tokens(NAME).filter((t) => t !== vintage);
/* What makes the wine itself: the name without the producer, the vintage and the grape. */
const core = nameTok.filter((t) => !prodTok.includes(t) && !GRAPES.has(t));

function judge(title) {
  const t = tokens(title);
  const v = vintageOf(title);
  const rest = t.filter((x) => x !== v && !prodTok.includes(x) && !GRAPES.has(x));
  const coreHit = core.every((c) => t.includes(c) || t.some((x) => x.startsWith(c) || c.startsWith(x)));
  const extra = rest.filter((x) => !nameTok.some((c) => c === x || c.startsWith(x) || x.startsWith(c)));
  const producerHit = prodTok.some((p) => t.includes(p));
  return { v, coreHit, extra, producerHit };
}

if (!PARKER_USER || !PARKER_PASS) { done({ note: "no credentials" }); process.exit(0); }
if (!PRODUCER || !NAME) { done({ note: "need producer and name" }); process.exit(0); }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
page.setDefaultTimeout(30000);
let loggedIn = false;
try {
  /* log in */
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.getByText("LOGIN", { exact: true }).first().click();
  await page.locator("#user_login").fill(PARKER_USER);
  await page.locator("#user_pass").fill(PARKER_PASS);
  await Promise.all([
    page.waitForLoadState("networkidle").catch(() => {}),
    page.locator("#user_pass").press("Enter"),
  ]);
  await page.waitForTimeout(4000);
  loggedIn = !(await page.getByText("LOGIN", { exact: true }).first().isVisible().catch(() => false));
  if (!loggedIn) { done({ note: "login did not take — check PARKER_USER / PARKER_PASS, or a verification step" }); throw new Error("login"); }

  /* search: producer + the wine's own words + vintage */
  const words = [...new Set([...tokens(PRODUCER).slice(-2), ...core, vintage === "NV" ? "" : vintage].filter(Boolean))];
  result.query = words.join(" ");
  const url = `${BASE}/search/wine?rating_computed=50+TO+100&sort=relevancy&keyword=${encodeURIComponent(result.query).replace(/%20/g, "+")}`;
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2500);

  /* every result row: its title link and the row's short text (score sits there) */
  const rows = await page.evaluate(() => [...document.querySelectorAll('.wine-name-selector a[href^="/wines/"]')].map((a) => {
    let row = a; for (let i = 0; i < 8 && row.parentElement; i++) {
      row = row.parentElement;
      if (row.parentElement && row.parentElement.querySelectorAll('.wine-name-selector a[href^="/wines/"]').length > 1) break;
    }
    return { title: a.textContent.trim(), href: a.getAttribute("href"), text: row.innerText.replace(/\s+/g, " ").slice(0, 160) };
  }));
  /* a score is 50–100, maybe with + or a barrel range, and never the vintage */
  const scoreIn = (text, title) => {
    const t = text.replace(title, " ");
    const m = t.match(/\b(100|[5-9]\d)(\+|\s*-\s*(?:100|[5-9]\d))?\b/);
    return m ? m[0].replace(/\s+/g, "") : "";
  };
  const judged = rows.map((r) => ({ ...r, ...judge(r.title), score: scoreIn(r.text, r.title) }));
  result.candidates = judged.slice(0, 12).map(({ title, href, score }) => ({ title, href, score }));

  const fits = judged.filter((r) => r.producerHit && r.coreHit && r.extra.length === 0 && r.v === vintage);
  const loose = judged.filter((r) => r.producerHit && r.coreHit && r.v === vintage);
  const sameWine = judged.filter((r) => r.producerHit && r.coreHit);
  const pick = fits.length === 1 ? fits[0] : (!fits.length && loose.length === 1 ? loose[0] : null);

  if (pick && pick.score) {
    done({ ok: true, status: "found", match: pick.title, href: pick.href, score: pick.score });
  } else if (pick) {
    /* the row may not print the score: open the wine's own page */
    await page.goto(BASE + pick.href, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(2000);
    const head = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 1500);
    const m = head.match(/\b(?:rating|score|RP)\s*:?\s*(100|[5-9]\d)(\+|\s*-\s*(?:100|[5-9]\d))?\b/i);
    if (m) done({ ok: true, status: "found", match: pick.title, href: pick.href, score: (m[1] + (m[2] || "")).replace(/\s+/g, "") });
    else done({ ok: true, status: "unsure", match: pick.title, href: pick.href, note: "the wine is there, the score could not be read" });
  } else if (!fits.length && !loose.length && sameWine.length) {
    done({ ok: true, status: "none", note: `${sameWine.length} other vintage(s) of this wine reviewed, not ${vintage}` });
  } else if (!judged.length) {
    done({ ok: true, status: "unsure", note: "no results for the query" });
  } else {
    done({ ok: true, status: "unsure", note: fits.length > 1 || loose.length > 1 ? "several results fit" : "nothing fits cleanly" });
  }
} catch (e) {
  if (result.status === "error" && !result.note) done({ note: String(e.message || e).slice(0, 200) });
} finally {
  /* log out: one device at a time on this subscription */
  if (loggedIn) {
    try {
      const find = () => page.evaluate(() => {
        const el = [...document.querySelectorAll("a,button")].find((x) => /log ?out|sign ?out|odjava/i.test(x.textContent + " " + (x.href || "")));
        return el ? (el.href || "button") : "";
      });
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      let out = await find();
      if (!out) {
        /* behind the account menu: open it, then look again */
        const menus = page.locator('[class*="user" i], [class*="account" i], [class*="avatar" i], [class*="profile" i], [aria-label*="account" i], [aria-label*="user" i]');
        for (let i = 0; i < Math.min(await menus.count(), 6) && !out; i++) {
          const m = menus.nth(i);
          if (!(await m.isVisible().catch(() => false))) continue;
          await m.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(800);
          out = await find();
        }
      }
      if (out && out !== "button") await page.goto(out, { waitUntil: "domcontentloaded" });
      else if (out === "button") await page.getByRole("button", { name: /log ?out|sign ?out/i }).first().click();
      result.loggedOut = !!out;
      if (!out) result.logoutHints = await page.evaluate(() => [...document.querySelectorAll("header *, nav *")]
        .filter((x) => !(x.textContent || "").trim() && (x.onclick || x.tagName === "BUTTON" || x.tagName === "A" || x.getAttribute("role") === "button" || /user|account|avatar|profile|login/i.test(x.className + "")))
        .map((x) => `${x.tagName}.${String(x.className).slice(0, 60)} aria=${x.getAttribute("aria-label") || ""} href=${x.getAttribute("href") || ""}`).slice(0, 25));
      writeFileSync(OUT, JSON.stringify(result, null, 1) + "\n");
    } catch { /* the session expires on its own */ }
  }
  await browser.close();
}
console.log(JSON.stringify({ status: result.status, query: result.query, match: result.match, score: result.score, note: result.note, loggedOut: result.loggedOut, n: result.candidates.length }));

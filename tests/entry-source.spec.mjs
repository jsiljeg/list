/* Where a visit came from (2026-11-26, Filho: how many guests reach the list
 * from the "How to solve drinking problems" menu on theatrium.hr).
 * js/app.js entrySource() sorts the referrer into five buckets and the
 * stats endpoint accepts exactly those; the pr-checkups Sites tab shows them.
 * Evaluated without a browser: the function is lifted out of app.js. */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const src = app.match(/function entrySource\(\) \{[\s\S]*?\n\}/)[0];
const entry = (referrer) => new Function("document", "location", `${src}; return entrySource();`)(
  { referrer }, { hostname: "theatrium.list.devinos.hr" });

test("a referrer is sorted into one of five sources", () => {
  expect(entry("https://theatrium.hr/")).toBe("web");
  expect(entry("https://www.theatrium.hr/en/")).toBe("web");
  expect(entry("")).toBe("direct");
  expect(entry("https://theatrium.list.devinos.hr/")).toBe("direct");
  expect(entry("https://www.google.hr/")).toBe("search");
  expect(entry("https://l.instagram.com/")).toBe("social");
  expect(entry("https://theatrium.devinos.hr/")).toBe("other");
});

test("the stats endpoint takes exactly those sources, and the visit is counted once", () => {
  const stat = readFileSync(new URL("../web/functions/api/stat.js", import.meta.url), "utf8");
  expect(stat).toMatch(/const ENTRY = \/\^entry:\(web\|search\|social\|other\|direct\)\$\//);
  expect(app).toMatch(/sessionStorage\.getItem\("entry-counted"\)/);
  expect(app).toMatch(/let lang = localStorage\.getItem\(LS_KEY\);\ncountEntry\(lang\);/);
});

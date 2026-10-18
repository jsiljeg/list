/* The demo /admin (2026-10-18): admin.html?demo, shown to venues that are not
   Theatrium. Guards the two things that must never break:

   - the data is invented: scripts/make-demo.mjs writes it from an invented
     database, so every waiter, company, vendor and receipt id in it is one of
     the demo's own, and nothing in it came from Theatrium's books;
   - js/admin-demo.js does nothing without ?demo — the real board loads it
     first, so an active mock there would hide the real data behind fake. */
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("the demo's data is invented, end to end", () => {
  const out = mkdtempSync(join(tmpdir(), "demo-"));
  execFileSync(process.execPath, ["scripts/make-demo.mjs", out], { stdio: "pipe" });
  const read = (f) => JSON.parse(readFileSync(join(out, "demo", f), "utf8"));
  const WAITERS = ["Ana Kovač", "Marko Babić", "Ivana Perić", "Luka Novak", "Petra Jurić"];
  const months = Object.values(read("prihodi.json"));
  const waiters = new Set(months.flatMap((m) => (m.staff || []).map((w) => w.waiter)));
  expect([...waiters].every((w) => WAITERS.includes(w))).toBe(true);
  expect(months.some((m) => (m.days || []).length)).toBe(true);
  const companies = read("tvrtke.json").companies;
  expect(companies.length).toBeGreaterThan(5);
  expect(companies.every((c) => /^0/.test(c.oib))).toBe(true);
  const receipts = read("troskovi.json").items;
  expect(receipts.length).toBeGreaterThan(100);
  expect(receipts.every((r) => /-demo\d+$/.test(r.id))).toBe(true);
  expect(receipts.filter((r) => r.vendor).every((r) => /Primjer|Plaće/.test(r.vendor))).toBe(true);
});

test("the demo script is inert without ?demo", () => {
  const src = readFileSync("js/admin-demo.js", "utf8");
  expect(src).toMatch(/if \(!new URLSearchParams\(location\.search\)\.has\("demo"\)\) return;/);
  /* and it is loaded before the admin's own scripts, so it can answer their first request */
  const page = readFileSync("admin.html", "utf8");
  expect(page.indexOf("js/admin-demo.js")).toBeLessThan(page.indexOf("js/admin.js"));
});

/* Does the assembled site still have everything the app asks for?
   The allowlist in scripts/site-files.sh is hand-maintained, so the failure
   mode is a file the app loads quietly going missing — a 404 that only shows
   up as a blank screen on a tablet in a restaurant. This boots the assembled
   directory, opens both pages, and fails on any request that does not 200. */
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve } from "node:path";

const root = resolve(process.argv[2] || "_site");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".png": "image/png", ".webmanifest": "application/manifest+json" };
const srv = createServer(async (req, res) => {
  let p = join(root, decodeURIComponent(req.url.split("?")[0]));
  try {
    if ((await stat(p)).isDirectory()) p = join(p, "index.html");
    const body = await readFile(p);
    res.writeHead(200, { "content-type": (TYPES[extname(p)] || "application/octet-stream") + "; charset=utf-8" });
    res.end(body);
  } catch { res.writeHead(404).end("not found"); }
});
await new Promise((r) => srv.listen(4199, r));

const bad = [];
const b = await chromium.launch();
for (const page of ["/", "/admin.html", "/qr.html"]) {
  const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
  p.on("pageerror", (e) => bad.push(`${page}: page error — ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error") bad.push(`${page}: console — ${m.text()}`); });
  p.on("response", (r) => {
    const u = new URL(r.url());
    if (u.host === "127.0.0.1:4199" && r.status() >= 400) bad.push(`${page}: ${r.status()} ${u.pathname}`);
  });
  await p.goto("http://127.0.0.1:4199" + page, { waitUntil: "networkidle" });
  if (page === "/") {
    await p.click('#lang-buttons button[data-lang="hr"]');
    await p.click("#story-enter");
    await p.waitForSelector("#app:not(.hidden)");
    const n = await p.evaluate(() => {
      let c = 0;
      for (const s of DATA.sections) for (const x of s.categories) for (const g of x.groups) c += g.items.length;
      return c;
    });
    if (n < 300) bad.push(`/: only ${n} listings loaded`);
    else console.log(`  index: ${n} listings, data and code all resolved`);
    /* the internal tree must NOT be reachable */
    /* the fragment theatrium.hr embeds — a 404 here silently empties their page */
    for (const u of ["/embed-hr.html", "/embed-en.html"]) {
      const r = await p.request.get("http://127.0.0.1:4199" + u);
      if (r.status() !== 200) bad.push(`missing: ${u} (${r.status()})`);
      else if (!(await r.text()).includes("tl-n")) bad.push(`${u} has no items`);
    }
    for (const u of ["/scratch/vinarije-vina.html", "/docs/preporuke-2026-08.txt",
                     "/data/source/wine-card-2026.pdf", "/tests/data.spec.mjs",
                     "/CLAUDE.md", "/package.json", "/scripts/validate.mjs"]) {
      const r = await p.request.get("http://127.0.0.1:4199" + u);
      if (r.status() !== 404) bad.push(`still published: ${u} (${r.status()})`);
    }
  }
  await p.close();
}
await b.close();
srv.close();
if (bad.length) { console.error("FAIL\n  " + bad.join("\n  ")); process.exit(1); }
console.log("site OK — every file the app loads is published, nothing internal is");

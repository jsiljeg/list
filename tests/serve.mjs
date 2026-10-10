/* Static file server for the test run — deliberately dependency-free, because
   the site it serves has no dependencies either and adding a server package to
   test a folder of static files would be silly. Mirrors GitHub Pages closely
   enough for our purposes: correct content types, 404 for what is missing, and
   no directory listings. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/* import.meta.dirname needs Node 20.11; this works everywhere. */
const HERE = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(HERE, "..");
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json"
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    /* The tests run against the whole list, not tonight's. data/unavailable.json
       is the live 86 board, edited by staff from /admin, so serving the file
       made every test that opens a named wine depend on what happened to be in
       stock: on 2026-10-10, with 38 hidden, Moret's Meursault 2020, Costanti's
       Brunello 2018 and Meneghetti's Blanc de Blancs vanished from under eleven
       tests across every viewport. A test about hiding injects its own rules
       with page.route(), which wins over the server. TEST_LIVE_86=1 serves
       the real file, to look at the list as a guest sees it tonight. */
    if (path === "/data/unavailable.json" && !process.env.TEST_LIVE_86) {
      const body = Buffer.from('{\n "hidden": []\n}\n');
      res.writeHead(200, { "content-type": TYPES[".json"], "content-length": body.length, "cache-control": "no-store" });
      res.end(body);
      return;
    }
    /* Never serve above the repo root, whatever the request says. */
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("forbidden"); return; }
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(404).end("not found"); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
      "content-length": body.length,
      "cache-control": "no-store"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));

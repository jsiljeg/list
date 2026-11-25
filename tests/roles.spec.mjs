/* The head sommelier's role on the server (web/ROLES.md, 2026-11-17).

   Owner: "it is dangerous to leave even 1% chance he sees Troškovi or
   anything else he is not allowed to see." So this does not sample: it walks
   every /api route file and every handler it exports, and for each one
   proves, with the real handlers over a real SQLite D1:

   - the table ACCESS (web/functions/_lib/roles.js) declares it — a new
     endpoint without a line there fails this spec, so the allowlist cannot
     grow a hole silently;
   - lock 1, api/_middleware.js: a somm key reaches only what ACCESS opens to
     somm, everything else is 403 {"error":"role"} and the function never
     runs; an unknown or malformed somm key is 401;
   - lock 2, the function itself: called directly, past the middleware, a
     somm key still gets an error and nothing else from every function that
     is not his;
   - what IS his works: Dodaj vino, Ponuda, /api/uloga, /api/karta;
   - full keys (STAFF_KEY, a listed GitHub key) still pass everywhere they did;
   - /api/karta takes exactly the board's changes and nothing else.

   Runs without a browser. */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL, fileURLToPath } from "node:url";
import { ACCESS, SOMM_KEYS, resolveRoute, sommMay } from "../web/functions/_lib/roles.js";
import { checkList, checkRules, cleanMessage } from "../web/functions/_lib/karta.js";
import { onRequest as middleware } from "../web/functions/api/_middleware.js";
import { checkPatch } from "../scripts/check-card-patch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = path.join(ROOT, "web/functions/api");
const sha = (t) => createHash("sha256").update(t).digest("hex");

/* ---------- every route file and handler, read off the disk ---------- */
const METHODS = { onRequestGet: "GET", onRequestPost: "POST", onRequestPut: "PUT", onRequestDelete: "DELETE",
  onRequestPatch: "PATCH", onRequestOptions: "OPTIONS", onRequestHead: "HEAD", onRequest: "*" };
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name))
    : e.name.endsWith(".js") && e.name !== "_middleware.js" ? [path.join(dir, e.name)] : []));
}
const routeOf = (file) => "/api/" + path.relative(API, file).replace(/\\/g, "/").replace(/\.js$/, "")
  .replace(/(^|\/)index$/, "").replace(/\[\[([a-z]+)\]\]/g, ":$1*").replace(/\[([a-z]+)\]/g, ":$1");
const FILES = walk(API).map((file) => ({ file, route: routeOf(file).replace(/\/$/, "") }));
const HANDLERS = [];
for (const f of FILES) {
  const mod = await import(pathToFileURL(f.file).href);
  for (const [name, method] of Object.entries(METHODS)) if (typeof mod[name] === "function") HANDLERS.push({ ...f, method, fn: mod[name] });
}
const PARAM = { id: "20260101-aaaaaaaaaaaa", n: "1", action: "objavi", batch: "20260101-aaaaaaaaaaaa" };
const urlOf = (route) => "https://theatrium.devinos.hr" + route.replace(/:([a-z]+)/g, (_, k) => PARAM[k]);
const paramsOf = (route) => Object.fromEntries([...route.matchAll(/:([a-z]+)/g)].map(([, k]) => [k, PARAM[k]]));

/* ---------- keys ---------- */
const SOMM = "somm_" + "T".repeat(43);
const STRANGER = "somm_" + "X".repeat(43);              /* well-formed, never enrolled */
const STAFF = "staff-key-for-tests-0123456789";
const GHKEY = "github_pat_" + "F".repeat(40);           /* Filho's, listed */

/* ---------- a real D1, as make-demo.mjs builds it ---------- */
function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(fs.readFileSync(path.join(ROOT, "web/schema.sql"), "utf8"));
  for (const c of ["source TEXT", "dup_of TEXT", "due_date TEXT", "paid_at TEXT"]) {
    try { db.exec(`ALTER TABLE expense_receipts ADD COLUMN ${c}`); } catch { /* there */ }
  }
  try { db.exec("ALTER TABLE sales_bills ADD COLUMN h TEXT"); } catch { /* there */ }
  return { prepare(sql) { const st = db.prepare(sql); let a = []; const o = {
    bind(...x) { a = x.map((v) => (v === undefined ? null : v instanceof ArrayBuffer ? new Uint8Array(v) : v)); return o; },
    all: async () => ({ results: st.all(...a) }), first: async () => st.get(...a) ?? null,
    run: async () => ({ meta: { changes: st.run(...a).changes } }) };
    return o; }, batch: async (xs) => Promise.all(xs.map((x) => x.run())) };
}
const envOf = (extra = {}) => ({ DB: freshDb(), STAFF_KEY: STAFF, WINE_GH_KEYS: sha(GHKEY).slice(0, 16),
  WINE_SOMM_KEYS: `${sha(SOMM)}:Toni`, WINE_INTAKE_ENABLED: "0", KARTA_GH_TOKEN: "server-token", ...extra });

/* ---------- the outside world: GitHub and the wine list's site ---------- */
const LIST = fs.readFileSync(path.join(ROOT, "lists/theatrium.json"), "utf8");
const LIB = fs.readFileSync(path.join(ROOT, "library/wines.json"), "utf8");
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const gh = { files: {}, puts: [], calls: [] };
const resetGh = () => {
  gh.files = { "lists/theatrium.json": { text: LIST, sha: "L0" }, "data/unavailable.json": { text: '{"_":"x","hidden":[]}\n', sha: "U0" } };
  gh.puts = []; gh.calls = [];
};
const realFetch = globalThis.fetch;
test.beforeAll(() => {
  globalThis.fetch = async (input, init = {}) => {
    const u = String(input && input.url ? input.url : input), method = (init.method || "GET").toUpperCase();
    gh.calls.push(`${method} ${u}`);
    if (u === "https://api.github.com/user") {
      const auth = String((init.headers && (init.headers.authorization || init.headers.Authorization)) || "");
      return new Response(JSON.stringify(auth.endsWith(GHKEY) ? { login: "jsiljeg" } : {}), { status: auth.endsWith(GHKEY) ? 200 : 401 });
    }
    const m = u.match(/^https:\/\/api\.github\.com\/repos\/jsiljeg\/list\/contents\/([^?]+)/);
    if (m) {
      const f = gh.files[decodeURIComponent(m[1])];
      if (!f) return new Response("{}", { status: 404 });
      if (method === "GET") return new Response(JSON.stringify({ sha: f.sha, content: b64(f.text) }), { status: 200 });
      const b = JSON.parse(init.body);
      if (b.sha !== f.sha) return new Response("{}", { status: 409 });
      f.text = Buffer.from(b.content, "base64").toString("utf8"); f.sha = f.sha[0] + (Number(f.sha.slice(1)) + 1);
      gh.puts.push({ path: m[1], message: b.message, author: b.author, text: f.text });
      return new Response(JSON.stringify({ content: { sha: f.sha } }), { status: 200 });
    }
    if (/\/library\/wines\.json$/.test(u)) return new Response(LIB, { status: 200 });
    if (/\/lists\/theatrium\.json$/.test(u)) return new Response(LIST, { status: 200 });
    if (/\/data\/unavailable\.json$/.test(u)) return new Response('{"hidden":[]}', { status: 200 });
    return new Response(null, { status: 204 });          /* a workflow dispatch, an alert */
  };
});
test.afterAll(() => { globalThis.fetch = realFetch; });
test.beforeEach(resetGh);

const req = (method, url, key, body, headers = {}) => new Request(url, {
  method, body, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), origin: "https://theatrium.list.devinos.hr", ...headers } });
/* one request through both locks, as Pages runs it */
async function call(h, key, { env = envOf(), body, headers, url, params } = {}) {
  const method = h.method === "*" ? "GET" : h.method;
  const request = req(method, url || urlOf(h.route), key, body, headers);
  let ran = false;
  const res = await middleware({ request, env, next: async () => { ran = true; return h.fn({ request, env, params: params || paramsOf(h.route), waitUntil: () => {} }); } });
  return { res, ran };
}
const isSomm = (h) => (ACCESS[h.route] && ACCESS[h.route][h.method] || []).includes("somm");
const roles = (h) => (ACCESS[h.route] && ACCESS[h.route][h.method]) || [];

/* ======================================================================= */

test("every /api handler on disk is declared in ACCESS, and ACCESS names nothing that is not there", () => {
  expect(HANDLERS.length).toBeGreaterThan(40);
  const onDisk = new Set(HANDLERS.map((h) => `${h.method} ${h.route}`));
  const declared = new Set(Object.entries(ACCESS).flatMap(([r, ms]) => Object.keys(ms).map((m) => `${m} ${r}`)));
  expect([...onDisk].filter((x) => !declared.has(x)), "handlers with no line in ACCESS").toEqual([]);
  expect([...declared].filter((x) => !onDisk.has(x)), "ACCESS lines with no handler").toEqual([]);
  /* every route resolves to itself, so the middleware judges the right line */
  for (const h of HANDLERS) expect(resolveRoute(new URL(urlOf(h.route)).pathname), h.route).toBe(h.route);
});

test("the sommelier's allowlist is exactly Karta, Dodaj vino and Ponuda — widening it is a decision, made here", () => {
  const somm = Object.entries(ACCESS).flatMap(([r, ms]) => Object.entries(ms).filter(([, rs]) => rs.includes("somm")).map(([m]) => `${m} ${r}`)).sort();
  expect(somm).toEqual([
    "DELETE /api/kuhinja/media/:id", "DELETE /api/kuhinja/ponuda",
    "GET /api/karta", "GET /api/kuhinja/citaj", "GET /api/kuhinja/citaj/:id", "GET /api/kuhinja/ponuda",
    "GET /api/uloga", "GET /api/vina", "GET /api/vina/:id", "GET /api/vina/:id/foto/:n",
    "POST /api/kuhinja/citaj", "POST /api/kuhinja/citaj/:id/:action", "POST /api/kuhinja/media",
    "POST /api/vina", "POST /api/vina/:id/:action",
    "PUT /api/karta", "PUT /api/kuhinja/ponuda",
  ]);
  /* nothing under troskovi or prihodi, in any form */
  expect(somm.filter((x) => /troskovi|prihodi|povijest|test-obavijest/.test(x))).toEqual([]);
  /* and no key is enrolled in the code yet: handing access to a person is the owner's call */
  expect(Object.keys(SOMM_KEYS)).toEqual([]);
});

test("only somm-allowed routes may call staffOrSomm — the second lock opens nowhere else", () => {
  for (const f of FILES) {
    const src = fs.readFileSync(f.file, "utf8");
    if (!/staffOrSomm/.test(src)) continue;
    const opens = Object.values(ACCESS[f.route] || {}).some((rs) => rs.includes("somm"));
    expect(opens, `${f.route} calls staffOrSomm but ACCESS gives somm nothing there`).toBe(true);
  }
});

test("every write route open to him records who did it — git for Karta, staff_log for the rest", () => {
  for (const f of FILES) {
    const writes = Object.entries(ACCESS[f.route] || {}).some(([m, rs]) => rs.includes("somm") && !["GET", "OPTIONS"].includes(m));
    if (!writes) continue;
    const src = fs.readFileSync(f.file, "utf8");
    if (f.route === "/api/karta") expect(src, f.route).toMatch(/writeFile\(env, b\.file, next, cur\.sha, cleanMessage\(b\.message\), who\)/);
    else expect(src, `${f.route} lets him write but never calls logStaff`).toMatch(/logStaff\(env, a,/);
    expect(src, `${f.route} names a sommelier from the page`).not.toMatch(/person\((form\.get\("by"\)|b\.by)\)(?![^\n]*actorName)/);
  }
});

/* ---- lock 1: the middleware, every handler ---- */
test("a somm key through the middleware: 403 {error:role} on every route that is not his, and the function never runs", async () => {
  const seen = [];
  for (const h of HANDLERS) {
    if (h.method === "OPTIONS") continue;             /* a preflight carries no key */
    const { res, ran } = await call(h, SOMM, { body: ["GET", "HEAD"].includes(h.method) ? undefined : "{}" });
    if (isSomm(h)) { expect(ran, `${h.method} ${h.route} is his and must reach the function`).toBe(true); continue; }
    seen.push(`${h.method} ${h.route}`);
    expect(ran, `${h.method} ${h.route} ran for a somm key`).toBe(false);
    expect(res.status, `${h.method} ${h.route}`).toBe(403);
    expect(await res.json()).toEqual({ error: "role" });
  }
  /* the ones that matter most, by name, so a rename cannot slip past */
  for (const must of ["GET /api/troskovi", "POST /api/troskovi", "GET /api/troskovi/povijest", "GET /api/troskovi/:id/foto/:n",
    "POST /api/troskovi/:id/:action", "GET /api/troskovi/mer", "POST /api/troskovi/kljucevi", "GET /api/prihodi",
    "GET /api/prihodi/tvrtke", "PUT /api/prihodi/tvrtke", "POST /api/vina/test-obavijest", "GET /api/dnevnik"]) expect(seen).toContain(must);
});

test("an unknown or malformed somm key is refused everywhere, also on his own routes", async () => {
  for (const h of HANDLERS.filter((x) => x.method !== "OPTIONS")) {
    for (const key of [STRANGER, "somm_short", "somm_" + "a".repeat(43) + "!", "SOMM_" + "T".repeat(43)]) {
      const { res, ran } = await call(h, key);
      expect(ran, `${h.method} ${h.route} ran for ${key.slice(0, 8)}`).toBe(false);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "key" });
    }
  }
});

test("paths that try to slip around the table resolve to nothing, and nothing is let through", async () => {
  const env = envOf();
  for (const [method, p] of [["GET", "/api/troskovi/"], ["GET", "/api//troskovi"], ["GET", "/api/Troskovi"], ["GET", "/api/troskovi?x=/api/vina"],
    ["GET", "/api/vina/x/../../troskovi"], ["GET", "/api/vina/test-obavijest"], ["POST", "/api/vina/test-obavijest"],
    ["GET", "/api/prihodi/tvrtke/"], ["GET", "/api/troskovi/povijest%2F"], ["GET", "/api/nepostoji"], ["PATCH", "/api/vina"],
    ["GET", "/api/kuhinja/citaj/x/objavi"], ["GET", "/api/troskovi/a/foto/1"]]) {
    let ran = false;
    const res = await middleware({ request: req(method, "https://theatrium.devinos.hr" + p, SOMM), env, next: async () => { ran = true; return new Response("{}"); } });
    expect(ran, `${method} ${p}`).toBe(false);
    expect(res.status, `${method} ${p}`).toBe(403);
  }
  expect(sommMay("GET", "/api/vina/")).toBe(true);           /* a trailing slash on his own route is still his */
});

test("other keys pass the middleware untouched: the guests, Filho, the machines", async () => {
  for (const h of HANDLERS) {
    for (const key of [null, STAFF, GHKEY, "worker-key"]) {
      let ran = false;
      await middleware({ request: req(h.method === "*" ? "GET" : h.method, urlOf(h.route), key), env: envOf(), next: async () => { ran = true; return new Response("{}"); } });
      expect(ran, `${h.method} ${h.route} with ${key}`).toBe(true);
    }
  }
});

/* ---- lock 2: the functions themselves, past the middleware ---- */
test("called directly, every function that is not his gives a somm key an error and nothing else", async () => {
  const ACTIONS = { "/api/troskovi/:id/:action": ["obrisi", "placeno", "kategorija", "ispravi", "nije_isti", "ponovi", "stanje"],
    "/api/vina/:id/:action": ["stanje"], "/api/kuhinja/citaj/:id/:action": ["stanje"] };
  let n = 0;
  for (const h of HANDLERS) {
    const rs = roles(h);
    if (rs.includes("public") || h.method === "OPTIONS") continue;
    for (const action of ACTIONS[h.route] || [PARAM.action]) {
      if (rs.includes("somm") && !(ACTIONS[h.route] || []).includes(action)) continue;
      const env = envOf({ EXPENSE_WORKER_KEY: "ew-key", WINE_WORKER_KEY: "ww-key", WINE_READ_KEY: "wr-key" });
      const request = req(h.method, urlOf(h.route).replace("/objavi", "/" + action), SOMM,
        ["GET", "HEAD", "DELETE"].includes(h.method) ? undefined : "{}", { "content-type": "application/json" });
      const res = await h.fn({ request, env, params: { ...paramsOf(h.route), action }, waitUntil: () => {} });
      const body = await res.json().catch(() => null);
      expect([401, 403, 503], `${h.method} ${h.route} (${action}) → ${res.status}`).toContain(res.status);
      expect(body && Object.keys(body), `${h.method} ${h.route} (${action}) said more than an error`).toEqual(["error"]);
      n++;
    }
  }
  expect(n).toBeGreaterThan(20);
});

/* ---- what is his, working ---- */
const H = (method, route) => HANDLERS.find((h) => h.method === method && h.route === route);
const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "label.jpg", { type: "image/jpeg" });

test("as the sommelier: who am I", async () => {
  const { res } = await call(H("GET", "/api/uloga"), SOMM);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ role: "somm", who: "Toni", print: sha(SOMM).slice(0, 16) });
  const full = await call(H("GET", "/api/uloga"), STAFF);
  expect((await full.res.json()).role).toBe("full");
});

test("as the sommelier: Dodaj vino — send a bottle, read it, see its photo, cancel it; signed by the server, not the page", async () => {
  const env = envOf();
  const fd = new FormData();
  fd.append("photo", photo()); fd.append("price_bottle", "95"); fd.append("by", "Filho");
  const sent = await call(H("POST", "/api/vina"), SOMM, { env, body: fd });
  expect(sent.res.status).toBe(201);
  const { item } = await sent.res.json();
  expect(item.created_by).toBe("Toni");
  /* the run's cost is the owner's, not on his screen */
  await env.DB.prepare("UPDATE wine_requests SET usage = ?1 WHERE id = ?2").bind('{"cost_usd":1.5}', item.id).run();
  const list = await call(H("GET", "/api/vina"), SOMM, { env });
  const lj = await list.res.json();
  expect(lj.items.map((i) => i.id)).toEqual([item.id]);
  expect("usage" in lj.items[0]).toBe(false);
  const one = await call(H("GET", "/api/vina/:id"), SOMM, { env, url: `https://theatrium.devinos.hr/api/vina/${item.id}`, params: { id: item.id } });
  expect(one.res.status).toBe(200);
  expect("usage" in (await one.res.json()).item).toBe(false);
  const pic = await call(H("GET", "/api/vina/:id/foto/:n"), SOMM, { env, url: `https://theatrium.devinos.hr/api/vina/${item.id}/foto/1`, params: { id: item.id, n: "1" } });
  expect(pic.res.status).toBe(200);
  const cancel = await call(H("POST", "/api/vina/:id/:action"), SOMM, { env, body: "{}", url: `https://theatrium.devinos.hr/api/vina/${item.id}/odustani`, params: { id: item.id, action: "odustani" } });
  expect(cancel.res.status).toBe(200);
  expect((await cancel.res.json()).item.status).toBe("cancelled");
  /* Filho still sees the cost */
  const full = await call(H("GET", "/api/vina"), STAFF, { env });
  expect((await full.res.json()).items[0].usage).toEqual({ cost_usd: 1.5 });
  /* the worker's own action stays the worker's */
  const st = await call(H("POST", "/api/vina/:id/:action"), SOMM, { env, body: "{}", url: `https://theatrium.devinos.hr/api/vina/${item.id}/stanje`, params: { id: item.id, action: "stanje" } });
  expect(st.res.status).toBe(401);
});

test("as the sommelier: Ponuda — send a menu, publish an offer, read it, delete it, add and remove a photo", async () => {
  const env = envOf();
  const fd = new FormData();
  fd.append("text", "Juha od bundeve\nTeleći obrazi"); fd.append("by", "Filho");
  const sent = await call(H("POST", "/api/kuhinja/citaj"), SOMM, { env, body: fd });
  expect(sent.res.status).toBe(201);
  const { id } = await sent.res.json();
  const one = await call(H("GET", "/api/kuhinja/citaj/:id"), SOMM, { env, url: `https://theatrium.devinos.hr/api/kuhinja/citaj/${id}`, params: { id } });
  const it = (await one.res.json()).item;
  expect(it.created_by).toBe("Toni");
  expect("usage" in it).toBe(false);
  const list = await call(H("GET", "/api/kuhinja/citaj"), SOMM, { env });
  expect((await list.res.json()).items.length).toBe(1);
  const cancel = await call(H("POST", "/api/kuhinja/citaj/:id/:action"), SOMM, { env, body: "{}", url: `https://theatrium.devinos.hr/api/kuhinja/citaj/${id}/odustani`, params: { id, action: "odustani" } });
  expect(cancel.res.status).toBe(200);

  const date = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const offer = { date, status: "published", title: { hr: "Danas" }, dishes: [{ course: "mains", name: { hr: "Teleći obrazi" }, price: 29, wines: [] }] };
  const put = await call(H("PUT", "/api/kuhinja/ponuda"), SOMM, { env, body: JSON.stringify(offer) });
  expect(put.res.status).toBe(200);
  const got = await call(H("GET", "/api/kuhinja/ponuda"), SOMM, { env, url: `https://theatrium.devinos.hr/api/kuhinja/ponuda?date=${date}` });
  expect((await got.res.json()).offer.status).toBe("published");
  const pic = await call(H("POST", "/api/kuhinja/media"), SOMM, { env, body: new Uint8Array([1, 2, 3, 4]), headers: { "content-type": "image/webp" },
    url: `https://theatrium.devinos.hr/api/kuhinja/media?date=${date}` });
  expect(pic.res.status).toBe(201);
  const mid = (await pic.res.json()).id;
  const del = await call(H("DELETE", "/api/kuhinja/media/:id"), SOMM, { env, url: `https://theatrium.devinos.hr/api/kuhinja/media/${mid}`, params: { id: mid } });
  expect(del.res.status).toBe(200);
  const gone = await call(H("DELETE", "/api/kuhinja/ponuda"), SOMM, { env, url: `https://theatrium.devinos.hr/api/kuhinja/ponuda?date=${date}` });
  expect(gone.res.status).toBe(200);
});

/* ---- /api/karta: his board ---- */
const listDoc = () => JSON.parse(LIST);
const firstBottle = (doc) => {
  for (const s of doc.sections) if (s.id.startsWith("bottle")) for (const c of s.categories) for (const g of c.groups) for (const it of g.items) if (it.price) return { s, c, g, it };
  return null;
};
const putKarta = (file, doc, sha, message = "Cijena: X: 1 → 2 €", key = SOMM, env = envOf()) =>
  call(H("PUT", "/api/karta"), key, { env, body: JSON.stringify({ file, content: b64(JSON.stringify(doc, null, 1) + "\n"), sha, message, by: "Filho" }) });

test("as the sommelier: /api/karta reads both files and commits a price — signed Toni by the server", async () => {
  const r = await call(H("GET", "/api/karta"), SOMM, { url: "https://theatrium.devinos.hr/api/karta?file=lists/theatrium.json" });
  expect(r.res.status).toBe(200);
  const j = await r.res.json();
  expect(j.sha).toBe("L0");
  expect(Buffer.from(j.content, "base64").toString("utf8")).toBe(LIST);
  const doc = listDoc(), b = firstBottle(doc);
  b.it.price = b.it.price + 5;
  const w = await putKarta("lists/theatrium.json", doc, "L0", "Cijena: Neki Vinar Vino: 100 → 105 € — Filho");
  expect(w.res.status).toBe(200);
  expect((await w.res.json()).content.sha).toBe("L1");
  expect(gh.puts).toHaveLength(1);
  expect(gh.puts[0].message).toBe("Cijena: Neki Vinar Vino: 100 → 105 € — Filho — Toni");
  expect(gh.puts[0].author).toEqual({ name: "Toni", email: "toni@theatrium-admin.invalid" });
  /* the server writes the board's own serialisation, nothing else */
  expect(gh.puts[0].text).toBe(JSON.stringify(doc, null, 1) + "\n");
  /* and a stale sha is a conflict, as on GitHub */
  const stale = await putKarta("lists/theatrium.json", doc, "L0");
  expect(stale.res.status).toBe(409);
});

test("/api/karta refuses every change the board cannot make, and writes nothing", async () => {
  const cases = {
    anchor: (d) => { const b = firstBottle(d); b.it.anchor = (b.it.anchor || 1) + 1; },
    ref: (d) => { firstBottle(d).it.ref = "neki--drugi"; },
    extra_field: (d) => { firstBottle(d).it.recommended = true; },
    price_text: (d) => { firstBottle(d).it.price = "105"; },
    price_zero: (d) => { firstBottle(d).it.price = 0; },
    price_3dp: (d) => { firstBottle(d).it.price = 10.555; },
    new_false: (d) => { firstBottle(d).it.new = false; },
    deleted: (d) => { const b = firstBottle(d); b.g.items.splice(b.g.items.indexOf(b.it), 1); },
    reordered: (d) => { const b = firstBottle(d); b.g.items.reverse(); if (b.g.items.length < 2) b.g.items.push({ ...b.it }); },
    added_bottle: (d) => { const b = firstBottle(d); b.g.items.push({ ref: b.it.ref, price: 10 }); },
    category_renamed: (d) => { firstBottle(d).c.id = "nesto"; },
    section_added: (d) => { d.sections.push({ id: "bottle-x", categories: [] }); },
    top_level: (d) => { d.venue = "drugi"; },
    glass_unknown_ref: (d) => { d.sections.find((s) => s.id === "glass").categories[0].groups[0].items.push({ ref: "ne--postoji", price: 9 }); },
    glass_extra_key: (d) => { const b = firstBottle(d); d.sections.find((s) => s.id === "glass").categories[0].groups[0].items.push({ ref: b.it.ref, price: 9, anchor: 9 }); },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const doc = listDoc();
    mutate(doc);
    const w = await putKarta("lists/theatrium.json", doc, "L0");
    expect(w.res.status, name).toBe(422);
    expect((await w.res.json()).error, name).toBe("change");
  }
  /* and only the two board files exist for it */
  for (const file of ["data/till-map.json", "data/buy-map.json", "web/functions/_lib/roles.js", "../lists/theatrium.json"]) {
    const w = await call(H("PUT", "/api/karta"), SOMM, { body: JSON.stringify({ file, content: b64("{}"), sha: "x" }) });
    expect(w.res.status, file).toBe(400);
    const g = await call(H("GET", "/api/karta"), SOMM, { url: `https://theatrium.devinos.hr/api/karta?file=${encodeURIComponent(file)}` });
    expect(g.res.status, file).toBe(400);
  }
  expect(gh.puts).toEqual([]);
});

test("/api/karta's checker takes exactly the board's edits: price, NOVO, + čaša, a new glass category", () => {
  const old = listDoc();
  /* NOVO on and off */
  const a = listDoc(); const b = firstBottle(a); b.it.new = true;
  expect(checkList(old, a)).toBe("");
  delete b.it.new; expect(checkList(old, a)).toBe("");
  /* a price with two decimals */
  b.it.price = 12.35; expect(checkList(old, a)).toBe("");
  /* + čaša: a bottle that is not yet poured goes on the glass shelf */
  const glassRefs = new Set(); const glass = old.sections.find((s) => s.id === "glass");
  for (const c of glass.categories) for (const g of c.groups) for (const it of g.items) glassRefs.add(it.ref);
  let pick = null;
  for (const s of old.sections) if (s.id.startsWith("bottle")) for (const c of s.categories) for (const g of c.groups) for (const it of g.items)
    if (!pick && !glassRefs.has(it.ref) && glass.categories.some((gc) => gc.id === c.id)) pick = { ref: it.ref, cat: c.id };
  expect(pick).not.toBeNull();
  const c2 = listDoc(); const gcat = c2.sections.find((s) => s.id === "glass").categories.find((c) => c.id === pick.cat);
  gcat.groups[0].items.splice(1, 0, { ref: pick.ref, price: 11 });
  expect(checkList(old, c2)).toBe("");
  /* twice is not once */
  gcat.groups[0].items.push({ ref: pick.ref, price: 11 });
  expect(checkList(old, c2)).not.toBe("");
  /* a first category of its kind on the glass shelf */
  const missing = [...new Set(old.sections.filter((s) => s.id.startsWith("bottle")).flatMap((s) => s.categories.map((c) => c.id)))]
    .find((id) => !glass.categories.some((c) => c.id === id));
  if (missing) {
    let ref = null;
    for (const s of old.sections) if (s.id.startsWith("bottle")) for (const c of s.categories) if (c.id === missing) ref = ref || c.groups[0].items[0].ref;
    const d = listDoc(); d.sections.find((s) => s.id === "glass").categories.push({ id: missing, groups: [{ country: null, items: [{ ref, price: 9 }] }] });
    expect(checkList(old, d)).toBe("");
  }
  /* the same new category anywhere else is refused */
  const e = listDoc(); e.sections.find((s) => s.id.startsWith("bottle")).categories.push({ id: "red", groups: [{ country: null, items: [] }] });
  expect(checkList(old, e)).not.toBe("");
  expect(checkList(old, old)).toBe("");
});

test("/api/karta's checker on the 86 list: hides and returns of real wines only, in the board's shape", () => {
  const lib = JSON.parse(LIB).wines;
  const w = Object.values(lib).find((x) => x.producer);
  const old = { _: "x", hidden: [{ name: "Staro pravilo bez vinara" }] };
  expect(checkRules(old, { _: "x", hidden: [] }, lib)).toBe("");                                       /* everything back */
  expect(checkRules(old, { _: "x", hidden: [...old.hidden, { producer: w.producer, name: w.name, since: "2026-11-17" }] }, lib)).toBe("");
  expect(checkRules(old, { _: "x", hidden: [{ producer: w.producer, name: w.name, where: "glass", since: "2026-11-17" }] }, lib)).toBe("");
  expect(checkRules(old, { hidden: [{ producer: "Nitko", name: "Ništa" }] }, lib)).toBe("unknown_wine");
  expect(checkRules(old, { hidden: [{ producer: w.producer, name: w.name, where: "pola" }] }, lib)).toBe("where");
  expect(checkRules(old, { hidden: [{ producer: w.producer, name: w.name, price: 1 }] }, lib)).toBe("rule");
  expect(checkRules(old, { hidden: [{ producer: w.producer, name: w.name, since: "sutra" }] }, lib)).toBe("since");
  expect(checkRules(old, { hidden: [], extra: 1 }, lib)).toBe("top");
  expect(checkRules(old, { hidden: "sve" }, lib)).toBe("shape");
  expect(cleanMessage("Nema: X\u0007\n\nY\n\n")).toEqual(["Nema: X", "", "Y"]);
  expect(cleanMessage("")).toEqual(["Promjena na karti"]);
});

test("/api/karta without its server token says so and writes nothing", async () => {
  const env = envOf({ KARTA_GH_TOKEN: "" });
  const g = await call(H("GET", "/api/karta"), SOMM, { env, url: "https://theatrium.devinos.hr/api/karta?file=data/unavailable.json" });
  expect(g.res.status).toBe(503);
  expect(await g.res.json()).toEqual({ error: "not_configured" });
  expect(gh.calls.filter((c) => c.includes("api.github.com"))).toEqual([]);
});

/* ---- his activities in Filho's history, never his to read (owner, 2026-11-17) ---- */
test("every write he can make in Dodaj vino and Ponuda is logged as Toni — even when the page says it was Filho", async () => {
  const env = envOf({ WINE_INTAKE_ENABLED: "1", GH_DISPATCH_TOKEN: "dispatch" });
  const db = (sql, ...v) => env.DB.prepare(sql).bind(...v).run();
  const at = (route, method, p, opts = {}) => call(H(method, route), SOMM,
    { env, url: "https://theatrium.devinos.hr" + p, params: opts.params, body: opts.body, headers: opts.headers });
  const asFilho = JSON.stringify({ by: "Filho" });

  /* Dodaj vino: send, answer, correct, retry, publish, cancel */
  const fd = new FormData(); fd.append("photo", photo()); fd.append("price_bottle", "95"); fd.append("by", "Filho");
  const { item } = await (await at("/api/vina", "POST", "/api/vina", { body: fd })).res.json();
  const id = item.id, P = (action) => ({ id, action });
  await db("UPDATE wine_requests SET status = 'needs_info', questions = ?1 WHERE id = ?2", '["Alkohol?"]', id);
  const ans = new FormData(); ans.append("answer_0", "13,5"); ans.append("by", "Filho");
  expect((await at("/api/vina/:id/:action", "POST", `/api/vina/${id}/odgovor`, { params: P("odgovor"), body: ans })).res.status).toBe(200);
  await db("UPDATE wine_requests SET status = 'ready', result = ?1 WHERE id = ?2", JSON.stringify({ draft: { wine: { producer: "Vinar", name: "Vino 2020" } } }), id);
  expect((await at("/api/vina/:id/:action", "POST", `/api/vina/${id}/ispravak`, { params: P("ispravak"),
    body: JSON.stringify({ price_bottle: "99", novo: false, by: "Filho" }) })).res.status).toBe(200);
  expect((await at("/api/vina/:id/:action", "POST", `/api/vina/${id}/objavi`, { params: P("objavi"), body: asFilho })).res.status).toBe(200);
  await db("UPDATE wine_requests SET status = 'failed' WHERE id = ?1", id);
  expect((await at("/api/vina/:id/:action", "POST", `/api/vina/${id}/ponovi`, { params: P("ponovi"), body: asFilho })).res.status).toBe(200);
  await db("UPDATE wine_requests SET status = 'needs_info' WHERE id = ?1", id);
  expect((await at("/api/vina/:id/:action", "POST", `/api/vina/${id}/odustani`, { params: P("odustani"), body: asFilho })).res.status).toBe(200);

  /* Ponuda: send a menu, publish it, retry, cancel, a photo in and out, save, publish and delete the offer */
  const date = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const mf = new FormData(); mf.append("text", "Juha\nObrazi"); mf.append("by", "Filho");
  const { id: did } = await (await at("/api/kuhinja/citaj", "POST", "/api/kuhinja/citaj", { body: mf })).res.json();
  const offer = { title: { hr: "Danas" }, dishes: [{ course: "mains", name: { hr: "Obrazi" }, price: 29, wines: [] }] };
  await db("UPDATE daily_requests SET status = 'ready', result = ?1 WHERE id = ?2", JSON.stringify({ offer }), did);
  const D = (action) => ({ id: did, action });
  expect((await at("/api/kuhinja/citaj/:id/:action", "POST", `/api/kuhinja/citaj/${did}/objavi`, { params: D("objavi"),
    body: JSON.stringify({ offer, by: "Filho" }) })).res.status).toBe(200);
  await db("UPDATE daily_requests SET status = 'failed' WHERE id = ?1", did);
  expect((await at("/api/kuhinja/citaj/:id/:action", "POST", `/api/kuhinja/citaj/${did}/ponovi`, { params: D("ponovi"), body: asFilho })).res.status).toBe(200);
  await db("UPDATE daily_requests SET status = 'ready' WHERE id = ?1", did);
  expect((await at("/api/kuhinja/citaj/:id/:action", "POST", `/api/kuhinja/citaj/${did}/odustani`, { params: D("odustani"), body: asFilho })).res.status).toBe(200);
  const pic = await at("/api/kuhinja/media", "POST", `/api/kuhinja/media?date=${date}`, { body: new Uint8Array([9, 8, 7]), headers: { "content-type": "image/webp" } });
  const mid = (await pic.res.json()).id;
  expect((await at("/api/kuhinja/media/:id", "DELETE", `/api/kuhinja/media/${mid}`, { params: { id: mid } })).res.status).toBe(200);
  for (const status of ["draft", "published"])
    expect((await at("/api/kuhinja/ponuda", "PUT", "/api/kuhinja/ponuda", { body: JSON.stringify({ date, status, ...offer, by: "Filho" }) })).res.status).toBe(200);
  expect((await at("/api/kuhinja/ponuda", "DELETE", `/api/kuhinja/ponuda?date=${date}`)).res.status).toBe(200);

  /* Filho reads it */
  const log = await call(H("GET", "/api/dnevnik"), STAFF, { env });
  expect(log.res.status).toBe(200);
  const { events } = await log.res.json();
  expect(events.map((e) => `${e.area}: ${e.what.split(/[: (]/)[0]}`).sort()).toEqual([
    "ponuda: Dodao", "ponuda: Objavio", "ponuda: Objavio", "ponuda: Obrisao", "ponuda: Obrisao", "ponuda: Odustao",
    "ponuda: Pokrenuo", "ponuda: Poslao", "ponuda: Spremio",
    "vina: Ispravio", "vina: Objavio", "vina: Odgovorio", "vina: Odustao", "vina: Pokrenuo", "vina: Poslao",
  ]);
  expect(events.every((e) => e.who === "Toni" && e.role === "somm"), JSON.stringify(events.filter((e) => e.who !== "Toni"))).toBe(true);
  expect(events.find((e) => /^Ispravio/.test(e.what)).what).toBe("Ispravio: Vinar — Vino 2020 (boca 99 €, NOVO isklj.)");
  /* and the request rows carry his name too */
  expect((await env.DB.prepare("SELECT created_by, published_by FROM wine_people WHERE request_id = ?1").bind(id).first()))
    .toEqual({ created_by: "Toni", published_by: "Toni" });
  expect((await env.DB.prepare("SELECT created_by, published_by FROM daily_requests WHERE id = ?1").bind(did).first()))
    .toEqual({ created_by: "Toni", published_by: "Toni" });
});

test("Filho's own writes are logged under the name his page sends; the log is his to read, never Toni's", async () => {
  const env = envOf();
  const fd = new FormData(); fd.append("text", "Juha"); fd.append("by", "Jure");
  await call(H("POST", "/api/kuhinja/citaj"), STAFF, { env, body: fd });
  const log = await (await call(H("GET", "/api/dnevnik"), STAFF, { env })).res.json();
  expect(log.events.map((e) => [e.who, e.role])).toEqual([["Jure", "full"]]);
  /* Toni: refused by the middleware, and by the function itself */
  const viaMw = await call(H("GET", "/api/dnevnik"), SOMM, { env });
  expect(viaMw.ran).toBe(false);
  expect(viaMw.res.status).toBe(403);
  expect(await viaMw.res.json()).toEqual({ error: "role" });
  const direct = await H("GET", "/api/dnevnik").fn({ request: req("GET", "https://theatrium.devinos.hr/api/dnevnik", SOMM), env });
  expect(direct.status).toBe(401);
  expect(await direct.json()).toEqual({ error: "key" });
  expect(ACCESS["/api/dnevnik"].GET).toEqual(["full"]);
});

test("he can bring a wine back — vrati na kartu — including one Filho hid, a glass-only hide, and an old rule", async () => {
  const w = Object.values(JSON.parse(LIB).wines).find((x) => x.producer);
  gh.files["data/unavailable.json"] = { sha: "U0", text: JSON.stringify({ _: "x", hidden: [
    { producer: w.producer, name: w.name, since: "2026-11-01" },
    { producer: w.producer, name: w.name, where: "glass", since: "2026-11-02" },
    { name: "Staro pravilo" }] }, null, 1) + "\n" };
  /* the glass pour back, the rest stays */
  const step1 = { _: "x", hidden: [{ producer: w.producer, name: w.name, since: "2026-11-01" }, { name: "Staro pravilo" }] };
  const a = await putKarta("data/unavailable.json", step1, "U0", `Vraćeno na kartu: ${w.producer} ${w.name}`);
  expect(a.res.status).toBe(200);
  /* everything back */
  const b = await putKarta("data/unavailable.json", { _: "x", hidden: [] }, "U1", "2 promjene na karti\n\nVraćeno na kartu: A\nVraćeno na kartu: B");
  expect(b.res.status).toBe(200);
  expect(JSON.parse(gh.files["data/unavailable.json"].text).hidden).toEqual([]);
  expect(gh.puts.map((p) => p.message.split("\n")[0])).toEqual([`Vraćeno na kartu: ${w.producer} ${w.name} — Toni`, "2 promjene na karti — Toni"]);
});

/* ---- the way round: a card that carries code ----
   Dodaj vino's run reads text he types and he may publish his own card; a
   card may touch js/i18n.js, which /admin loads. A line of script there
   would run on Filho's /admin with Filho's key in reach. */
test("a card may add vocabulary to the JS files, never code — checked when written and when published", () => {
  const patch = (file, lines) => `diff --git a/${file} b/${file}\nindex 1..2 100644\n--- a/${file}\n+++ b/${file}\n@@ -1,2 +1,3 @@\n context\n${lines.map((l) => "+" + l).join("\n")}\n`;
  /* what card runs have actually written */
  for (const ok of [['    "Nerello Mascalese": "马斯卡斯奈莱洛",'], ["  cherry: \"višnja\", plum: \"šljiva\","], ['    "Tribidrag (Zinfandel)": 1'],
    ["  countries: { HR: \"Hrvatska\", DE: \"Njemačka\" },"], ["    // a note"], [""]]) expect(checkPatch(patch("js/zh-terms.js", ok)), ok[0]).toBe("");
  expect(checkPatch(patch("library/wines.json", ["anything at all in a data file"]))).toBe("");
  /* 2026-11-25: a spirit card adds its class word to js/spirits.js, under the same rule */
  expect(checkPatch(patch("js/spirits.js", ["    blended_irish: \"Irski viski · blended\","]))).toBe("");
  expect(checkPatch(patch("js/spirits.js", ["window.x = 1;"]))).not.toBe("");
  expect(checkPatch(patch("js/spirits.js", ["  calvados_pays_dauge: \"snifter\",   /* shares the cognac shelf */"]))).toBe("");
  expect(checkPatch(patch("js/spirits.js", ["  a: \"b\", /* x */ fetch(1) /* y */"]))).not.toBe("");
  /* what an injection would need */
  for (const bad of [["  x: \"a\", y: (() => 1)(),"], ["evil: fetch(\"//x\"),"], ["\"a\": \"b\" + document.cookie,"], ["}); fetch(1); ({"],
    ["a: `x${1}`,"], ["/* opens", "*/ fetch(1); /*", "x */"], ["  a: \"b\", // trailing"], ["window.x = 1;"], ["}"]])
    expect(checkPatch(patch("js/i18n.js", bad)), bad.join(" | ")).not.toBe("");
  for (const file of ["js/admin.js", "web/functions/_lib/roles.js", ".github/workflows/deploy-web.yml", "admin.html"])
    expect(checkPatch(patch(file, ['"a": "b",'])), file).toMatch(/touches/);
  expect(checkPatch("diff --git a/js/i18n.js b/js/i18n.js\nold mode 100644\nnew mode 100755\n")).not.toBe("");
  /* and both workflows run it */
  expect(fs.readFileSync(path.join(ROOT, ".github/workflows/add-wine.yml"), "utf8")).toMatch(/node scripts\/check-card-patch\.mjs out\/card\.patch\n\s+git apply/);
  expect(fs.readFileSync(path.join(ROOT, ".github/workflows/publish-wine.yml"), "utf8")).toMatch(/git diff HEAD > "\$RUNNER_TEMP\/publish\.patch"\n\s+node scripts\/check-card-patch\.mjs/);
});

/* ---- Filho, unchanged ---- */
test("full keys still reach every function that is theirs, through both locks", async () => {
  for (const h of HANDLERS) {
    if (!roles(h).includes("full") || h.method === "OPTIONS") continue;
    for (const key of [STAFF, GHKEY]) {
      const env = envOf({ WINE_INTAKE_ENABLED: "0" });
      const body = ["GET", "HEAD", "DELETE"].includes(h.method) ? undefined : "{}";
      const { res, ran } = await call(h, key, { env, body, headers: { "content-type": "application/json" } });
      expect(ran, `${h.method} ${h.route}`).toBe(true);
      expect([401, 403], `${h.method} ${h.route} refused ${key === STAFF ? "STAFF_KEY" : "Filho's GitHub key"}`).not.toContain(res.status);
    }
  }
});

/* The Dodaj vino queue (2026-10-23). Filho queued ten wines at once; two
   pumps raced, each claimed a different wine, both dispatched, and GitHub's
   concurrency group cancelled one pending run — its wine sat "working" with
   nobody on it, to be failed 40 min later. Guards, on the real pump() over
   the real schema (node:sqlite standing in for D1):
   - two pumps at once never start more than PARALLEL (2) wines, and never
     the same wine twice; each start names a Claude account;
   - a wine Filho has answered goes before every new bottle;
   - a claimed wine that never reported a step goes back to its place, the
     try not counted;
   - a run that died part-way is re-queued, failed only when MAX_RUNS is spent. */
import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

test("the wine queue never strands or expires a wine", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("web/schema.sql", "utf8"));
  const D1 = { prepare(sql) { const st = db.prepare(sql); let a = []; const o = {
    bind(...x) { a = x.map((v) => (v === undefined ? null : v)); return o; },
    all: async () => ({ results: st.all(...a) }), first: async () => st.get(...a) ?? null,
    run: async () => ({ meta: { changes: st.run(...a).changes } }) };
    return o; } };
  const { pump } = await import(pathToFileURL(join(process.cwd(), "web/functions/_lib/wines.js")).href);
  const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
  const ins = db.prepare("INSERT INTO wine_requests (id, created_at, updated_at, status, price_bottle, runs) VALUES (?, ?, ?, ?, 100, ?)");
  const steps = (id, n) => db.prepare("INSERT INTO wine_progress (request_id, steps) VALUES (?, ?)")
    .run(id, JSON.stringify(Array.from({ length: n }, (_, i) => ({ t: "s" + i, at: ago(20) }))));
  ins.run("lost", ago(30), ago(20), "working", 1); steps("lost", 1);
  ins.run("q1", ago(25), ago(25), "queued", 0);
  ins.run("q2", ago(5), ago(5), "queued", 0);
  ins.run("answered", ago(3), ago(1), "queued", 1);
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, init) => { calls.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); };
  try {
    const env = { DB: D1, WINE_INTAKE_ENABLED: "1", GH_DISPATCH_TOKEN: "x" };
    await Promise.all([pump(env), pump(env)]);
    const rows = Object.fromEntries(db.prepare("SELECT id, status, runs FROM wine_requests").all().map((r) => [r.id, { ...r }]));
    expect(calls, "two wines at once, not three").toHaveLength(2);
    expect(new Set(calls.map((c) => c.inputs.id)).size, "never the same wine twice").toBe(2);
    for (const c of calls) expect(["1", "2"]).toContain(c.inputs.account);
    expect(rows.answered, "an answered wine goes first").toMatchObject({ status: "working", runs: 2 });
    expect(rows.lost, "the lost wine kept its place and its try was not counted").toMatchObject({ status: "working", runs: 1 });
    expect(rows.q1.status).toBe("queued");
    expect(rows.q2.status).toBe("queued");

    /* one finishes: the next start fills exactly that slot, on the other account */
    db.prepare("UPDATE wine_requests SET status = 'ready' WHERE id = 'answered'").run();
    calls.length = 0;
    await pump(env);
    expect(calls).toHaveLength(1);
    expect(calls[0].inputs.id).toBe("q1");

    db.exec("DELETE FROM wine_requests; DELETE FROM wine_progress;");
    ins.run("dead", ago(60), ago(45), "working", 2); steps("dead", 3);
    ins.run("spent", ago(60), ago(45), "working", 5); steps("spent", 3);
    await pump({ ...env, WINE_INTAKE_ENABLED: "0" });
    const after = Object.fromEntries(db.prepare("SELECT id, status FROM wine_requests").all().map((r) => [r.id, r.status]));
    expect(after).toEqual({ dead: "queued", spent: "failed" });
  } finally { globalThis.fetch = realFetch; }
});

test("a publish GitHub cancelled before it ran is started again, never left 'publishing'", async () => {
  /* 2026-11-17: three "Objavi" taps in nine seconds; the concurrency group
     cancelled the pending middle run, and its wine sat "publishing" for good.
     Also: a publish that died part-way goes back to "Objavi" with a message,
     never published blind. Added with the fix, not run (standing rule). */
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync("web/schema.sql", "utf8"));
  const D1 = { prepare(sql) { const st = db.prepare(sql); let a = []; const o = {
    bind(...x) { a = x.map((v) => (v === undefined ? null : v)); return o; },
    all: async () => ({ results: st.all(...a) }), first: async () => st.get(...a) ?? null,
    run: async () => ({ meta: { changes: st.run(...a).changes } }) };
    return o; } };
  const { pump } = await import(pathToFileURL(join(process.cwd(), "web/functions/_lib/wines.js")).href);
  const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
  const ins = db.prepare("INSERT INTO wine_requests (id, created_at, updated_at, status, price_bottle, runs) VALUES (?, ?, ?, ?, 100, 1)");
  const steps = (id, n) => db.prepare("INSERT INTO wine_progress (request_id, steps) VALUES (?, ?)")
    .run(id, JSON.stringify(Array.from({ length: n }, (_, i) => ({ t: "s" + i, at: ago(20) }))));
  ins.run("cancelled", ago(60), ago(20), "publishing"); steps("cancelled", 1);   /* only "Pokreće objavu" */
  ins.run("running", ago(60), ago(1), "publishing"); steps("running", 1);         /* tapped a minute ago */
  ins.run("died", ago(90), ago(45), "publishing"); steps("died", 4);              /* got as far as merging */
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, init) => { calls.push({ u: String(u), body: JSON.parse(init.body) }); return new Response(null, { status: 204 }); };
  try {
    await pump({ DB: D1, WINE_INTAKE_ENABLED: "1", GH_DISPATCH_TOKEN: "x" });
    const st = Object.fromEntries(db.prepare("SELECT id, status, error FROM wine_requests").all().map((r) => [r.id, { ...r }]));
    const pubs = calls.filter((c) => /publish-wine/.test(c.u)).map((c) => c.body.inputs.id);
    expect(pubs, "only the cancelled one is dispatched again").toEqual(["cancelled"]);
    expect(st.cancelled.status).toBe("publishing");
    expect(st.running.status, "a publish in flight is left alone").toBe("publishing");
    expect(st.died.status).toBe("ready");
    expect(st.died.error).toMatch(/pokušajte ponovno/);
  } finally { globalThis.fetch = realFetch; }
});

test("the publish run merges onto main as it is when it runs", () => {
  const wf = readFileSync(".github/workflows/publish-wine.yml", "utf8");
  expect(wf).toMatch(/uses: actions\/checkout@v4\s+with:\s+ref: main/);
  expect(wf).toMatch(/git rebase -q origin\/main/);
});

/* 2026-11-20, El Molar 2021: Filho gave a bottle price only. The run's
   preview said "Crna vina po boci → Španjolska, iza Casa Rojo CL98", and the
   card inserted the listing after the *glass* CL98 — CL98 is on both shelves.
   It went live at 75 € a glass. The placement is now read from the files and
   a listing that does not match Filho's prices stops the card and the publish. */
test("a card's listings must match the prices Filho gave", async () => {
  const { placementProblems, describe } = await import(pathToFileURL(join(process.cwd(), "scripts/card-placement.mjs")).href);
  const shelf = (id, cat, items, country = null) => ({ id, categories: [{ id: cat, groups: [{ country, items }] }] });
  const cl98g = { ref: "casa-rojo--cl98-2020", price: 10 }, cl98b = { ref: "casa-rojo--cl98-2020", price: 68 };
  const molar = { ref: "x--el-molar", price: 75, new: true };
  const base = { sections: [shelf("glass", "red", [cl98g]), shelf("bottle-red", "red", [cl98b], "ES")] };
  const wrong = { sections: [shelf("glass", "red", [cl98g, molar]), shelf("bottle-red", "red", [cl98b], "ES")] };
  const right = { sections: [shelf("glass", "red", [cl98g]), shelf("bottle-red", "red", [cl98b, molar], "ES")] };
  const prices = { priceBottle: 75, priceGlass: null };
  expect(placementProblems({ base, list: wrong, ref: "x--el-molar", ...prices })).toHaveLength(2);
  expect(placementProblems({ base, list: right, ref: "x--el-molar", ...prices })).toEqual([]);
  expect(placementProblems({ base, list: right, ref: "x--el-molar", priceBottle: 75, priceGlass: 9 })).toHaveLength(1);
  /* already listed by the glass: a new bottle beside it is fine */
  expect(placementProblems({ base: wrong, list: { sections: [shelf("glass", "red", [cl98g, molar]), shelf("bottle-red", "red", [cl98b, molar], "ES")] },
    ref: "x--el-molar", priceBottle: 75, priceGlass: 9 })).toEqual([]);
  expect(describe(base, wrong, "x--el-molar")).toMatch(/^Vina na čašu/);
  expect(describe(base, right, "x--el-molar", {}, { ES: "Španjolska" })).toMatch(/^Crna vina po boci → Španjolska, iza casa-rojo--cl98-2020/);

  const add = readFileSync(".github/workflows/add-wine.yml", "utf8");
  expect(add).toContain("node scripts/card-placement.mjs --base");
  expect(add).toContain("--result out/result.json --write");
  expect(add).toContain("Bash(node scripts/card-placement.mjs)");
  const pub = readFileSync(".github/workflows/publish-wine.yml", "utf8");
  expect(pub).toContain("node scripts/card-placement.mjs --base HEAD");
  expect(pub).toMatch(/A price Filho cleared on the preview takes its listing with it/);
});

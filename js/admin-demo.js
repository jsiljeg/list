/* The demo /admin (owner, 2026-10-18): admin.html?demo shows a venue the
 * whole staff side with invented data, so it can be shown to anyone.
 *
 * Inert unless the address carries ?demo. When it does, this runs before the
 * admin's own scripts and answers EVERY request they make to GitHub and to
 * theatrium.devinos.hr itself — nothing is sent anywhere, no key is needed or
 * read, and a change lives in this tab until it is reloaded. The data is
 * demo/*.json, written on each deploy by scripts/make-demo.mjs from the real
 * server code over an invented database: no bill, receipt, price paid, guest,
 * company or waiter in it is Theatrium's. What IS real is public anyway: the
 * wine list, the menu, the till's article names.
 *
 * The isolation is the point, so it is total rather than clever: an address
 * this file does not recognise on either host is answered with an error, never
 * passed through. */
(function () {
  "use strict";
  if (!new URLSearchParams(location.search).has("demo")) return;
  window.ADMIN_DEMO = true;

  const realFetch = window.fetch.bind(window);
  const LS_KEY = "theatrium-admin-token", DEMO_KEY = "github_pat_DEMO_DEMO_DEMO_DEMO_DEMO_DEMO";
  /* the admin reads its key from localStorage; the demo hands it a dummy and never stores one */
  const gi = Storage.prototype.getItem, si = Storage.prototype.setItem, ri = Storage.prototype.removeItem;
  Storage.prototype.getItem = function (k) { return k === LS_KEY ? DEMO_KEY : gi.call(this, k); };
  Storage.prototype.setItem = function (k, v) { if (k !== LS_KEY) si.call(this, k, v); };
  Storage.prototype.removeItem = function (k) { if (k !== LS_KEY) ri.call(this, k); };
  if (navigator.sendBeacon) navigator.sendBeacon = () => true;

  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const nowIso = () => new Date().toISOString();
  const b64 = (s) => { const b = new TextEncoder().encode(s); let o = ""; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(o); };
  const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const later = (ms, f) => setTimeout(f, ms);

  /* ---------- state: loaded once, changed in memory ---------- */
  const files = {};                 /* repo path → text, as GitHub would hold it */
  let sha = 0;
  const ready = (async () => {
    const get = (p) => realFetch(p, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(p + " " + r.status); return r; });
    const [tr, pr, tv, vi, po, una, lst, tm, bm] = await Promise.all([
      get("demo/troskovi.json").then((r) => r.json()), get("demo/prihodi.json").then((r) => r.json()),
      get("demo/tvrtke.json").then((r) => r.json()), get("demo/vina.json").then((r) => r.json()),
      get("demo/povijest.json").then((r) => r.json()).catch(() => ({ events: [] })),
      get("data/unavailable.json").then((r) => r.text()), get("lists/theatrium.json").then((r) => r.text()),
      get("data/till-map.json").then((r) => r.text()), get("demo/buy-map.json").then((r) => r.text()).catch(() => '{"articles":{}}')]);
    /* tonight's 86 board starts with a few, not whatever Theatrium has hidden today */
    let rules = []; try { rules = (JSON.parse(una).hidden || []).slice(0, 4); } catch { /* none */ }
    files["data/unavailable.json"] = JSON.stringify({ hidden: rules }, null, 1) + "\n"; files["lists/theatrium.json"] = lst;
    /* a receipt "being read" finishes as one would */
    for (const r of tr.items.filter((x) => x.status === "working")) later(9000, () => Object.assign(r, { status: "done", updated_at: nowIso(),
      vendor: "Pekara Primjer", doc_date: nowIso().slice(0, 10), doc_no: "12-1-1", total: 23.4, vat: 2.69, payment: "gotovina",
      items: [{ name: "Kruh od kiselog tijesta", key: "Kruh od kiselog tijesta", qty: 12, unit: "kom", unit_price: 1.95, total: 23.4, category: "pekara" }] }));
    files["data/till-map.json"] = tm; files["data/buy-map.json"] = bm;
    return { receipts: tr.items, limits: tr.limits, mer: tr.mer, prihodi: pr, tvrtke: tv, vina: vi.items || [], vinaLimits: vi.limits, povijest: po,
      citaj: [], offer: null };
  })();

  /* ---------- pictures: a drawn receipt or label, never a photo ---------- */
  function svg(kind, id) {
    const label = kind === "label";
    const lines = label ? "" : [...Array(9)].map((_, i) => `<rect x="30" y="${120 + i * 34}" width="${120 + ((i * 37) % 110)}" height="10" rx="3" fill="#bbb"/><rect x="270" y="${120 + i * 34}" width="60" height="10" rx="3" fill="#999"/>`).join("");
    const body = label
      ? `<rect width="360" height="480" fill="#2a2420"/><rect x="60" y="80" width="240" height="320" rx="8" fill="#efe6d2"/><text x="180" y="210" text-anchor="middle" font-family="Georgia" font-size="30" fill="#5a3d2b">DEMO</text><text x="180" y="250" text-anchor="middle" font-family="Georgia" font-size="16" fill="#5a3d2b">etiketa vina</text>`
      : `<rect width="360" height="480" fill="#d9d4cc"/><rect x="15" y="20" width="330" height="440" fill="#fdfcf8"/><text x="180" y="70" text-anchor="middle" font-family="monospace" font-size="20" fill="#333">DEMO RAČUN</text><text x="180" y="95" text-anchor="middle" font-family="monospace" font-size="11" fill="#777">${String(id).slice(-10)}</text>${lines}<rect x="30" y="430" width="300" height="2" fill="#333"/>`;
    return new Response(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480">${body}</svg>`, { headers: { "content-type": "image/svg+xml" } });
  }

  /* ---------- GitHub: the repo's files, kept in memory ---------- */
  async function github(url, opts) {
    const u = new URL(url), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/), method = (opts && opts.method) || "GET";
    if (u.pathname === "/user") return json({ login: "demo" });
    if (/\/commits$/.test(u.pathname)) return json([]);
    if (!m || !(m[1] in files)) return json({ message: "Not Found (demo)" }, 404);
    const p = decodeURIComponent(m[1]);
    if (method === "PUT") {
      const b = JSON.parse(opts.body);
      files[p] = unb64(b.content);
      return json({ content: { sha: "demo" + ++sha, path: p }, commit: { sha: "demo" + sha, message: b.message } });
    }
    return json({ sha: "demo" + sha, path: p, content: b64(files[p]), encoding: "base64" });
  }

  /* ---------- the venue's own server ---------- */
  const emptyMonth = (m) => ({ month: m, months: [], days: [], pays: [], groups: [], taxes: [], custs: [], items: [], weekdays: [], dayparts: [],
    leaks: [], waiters: [], staff: [], staffBy: "karta", ownTable: [], guests: [], state: {} });
  const DEMO_REFS = ["petrac--enigma-2019", "matosevic--grimalda-crna-2021", "tomac--blanc-de-noirs"];
  function demoOffer() {
    const n = (hr, en) => ({ hr, en, it: en, fr: en, de: en, zh: en, sl: hr, es: en });
    return { title: n("Dnevna ponuda", "Today's specials"), intro: n("Iz današnje tržnice.", "From today's market."), video: "", photos: [],
      dishes: [
        { course: "starters", name: n("Carpaccio od brancina s koromačem", "Sea bass carpaccio with fennel"), description: n("", ""), price: 16, pairings: ["white_fish"], styles: ["white_mineral"], wines: [DEMO_REFS[2]], photo: "" },
        { course: "mains", name: n("Teleći obrazi s pireom od celera", "Veal cheeks with celeriac purée"), description: n("", ""), price: 29, pairings: ["veal", "beef"], styles: ["red_full"], wines: [DEMO_REFS[0], DEMO_REFS[1]], photo: "" }] };
  }

  async function server(url, opts) {
    const st = await ready;
    const u = new URL(url), p = u.pathname, q = u.searchParams, method = (opts && opts.method) || "GET";
    let b = {};
    if (opts && typeof opts.body === "string") { try { b = JSON.parse(opts.body); } catch { /* not JSON */ } }
    let mm;

    /* Troškovi */
    if (p === "/api/troskovi" && method === "GET") {
      const off = Number(q.get("offset") || 0), lim = Number(q.get("limit") || 150), page = st.receipts.slice(off, off + lim);
      return json(off ? { items: page, more: off + lim < st.receipts.length }
        : { items: page, more: lim < st.receipts.length, total: st.receipts.length, limits: st.limits, pumped: null, mer: st.mer });
    }
    if (p === "/api/troskovi" && method === "POST") {
      const manual = typeof (opts && opts.body) === "string";
      const id = nowIso().slice(0, 10).replace(/-/g, "") + "-demo" + Math.random().toString(16).slice(2, 8);
      const it = { id, created_at: nowIso(), updated_at: nowIso(), created_by: "Demo", status: manual ? "done" : "working", runs: 1,
        vendor: manual ? b.vendor || "Bez računa" : "", vendor_oib: "", doc_date: manual ? b.doc_date : "", doc_no: "", total: manual ? (b.items || []).reduce((a, i) => a + Number(String(i.total).replace(",", ".") || 0), 0) : null,
        vat: null, payment: manual ? b.payment || "gotovina" : "", items: manual ? (b.items || []).map((i) => ({ name: i.name, total: Number(String(i.total).replace(",", ".") || 0), category: i.category || "ostalo" })) : [],
        note: "", error: "", photos: manual ? [] : [1], source: manual ? "rucno" : "foto", dup_of: "", due_date: "", paid_at: "" };
      st.receipts.unshift(it);
      /* a photo is "read" in a few seconds, as it would be in a minute or two */
      if (!manual) later(6000, () => Object.assign(it, { status: "done", updated_at: nowIso(), vendor: "Tržnica Primjer obrt", doc_date: nowIso().slice(0, 10),
        doc_no: "77-1-1", total: 48.6, vat: 5.59, payment: "gotovina", note: "Demo: pročitano za nekoliko sekundi.",
        items: [{ name: "Rajčica", key: "Rajčica", qty: 6, unit: "kg", unit_price: 2.4, total: 14.4, category: "povrce" },
                { name: "Šparoge", key: "Šparoge", qty: 3, unit: "kg", unit_price: 9, total: 27, category: "povrce" },
                { name: "Začinsko bilje", key: "Začinsko bilje", qty: 4, unit: "kom", unit_price: 1.8, total: 7.2, category: "povrce" }] }));
      return json({ ok: true, item: it });
    }
    if ((mm = p.match(/^\/api\/troskovi\/([^/]+)\/foto\/(\d+)$/))) return svg("receipt", mm[1]);
    if (p === "/api/troskovi/povijest") return json(st.povijest);
    if (p.startsWith("/api/troskovi/") && /mer|kljucevi/.test(p)) return json({ ok: true, items: [], keys: [] });
    if ((mm = p.match(/^\/api\/troskovi\/([^/]+)\/([a-z_]+)$/))) {
      const i = st.receipts.findIndex((r) => r.id === mm[1]), it = st.receipts[i];
      if (!it) return json({ error: "not_found" }, 404);
      const a = mm[2];
      if (a === "obrisi") { st.receipts.splice(i, 1); return json({ ok: true }); }
      if (a === "placeno") it.paid_at = b.paid ? nowIso().slice(0, 10) : "ne";
      if (a === "kategorija" && it.items[b.i]) it.items[b.i].category = b.category;
      if (a === "ispravi") Object.assign(it, ...["vendor", "doc_date", "total"].filter((k) => b[k] != null).map((k) => ({ [k]: b[k] })));
      if (a === "nije_isti") it.dup_of = "";
      if (a === "ponovi") { it.status = "working"; later(5000, () => { it.status = "done"; it.error = ""; }); }
      it.updated_at = nowIso();
      return json({ ok: true, item: it });
    }

    /* Prihodi */
    if (p === "/api/prihodi/tvrtke") {
      if (method === "PUT") return json({ ok: true, note: b.note, updated_at: nowIso() });
      return json(st.tvrtke);
    }
    if (p === "/api/prihodi") { const m = q.get("mjesec"); return json(st.prihodi[m] || emptyMonth(m)); }

    /* Dodaj vino */
    if (p === "/api/vina" && method === "GET") return json({ items: st.vina, limits: st.vinaLimits || { enabled: true, today: 1, dailyCap: 10, month: 3, monthlyCap: 60 }, pumped: null });
    if (p === "/api/vina" && method === "POST") {
      const tpl = st.vina.find((v) => v.status === "ready");
      const it = { ...JSON.parse(JSON.stringify(tpl || {})), id: nowIso().slice(0, 10).replace(/-/g, "") + "-demo" + Math.random().toString(16).slice(2, 14),
        status: "working", created_at: nowIso(), updated_at: nowIso(), created_by: "Demo", progress: [{ t: "Čita etiketu", at: nowIso() }] };
      st.vina.unshift(it);
      later(5000, () => it.progress.push({ t: "Istražuje vino i piše karticu", at: nowIso() }));
      later(11000, () => Object.assign(it, { status: "ready", updated_at: nowIso() }));
      return json({ ok: true, item: it });
    }
    if ((mm = p.match(/^\/api\/vina\/([^/]+)\/foto\/(\d+)$/))) return svg("label", mm[1]);
    if ((mm = p.match(/^\/api\/vina\/([^/]+)\/([a-z_]+)$/))) {
      const it = st.vina.find((v) => v.id === mm[1]);
      if (!it) return json({ error: "not_found" }, 404);
      const a = mm[2], tpl = st.vina.find((v) => v.result);
      if (a === "odgovor") { it.status = "working"; it.progress = [{ t: "Odgovori primljeni", at: nowIso() }];
        later(6000, () => Object.assign(it, { status: "ready", result: it.result || (tpl && tpl.result), questions: [] })); }
      if (a === "objavi") { it.status = "publishing"; it.progress = [{ t: "Objavljuje na karti", at: nowIso() }];
        later(5000, () => Object.assign(it, { status: "published", published_at: nowIso() })); }
      if (a === "odustani") it.status = "cancelled";
      if (a === "ponovi") it.status = "working";
      it.updated_at = nowIso();
      return json({ ok: true, item: it });
    }

    /* Dnevna ponuda */
    if (p === "/api/kuhinja/citaj" && method === "GET") return json({ items: st.citaj, limits: { enabled: true, today: st.citaj.length, dailyCap: 5, month: st.citaj.length + 6, monthlyCap: 60 }, today: nowIso().slice(0, 10) });
    if (p === "/api/kuhinja/citaj" && method === "POST") {
      const it = { id: "demo-" + Date.now(), status: "working", created_at: nowIso(), updated_at: nowIso(), date: nowIso().slice(0, 10), result: null, error: "" };
      st.citaj.unshift(it);
      later(8000, () => Object.assign(it, { status: "ready", updated_at: nowIso(), result: { offer: demoOffer(), notes: "", dropped: [] } }));
      return json({ ok: true, item: it });
    }
    if ((mm = p.match(/^\/api\/kuhinja\/citaj\/([^/]+)\/([a-z_]+)$/))) {
      const it = st.citaj.find((x) => x.id === mm[1]);
      if (it && mm[2] === "objavi") { it.status = "published"; st.offer = { ...(b.offer || demoOffer()), status: "published", date: nowIso().slice(0, 10) }; }
      if (it && mm[2] === "odustani") it.status = "cancelled";
      return json({ ok: true, item: it });
    }
    if (p === "/api/kuhinja/ponuda") {
      if (method === "PUT") { st.offer = { ...b }; return json({ ok: true }); }
      return json({ date: nowIso().slice(0, 10), offer: st.offer, recent: [] });
    }
    if (p === "/api/dnevna-ponuda") return json({ date: nowIso().slice(0, 10), offer: st.offer && st.offer.status === "published" ? st.offer : null });
    return json({ error: "demo: not served" }, 404);
  }

  window.fetch = async function (input, opts) {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.hostname === "api.github.com") return github(url.href, opts);
    if (url.hostname.endsWith("devinos.hr") && url.hostname !== location.hostname) return server(url.href, opts);
    if (url.origin === location.origin) {
      /* the 86 board checks its write landed by re-reading the published file */
      const local = url.pathname.replace(/^\//, "");
      if (local === "data/unavailable.json" || local === "lists/theatrium.json") { await ready; return new Response(files[local], { headers: { "content-type": "application/json" } }); }
      return realFetch(input, opts);
    }
    return json({ error: "demo: no outside requests" }, 403);
  };

  /* no PIN, no key: straight in, with a banner saying what this is */
  addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.className = "demo-bar";
    bar.innerHTML = "<b>DEMO</b> — svi podaci su izmišljeni, ništa se ne sprema i nigdje ne šalje. Osvježavanje stranice vraća sve na početak.";
    document.body.prepend(bar);
    document.title = "Demo · osoblje";
  });
  addEventListener("load", () => {
    if (typeof window.afterPin === "function") window.afterPin();
    document.querySelectorAll("h1").forEach((h) => { h.textContent = h.textContent.replace(/Theatrium/, "Demo restoran"); });
    /* the page names whoever's key it holds; the demo holds nobody's */
    const who = document.getElementById("who");
    const fix = () => { if (who && who.textContent !== "Demo") who.textContent = "Demo"; };
    fix(); setTimeout(fix, 500); setTimeout(fix, 2000);
  });
})();

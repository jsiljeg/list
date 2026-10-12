/* Troškovi — Filho's receipts, read and sorted so he can see where the money
 * goes (owner, 2026-10-11). Shared by every /api/troskovi endpoint. Design and
 * reasons: web/EXPENSES.md.
 *
 * Confidential by construction:
 *   - photos and what is read from them live in this D1 database only;
 *   - they are read in a PRIVATE repository's Actions run (EXPENSE_REPO),
 *     never in the public wine-list repo, whose logs and artifacts anyone can
 *     open; that run keeps nothing and prints no contents;
 *   - staff read with the same GitHub key as the rest of /admin; the run
 *     reports with EXPENSE_WORKER_KEY, which can do nothing else.
 *
 * Brakes, because every run spends the owner's Claude subscription: one run
 * at a time, up to BATCH receipts per run, DAILY_RUNS / MONTHLY_RUNS runs,
 * MAX_TRIES per receipt. */
import { reply, isStaffAsync } from "./wines.js";

export { reply, isStaffAsync };
export const BATCH = 8;
export const DAILY_RUNS = 12;
export const MONTHLY_RUNS = 200;
export const MAX_TRIES = 3;
export const MAX_PHOTOS = 4;           /* one long receipt can take several */
export const PHOTO_MAX = 1_500_000;
export const PHOTO_TYPES = ["image/jpeg", "image/webp", "image/png"];
const STALE_MIN = 30;
const REPO = "jsiljeg/theatrium-troskovi";
const WORKFLOW = "read-receipts.yml";

export const nowIso = () => new Date().toISOString();
export const zagrebDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(new Date());
export const clip = (v, max) => String(v ?? "").trim().slice(0, max);
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

function same(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export function isExpenseWorker(request, env) {
  const got = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return same(got, env && env.EXPENSE_WORKER_KEY);
}

export function newId() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return zagrebDate().replace(/-/g, "") + "-" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function shape(row, photos = []) {
  return {
    id: row.id, created_at: row.created_at, updated_at: row.updated_at, created_by: row.created_by || "",
    status: row.status, runs: row.runs, vendor: row.vendor || "", vendor_oib: row.vendor_oib || "",
    doc_date: row.doc_date || "", doc_no: row.doc_no || "", total: row.total, vat: row.vat,
    payment: row.payment || "", items: parse(row.items, []), note: row.note || "", error: row.error || "", photos,
    /* foto: photographed and read · mer: an e-invoice from moj-eRačun ·
       rucno: typed in by hand, paid with no receipt (cash at the market, a
       repairman) — tracked on its own, since nothing documents it */
    source: row.source || "foto", dup_of: row.dup_of || "",
    /* paid: a receipt paid by card or cash is paid by being a receipt; one
       "na virman" waits until Filho marks it (paid_at, a Zagreb date) */
    due_date: row.due_date || "", paid_at: row.paid_at || "",
  };
}

/* A hand-typed expense (Filho, 2026-10-12: "staviti račun plaćen gotovinom
   ali bez slike jer nema uvijek računa"). Lines are a description and an
   amount; the total is their sum. → fields for expense_receipts, or {error}. */
export function cleanManual(b) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.doc_date || "") ? b.doc_date : zagrebDate();
  if (date > zagrebDate()) return { error: "date" };
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 60).map((it) => ({
    name: clip(it && it.name, 120),
    key: "", qty: null, unit: "", unit_price: null,
    total: num(String((it && it.total) ?? "").replace(",", ".")),
    category: CATEGORIES.includes(it && it.category) ? it.category : "ostalo",
    fixed: true,
  })).filter((it) => it.total != null && it.total !== 0);
  if (!items.length) return { error: "no_amount" };
  const vendor = clip(b.vendor, 120) || items[0].name;
  return { fields: {
    vendor, doc_date: date, payment: ["gotovina", "kartica", "virman"].includes(b.payment) ? b.payment : "gotovina",
    total: Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100, vat: null,
    items: JSON.stringify(items), note: clip(b.note, 300),
  } };
}

export async function readReceipt(env, id) {
  const row = await env.DB.prepare("SELECT * FROM expense_receipts WHERE id = ?1").bind(id).first();
  if (!row) return null;
  const { results } = await env.DB.prepare("SELECT n FROM expense_photos WHERE receipt_id = ?1 ORDER BY n").bind(id).all();
  return shape(row, (results || []).map((p) => p.n));
}

export async function setFields(env, id, fields) {
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `${k} = ?${i + 2}`).concat(`updated_at = ?${keys.length + 2}`);
  await env.DB.prepare(`UPDATE expense_receipts SET ${sets.join(", ")} WHERE id = ?1`)
    .bind(id, ...keys.map((k) => fields[k]), nowIso()).run();
}

export async function savePhotos(env, id, files) {
  let n = 0;
  for (const f of files) {
    if (!PHOTO_TYPES.includes(f.type)) return { error: "photo_type" };
    if (f.size > PHOTO_MAX) return { error: "photo_too_big" };
    n += 1;
    await env.DB.prepare("INSERT INTO expense_photos (receipt_id, n, mime, bytes, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(id, n, f.type, await f.arrayBuffer(), nowIso()).run();
  }
  return { ok: true };
}

export async function limits(env) {
  const day = zagrebDate(), month = day.slice(0, 7);
  const r = await env.DB.prepare(
    `SELECT SUM(CASE WHEN date = ?1 THEN 1 ELSE 0 END) AS today,
            SUM(CASE WHEN substr(date, 1, 7) = ?2 THEN 1 ELSE 0 END) AS month FROM expense_dispatches`).bind(day, month).first();
  return { today: (r && r.today) || 0, dailyCap: DAILY_RUNS, month: (r && r.month) || 0, monthlyCap: MONTHLY_RUNS,
           ready: !!(env.EXPENSE_DISPATCH_TOKEN || env.GH_DISPATCH_TOKEN) && !!env.EXPENSE_WORKER_KEY };
}

/* Start a run for the oldest waiting receipts, if every brake allows it.
   Called after an upload and on every staff read, so receipts held back by a
   cap start by themselves later. A batch silent for STALE_MIN is presumed dead:
   its receipts go back in line, or fail after MAX_TRIES. */
export async function pump(env) {
  const stale = new Date(Date.now() - STALE_MIN * 60000).toISOString();
  await env.DB.prepare(
    `UPDATE expense_receipts SET status = CASE WHEN runs >= ?3 THEN 'failed' ELSE 'queued' END,
            error = CASE WHEN runs >= ?3 THEN 'Čitanje nije uspjelo — pokušajte s jasnijom slikom.' ELSE error END,
            batch = NULL, updated_at = ?1
      WHERE status = 'working' AND updated_at < ?2`).bind(nowIso(), stale, MAX_TRIES).run();
  const token = env.EXPENSE_DISPATCH_TOKEN || env.GH_DISPATCH_TOKEN;
  if (!token || !env.EXPENSE_WORKER_KEY) return { held: "not_set_up" };
  if (await env.DB.prepare("SELECT id FROM expense_receipts WHERE status = 'working' LIMIT 1").first()) return { held: "busy" };
  const l = await limits(env);
  if (l.today >= DAILY_RUNS) return { held: "daily_cap" };
  if (l.month >= MONTHLY_RUNS) return { held: "monthly_cap" };
  const { results } = await env.DB.prepare(
    "SELECT id FROM expense_receipts WHERE status = 'queued' ORDER BY created_at LIMIT ?1").bind(BATCH).all();
  if (!results || !results.length) return { held: "empty" };
  const batch = newId(), ids = results.map((r) => r.id);
  for (const id of ids) {
    await env.DB.prepare(
      "UPDATE expense_receipts SET status = 'working', batch = ?2, runs = runs + 1, error = '', updated_at = ?3 WHERE id = ?1 AND status = 'queued'")
      .bind(id, batch, nowIso()).run();
  }
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json",
               "x-github-api-version": "2022-11-28", "user-agent": "theatrium-troskovi" },
    body: JSON.stringify({ ref: "main", inputs: { batch } }),
  });
  if (r.status !== 204) {
    await env.DB.prepare("UPDATE expense_receipts SET status = 'queued', batch = NULL, runs = runs - 1, error = ?2 WHERE batch = ?1")
      .bind(batch, `github_${r.status}`).run();
    return { held: `github_${r.status}` };
  }
  await env.DB.prepare("INSERT INTO expense_dispatches (at, date, batch, n) VALUES (?1, ?2, ?3, ?4)")
    .bind(nowIso(), zagrebDate(), batch, ids.length).run();
  return { started: batch, n: ids.length };
}

/* What the reader may write back, cleaned. Categories are a closed list; an
   unknown one becomes "ostalo" rather than a new heading nobody chose. */
export const CATEGORIES = ["meso", "riba", "povrce", "mlijecno", "suha", "pekara",
  "vino", "zestoko", "pivo_sokovi", "kava",
  "ciscenje", "ambalaza", "oprema", "odrzavanje", "rezije", "usluge", "dekor", "ostalo"];
const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
export function cleanItems(items) {
  return (Array.isArray(items) ? items : []).slice(0, 200).map((it) => ({
    name: clip(it && it.name, 120),
    key: clip(it && it.key, 80).toLowerCase(),
    qty: num(it && it.qty),
    unit: clip(it && it.unit, 8).toLowerCase(),
    unit_price: num(it && it.unit_price),
    total: num(it && it.total),
    category: CATEGORIES.includes(it && it.category) ? it.category : "ostalo",
  })).filter((it) => it.name || it.total != null);
}
export { num };

/* The run's lines for an e-invoice: its names, keys, units and categories are
   taken, but never its money — the amounts are the invoice's own, exact.
   Line by line when the counts agree; otherwise the invoice's lines stay and
   only a category is borrowed where the names match. */
export function mergeEinvoice(draftItems, readItems) {
  const read = cleanItems(readItems);
  if (read.length === draftItems.length) {
    return draftItems.map((d, i) => ({
      name: read[i].name || d.name, key: read[i].key,
      qty: read[i].qty ?? d.qty, unit: read[i].unit || d.unit,
      unit_price: read[i].unit_price ?? d.unit_price, total: d.total, category: read[i].category,
    }));
  }
  return draftItems.map((d) => {
    const m = read.find((r) => r.name && d.name && r.name.toLowerCase() === d.name.toLowerCase());
    return { ...d, key: m ? m.key : "", category: m ? m.category : (d.category || "ostalo") };
  });
}

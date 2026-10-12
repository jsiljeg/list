/* moj-eRačun (MER) → Troškovi (owner, 2026-10-12, from Filho: "kad bi se
 * moglo na MER spojit di su e-računi, pa on može 80% sam učitavat").
 *
 * Since Fiskalizacija 2.0 (1.1.2026) every VAT-registered supplier invoices
 * Theatrium electronically, and those invoices land in its MER inbox. They
 * are exact — no photo, no reading of small print — so they come in by
 * themselves: the inbox is asked for what arrived, each new document is
 * fetched as UBL, turned into a receipt here (numbers, VAT added back), and
 * the private run only names and files the lines, as it does for a photo.
 *
 * READ ONLY. Nothing is ever sent back to MER: accepting or rejecting an
 * e-invoice (UpdateDokumentProcessStatus) is a legal act under
 * Fiskalizacija 2.0 and is done by a person in MER itself.
 *
 * Credentials are Pages secrets, never in /admin: MER_USERNAME,
 * MER_PASSWORD, MER_COMPANY_ID (Theatrium's OIB), MER_SOFTWARE_ID (issued
 * by MER for API access), optional MER_COMPANY_BU, and MER_DEMO = "1" for
 * demo.moj-eracun.hr. Without them everything here is a no-op.
 * API: manual.moj-eracun.hr/documentation/api-specification-2/ */
import { newId, nowIso, zagrebDate, pump, PHOTO_MAX } from "./expenses.js";
import { ublDraft } from "./ubl.js";

const EVERY_MIN = 30;           /* a staff visit checks the inbox at most this often */
const PER_SYNC = 3;             /* documents fetched per check; the rest next time — a free Worker has 10 ms of CPU (20, then 10, hit it) */
/* The very first check starts on the 1st of the current month (owner,
   2026-10-12: "fetch Oct documents"): older invoices are the backlog, not news. */
const firstFrom = () => zagrebDate().slice(0, 8) + "01";
const OVERLAP_DAYS = 3;         /* re-ask a little behind the last check: seen ids are skipped */

export const merReady = (env) => !!(env && env.MER_USERNAME && env.MER_PASSWORD && env.MER_COMPANY_ID && env.MER_SOFTWARE_ID);
const base = (env) => (env.MER_DEMO === "1" ? "https://demo.moj-eracun.hr" : "https://www.moj-eracun.hr") + "/apis/v2";
const auth = (env) => ({
  Username: String(env.MER_USERNAME), Password: String(env.MER_PASSWORD),
  CompanyId: String(env.MER_COMPANY_ID), SoftwareId: String(env.MER_SOFTWARE_ID),
  ...(env.MER_COMPANY_BU ? { CompanyBu: String(env.MER_COMPANY_BU) } : {}),
});

/* The list must be asked for as JSON: offered both, live MER answers
   queryInbox in XML (seen 2026-10-12). The document itself is XML either way. */
async function call(env, path, body) {
  const r = await fetch(base(env) + path, {
    method: "POST",
    headers: { "content-type": "application/json",
               accept: path === "/queryInbox" ? "application/json" : "application/json, application/xml, text/xml" },
    body: JSON.stringify({ ...auth(env), ...body }),
  });
  const text = await r.text();
  if (!r.ok) {
    /* MER explains a refusal in the body; keep a short, password-free excerpt */
    const why = text.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(`MER ${r.status}${why ? ": " + why : ""}`);
  }
  /* A refusal also comes back as 200, shaped per field (seen 2026-10-12):
     {"Username":{"Value":"1","Messages":["Korisničko ime i lozinka nisu ispravni."]}}
     — read as "nothing new" it would hide a broken login for ever. */
  if (/^\s*\{/.test(text)) {
    let o = null;
    try { o = JSON.parse(text); } catch { /* not JSON: an XML document */ }
    const msgs = o && typeof o === "object" && !Array.isArray(o)
      ? Object.values(o).flatMap((v) => (v && Array.isArray(v.Messages) ? v.Messages : [])) : [];
    if (msgs.length) throw new Error(msgs.join(" ").slice(0, 200));
  }
  return text;
}

async function getState(env) {
  const { results } = await env.DB.prepare("SELECT k, v FROM expense_mer_state").all();
  return Object.fromEntries((results || []).map((r) => [r.k, r.v]));
}
const setState = (env, k, v) => env.DB.prepare(
  "INSERT INTO expense_mer_state (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(k, String(v)).run();

/* What the tab shows about the connection. */
export async function merStatus(env) {
  if (!merReady(env)) return { state: "not_set_up" };
  const s = await getState(env).catch(() => ({}));
  return { state: s.error ? "error" : s.last_ok ? "ok" : "waiting", last_ok: s.last_ok || "", last_try: s.last_try || "",
           error: s.error || "", imported: Number(s.imported || 0) };
}

const day = (iso, back) => new Date(Date.parse(iso) - back * 86400000).toISOString().slice(0, 10);
const docKey = (s) => String(s || "").toLowerCase().replace(/[^0-9a-z]/g, "");


/* The same invoice photographed AND arrived as an e-invoice must count once.
   The e-invoice is exact, so it is the one kept; the photo is marked dup_of
   it and left out of every sum (and can be deleted in one tap). */
export async function findTwin(env, { vendor_oib, doc_no, doc_date, total }, wantMer, exceptId) {
  if (!vendor_oib) return null;
  const { results } = await env.DB.prepare(
    `SELECT id, doc_no, doc_date, total, paid_at FROM expense_receipts
      WHERE vendor_oib = ?1 AND id != ?2 AND dup_of IS NULL AND status = 'done'
        AND ${wantMer ? "source = 'mer'" : "COALESCE(source, 'foto') != 'mer'"}`).bind(vendor_oib, exceptId || "").all();
  const k = docKey(doc_no);
  return (results || []).find((r) => (k && docKey(r.doc_no) === k)
    || (doc_date && r.doc_date === doc_date && total != null && r.total != null && Math.abs(r.total - total) < 0.02)) || null;
}

/* Ask the inbox for anything new. Called on every staff read (throttled to
   EVERY_MIN) and by "provjeri sada". Never throws; failures are kept in the
   state so the tab can say what MER answered. */
/* `range` {from, to} (YYYY-MM-DD) is a backfill of older months (owner,
   2026-10-12: "after October, pull in September and August"): the same
   import, seen documents skipped, but last_ok is left alone — the forward
   check keeps its place. */
export async function merSync(env, { force = false, range = null, retryFailed = false } = {}) {
  if (!merReady(env) || !env.DB) return { state: "not_set_up" };
  const s = await getState(env);
  const now = nowIso();
  if (!force && s.last_try && Date.parse(now) - Date.parse(s.last_try) < EVERY_MIN * 60000) return { state: "fresh" };
  await setState(env, "last_try", now);
  try {
    const from = range ? range.from : s.last_ok ? day(s.last_ok, OVERLAP_DAYS) : firstFrom();
    const to = (range ? range.to : zagrebDate()) + "T23:59:59";
    const list = JSON.parse(await call(env, "/queryInbox", { From: from, To: to }));
    if (!Array.isArray(list)) throw new Error("MER je odgovorio nečim što nije popis dokumenata.");
    const docs = list.filter((d) => d && Number.isInteger(Number(d.ElectronicId)));
    if (retryFailed) await env.DB.prepare("DELETE FROM expense_mer_docs WHERE kind = 'failed'").run();
    const { results } = await env.DB.prepare("SELECT electronic_id FROM expense_mer_docs").all();
    const seen = new Set((results || []).map((r) => Number(r.electronic_id)));
    const fresh = docs.filter((d) => !seen.has(Number(d.ElectronicId)))
      .sort((a, b) => String(a.Sent || "").localeCompare(String(b.Sent || "")));
    let imported = 0, failed = 0;
    for (const d of fresh.slice(0, PER_SYNC)) {
      const eid = Number(d.ElectronicId);
      /* one document MER cannot hand over must not hold up every one after
         it: it is set aside as 'failed' (POST {retry_failed} asks again) */
      let draft;
      try {
        let xml = await call(env, "/receive", { ElectronicId: eid });
        if (/^\s*"/.test(xml)) xml = JSON.parse(xml);          /* some gateways wrap it in a JSON string */
        draft = ublDraft(xml);
      } catch (e) {
        await env.DB.prepare("INSERT OR IGNORE INTO expense_mer_docs (electronic_id, receipt_id, seen_at, kind) VALUES (?1, NULL, ?2, 'failed')")
          .bind(eid, now).run();
        failed += 1;
        continue;
      }
      if (!draft) {
        await env.DB.prepare("INSERT OR IGNORE INTO expense_mer_docs (electronic_id, receipt_id, seen_at, kind) VALUES (?1, NULL, ?2, 'other')")
          .bind(eid, now).run();
        continue;
      }
      await importDraft(env, eid, draft, d);
      imported += 1;
    }
    if (!range && fresh.length <= PER_SYNC) await setState(env, "last_ok", now);
    await setState(env, "error", "");
    await setState(env, "imported", Number(s.imported || 0) + imported);
    if (imported) await pump(env);
    return { state: "ok", imported, failed, more: Math.max(0, fresh.length - PER_SYNC) };
  } catch (e) {
    await setState(env, "error", String(e.message || e).slice(0, 200));
    return { state: "error", error: e.message };
  }
}

async function importDraft(env, eid, draft, listed) {
  const id = newId(), now = nowIso();
  const vendor = draft.vendor || String(listed.SenderBusinessName || "");
  const oib = draft.vendor_oib || String(listed.SenderBusinessNumber || "").replace(/\D/g, "").slice(0, 11);
  const items = draft.items.map((i) => ({ ...i, key: "", category: "ostalo" }));
  /* The receipt and "this document is seen" are one write (2026-10-12): a
     call that ran out of CPU decoding the PDF, between the two, left an
     invoice that the next call imported again. */
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO expense_receipts (id, created_at, updated_at, created_by, status, source, vendor, vendor_oib, doc_date, doc_no,
                                     total, vat, payment, items, note, error, due_date)
       VALUES (?1, ?2, ?2, 'MER', 'queued', 'mer', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, '', ?12)`)
      .bind(id, now, vendor.slice(0, 120), oib, draft.doc_date, String(draft.doc_no || "").slice(0, 60),
            draft.total, draft.vat, draft.payment, JSON.stringify(items), draft.credit ? "Odobrenje (storno) — iznos se oduzima." : "", draft.due_date),
    env.DB.prepare("INSERT OR IGNORE INTO expense_mer_docs (electronic_id, receipt_id, seen_at, kind) VALUES (?1, ?2, ?3, 'invoice')")
      .bind(eid, id, now),
  ]);
  /* The PDF is kept as the base64 text it arrived in and decoded only when
     someone opens it (foto/<n>): decoding a megabyte here, ten documents a
     call, ran past a free Worker's 10 ms of CPU. Too big to keep is skipped. */
  if (draft.pdf && draft.pdf.length * 0.74 <= PHOTO_MAX) {
    try {
      await env.DB.prepare("INSERT INTO expense_photos (receipt_id, n, mime, bytes, created_at) VALUES (?1, 1, 'application/pdf;base64', ?2, ?3)")
        .bind(id, draft.pdf, now).run();
    } catch { /* a broken attachment is not a reason to lose the invoice */ }
  }
}
